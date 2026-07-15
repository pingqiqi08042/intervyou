import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateFeedback } from '@/lib/agent';
import { getUserKey } from '@/lib/user-key';
import type { ParsedResume } from '@/lib/prompts/types';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userKey = getUserKey(req);
    const session = await prisma.interviewSession.findUnique({
      where: { id: params.id },
      include: { resume: true, messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    if (session.status !== 'completed') {
      return NextResponse.json(
        { error: '面试尚未结束' },
        { status: 400 }
      );
    }

    // 至少要有 3 条消息（开场 + 1 轮对话）才能生成有意义的报告
    const candidateMsgs = session.messages.filter((m) => m.role === 'candidate');
    if (candidateMsgs.length === 0) {
      return NextResponse.json(
        { error: '面试没有有效对话，无法生成报告。请至少完成一轮问答。' },
        { status: 400 }
      );
    }

    // 检查是否已有缓存
    const existing = await prisma.feedback.findUnique({
      where: { sessionId: session.id },
    });
    if (existing) {
      return NextResponse.json({
        overallScore: existing.overallScore,
        dimensionScores: JSON.parse(existing.dimensionScores),
        strengths: JSON.parse(existing.strengths),
        improvements: JSON.parse(existing.improvements),
        fullReport: existing.fullReport,
      });
    }

    // 构建对话文本
    const conversationText = session.messages
      .map((m) =>
        `[${m.role === 'interviewer' ? '面试官' : '候选人'}]: ${m.content}`
      )
      .join('\n\n');

    const parsedData: ParsedResume = JSON.parse(session.resume.parsedData);

    // 生成复盘
    const feedback = await generateFeedback({
      resume: parsedData,
      conversationText,
      jobRole: session.jobRole || 'auto',
      userApiKey: userKey.apiKey,
      userProvider: userKey.provider,
    });

    // 存库
    await prisma.feedback.create({
      data: {
        sessionId: session.id,
        overallScore: feedback.overallScore || 0,
        dimensionScores: JSON.stringify(feedback.dimensionScores || {}),
        strengths: JSON.stringify(feedback.strengths || []),
        improvements: JSON.stringify(feedback.improvements || []),
        fullReport: feedback.fullReport || '',
      },
    });

    return NextResponse.json(feedback);
  } catch (error: any) {
    console.error('Feedback error:', error);
    return NextResponse.json(
      { error: error.message || '生成复盘失败' },
      { status: 500 }
    );
  }
}
