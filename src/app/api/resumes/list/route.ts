import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest) {
  try {
    const resumes = await prisma.resume.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, fileName: true, parsedData: true, diagnosisData: true, createdAt: true },
    });

    const list = resumes.map((r) => {
      let name = '未知';
      try {
        const p = JSON.parse(r.parsedData);
        name = p.name || '未知';
      } catch {}
      let diagScore: number | null = null;
      if (r.diagnosisData) {
        try { diagScore = JSON.parse(r.diagnosisData).overallScore || null; } catch {}
      }
      return { id: r.id, fileName: r.fileName, name, hasDiagnosis: !!r.diagnosisData, diagScore, createdAt: r.createdAt.toISOString() };
    });

    return NextResponse.json({ resumes: list });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
