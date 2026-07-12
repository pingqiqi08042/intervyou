import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await prisma.interviewSession.findUnique({
    where: { id: params.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!session) {
    return NextResponse.json({ error: '会话不存在' }, { status: 404 });
  }

  return NextResponse.json({
    id: session.id,
    resumeId: session.resumeId,
    mode: session.mode,
    difficulty: session.difficulty,
    status: session.status,
    currentPhase: session.currentPhase,
    questionIndex: session.questionIndex,
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const { status } = body;

  if (status === 'completed') {
    await prisma.interviewSession.update({
      where: { id: params.id },
      data: { status: 'completed', completedAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.feedback.deleteMany({ where: { sessionId: params.id } });
  await prisma.message.deleteMany({ where: { sessionId: params.id } });
  await prisma.interviewSession.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
