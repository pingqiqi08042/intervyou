import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest) {
  try {
    const sessions = await prisma.interviewSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        resume: { select: { parsedData: true } },
        feedback: { select: { overallScore: true } },
      },
    });

    const list = sessions.map((s) => {
      let name = '未知';
      try {
        const p = JSON.parse(s.resume.parsedData);
        name = p.name || '未知';
      } catch {}
      return {
        id: s.id,
        mode: s.mode,
        difficulty: s.difficulty,
        status: s.status,
        name,
        score: s.feedback?.overallScore ?? null,
        createdAt: s.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ sessions: list });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
