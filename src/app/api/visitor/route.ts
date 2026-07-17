import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') || '/';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // 记录访问
  await prisma.visitor.create({ data: { path, ip } });

  // 统计
  const total = await prisma.visitor.count();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = await prisma.visitor.count({
    where: { createdAt: { gte: today } },
  });

  return NextResponse.json({ total, today: todayCount });
}
