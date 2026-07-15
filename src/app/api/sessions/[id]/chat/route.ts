import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateInterviewResponse } from '@/lib/agent';
import { getUserKey } from '@/lib/user-key';
import type { InterviewMode, Difficulty, ParsedResume } from '@/lib/prompts/types';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userKey = getUserKey(req);
    const { content } = await req.json();

    if (!content) {
      return NextResponse.json(
        { error: '消息内容不能为空' },
        { status: 400 }
      );
    }

    // 获取会话 + 简历 + 历史消息
    const session = await prisma.interviewSession.findUnique({
      where: { id: params.id },
      include: { resume: true, messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }
    if (session.status === 'completed') {
      return NextResponse.json({ error: '面试已结束' }, { status: 400 });
    }

    // 构建历史
    const history: { role: 'user' | 'assistant'; content: string }[] =
      session.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'interviewer' ? ('assistant' as const) : ('user' as const),
          content: m.content,
        }));

    const parsedData: ParsedResume = JSON.parse(session.resume.parsedData);

    // 调用 Agent
    const response = await generateInterviewResponse({
      resume: parsedData,
      mode: session.mode as InterviewMode,
      difficulty: session.difficulty as Difficulty,
      currentPhase: session.currentPhase || undefined,
      questionIndex: session.questionIndex + 1,
      history,
      userAnswer: content,
      jdText: session.resume.jdText || undefined,
      jdTitle: session.resume.jdTitle || undefined,
      userApiKey: userKey.apiKey,
      userProvider: userKey.provider,
    });

    // 保存候选人消息 + AI 回复
    await prisma.message.create({
      data: {
        sessionId: session.id,
        role: 'candidate',
        content,
      },
    });

    let reply = response.message || '请继续。';

    // 防重复 + 确保换题具体
    const prevQuestions = session.messages
      .filter((m) => m.role === 'interviewer')
      .map((m) => m.content);
    // 检测重复：完全一样 OR 前 15 字一样 OR 语义高度相似
    const isRepeat = prevQuestions.length >= 2 &&
      prevQuestions.some((q) => {
        const shortQ = q.substring(0, 20);
        const shortR = reply.substring(0, 20);
        return shortQ === shortR ||
          (shortQ.includes('负责了哪些') && shortR.includes('负责了哪些')) ||
          (shortQ.includes('展开说说') && shortR.includes('展开说说'));
      });
    if (isRepeat) {
      // 从简历中找下一个尚未深挖的经历
      try {
        const resume = JSON.parse(session.resume.parsedData);
        const allExps = [...(resume.experiences || []), ...(resume.projects || [])];
        const mentioned = prevQuestions.join(' ');
        const next = allExps.find((e: any) =>
          !mentioned.includes(e.company || e.name || '')
        );
        if (next) {
          const name = next.company || next.name || '';
          reply = `好的，了解了。我们聊聊你在${name}的经历吧，能简单介绍一下吗？`;
        } else {
          // 所有经历都聊过了，进入反问环节
          reply = '好的，关于你的经历我了解得差不多了。我的问题问完了，你有什么想问我的吗？';
        }
      } catch {
        reply = '好的，我的问题问完了，你有什么想问我的吗？';
      }
    }

    const aiMessage = await prisma.message.create({
      data: {
        sessionId: session.id,
        role: 'interviewer',
        content: reply,
        metadata: JSON.stringify(response.metadata || {}),
      },
    });

    // 更新会话状态
    const updates: any = {
      questionIndex: session.questionIndex + 1,
      currentPhase: response.metadata?.phase || session.currentPhase,
    };

    if (response.isComplete) {
      updates.status = 'completed';
      updates.completedAt = new Date();
    }

    await prisma.interviewSession.update({
      where: { id: session.id },
      data: updates,
    });

    return NextResponse.json({
      message: aiMessage,
      phase: response.metadata?.phase,
      isComplete: response.isComplete,
    });
  } catch (error: any) {
    const msg = error.message || '';
    console.error('Chat error:', msg);

    // 给出中文友好提示
    if (msg.includes('API key') || msg.includes('Incorrect API key') || msg.includes('401')) {
      return NextResponse.json({ error: 'API Key 无效，请检查配置' }, { status: 500 });
    }
    if (msg.includes('quota') || msg.includes('balance') || msg.includes('402') || msg.includes('429')) {
      return NextResponse.json({ error: 'API 额度不足或请求过于频繁，请稍后重试' }, { status: 500 });
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return NextResponse.json({ error: 'AI 响应超时，请重试' }, { status: 500 });
    }

    return NextResponse.json(
      { error: msg || '处理失败，请重试' },
      { status: 500 }
    );
  }
}
