import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateInterviewResponse } from '@/lib/agent';
import { getUserKey } from '@/lib/user-key';
import type { InterviewMode, Difficulty, ParsedResume } from '@/lib/prompts/types';

export async function POST(req: NextRequest) {
  const userKey = getUserKey(req);
  try {
    const { resumeId, mode, difficulty, jobRole, jdText, jdTitle } = await req.json();

    if (!resumeId || !mode || !difficulty) {
      return NextResponse.json(
        { error: '缺少必填参数：resumeId, mode, difficulty' },
        { status: 400 }
      );
    }

    // 获取简历
    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
    });
    if (!resume) {
      return NextResponse.json({ error: '简历不存在' }, { status: 404 });
    }

    const parsedData: ParsedResume = JSON.parse(resume.parsedData);

    // 生成开场白
    const response = await generateInterviewResponse({
      resume: parsedData,
      mode: mode as InterviewMode,
      difficulty: difficulty as Difficulty,
      questionIndex: 1,
      history: [],
      jdText: jdText || resume.jdText || undefined,
      jdTitle: jdTitle || resume.jdTitle || undefined,
      jobRole: jobRole || 'auto',
      userApiKey: userKey.apiKey,
      userProvider: userKey.provider,
    });

    // 创建会话 + 首条消息
    const session = await prisma.interviewSession.create({
      data: {
        resumeId,
        mode,
        difficulty,
        status: 'in_progress',
        currentPhase: response.metadata?.phase || 'opening',
        questionIndex: 1,
        messages: {
          create: {
            role: 'interviewer',
            content: response.message || '你好，我是今天的面试官。请先简单介绍一下你自己吧。',
            metadata: JSON.stringify(response.metadata || {}),
          },
        },
      },
      include: { messages: true },
    });

    return NextResponse.json({
      sessionId: session.id,
      openingMessage: session.messages[0],
    });
  } catch (error: any) {
    console.error('Create session error:', error);
    return NextResponse.json(
      { error: error.message || '创建面试失败' },
      { status: 500 }
    );
  }
}
