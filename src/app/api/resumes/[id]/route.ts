import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Delete related records in order
    const sessions = await prisma.interviewSession.findMany({
      where: { resumeId: params.id },
      select: { id: true },
    });

    for (const s of sessions) {
      await prisma.feedback.deleteMany({ where: { sessionId: s.id } });
      await prisma.message.deleteMany({ where: { sessionId: s.id } });
      await prisma.interviewSession.delete({ where: { id: s.id } });
    }

    await prisma.resume.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
