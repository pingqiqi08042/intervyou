import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chat } from '@/lib/llm-client';
import { getUserKey } from '@/lib/user-key';
import type { ParsedResume } from '@/lib/prompts/types';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userKey = getUserKey(req);
    const resume = await prisma.resume.findUnique({ where: { id: params.id } });
    if (!resume) {
      return NextResponse.json({ error: '简历不存在' }, { status: 404 });
    }

    if (resume.diagnosisData) {
      try {
        const cached = JSON.parse(resume.diagnosisData);
        if (cached.overallScore) return NextResponse.json(cached);
      } catch {}
    }

    const parsed: ParsedResume = JSON.parse(resume.parsedData);

    const jdContext = resume.jdText
      ? `\n## 目标岗位 JD\n${resume.jdText}\n\n如果提供了JD，请逐条对比简历和JD的匹配度，指出差距。`
      : '\n（候选人未提供 JD，请仅从简历本身的撰写质量进行分析）';

    const systemPrompt = `你是资深简历顾问和校招面试官。分析以下简历，给出具体可操作的优化建议。

## 评分规则（重要）
- 不要给所有人一样的分数。写得很差的简历可以给 30-50 分，优秀的给 80-95 分。
- 每个维度独立打分，拉开差距。

## 分析维度
1. 结构完整性：教育/实习/项目/技能是否齐全
2. 量化密度：每段经历有多少数字/百分比支撑
3. STAR覆盖：描述是否包含 背景→行动→结果
4. 语言精准度：是否有"参与""协助"等弱动词
5. 面试风险：哪些描述容易被追问到答不上来
6. JD匹配度（如有JD）：对目标岗位的关键词覆盖

## 输出格式
直接输出 JSON：
{
  "overallScore": 72,
  "dimensionScores": {"structure":80,"quantification":55,"star":70,"language":75,"risk":60,"jdMatch":65},
  "highRisks": [{"quote":"简历原文","risk":"为什么会被追问","fix":"怎么改或怎么准备"}],
  "rewrites": [{"original":"原文","improved":"改写后","reason":"为什么这样改"}],
  "sectionAnalysis": [{"section":"字节实习","rating":"yellow","comment":"有量化但缺STAR细节"}],
  "fullReport":"Markdown格式的完整诊断报告"
}`;

    const response = await chat({
      systemPrompt,
      messages: [{ role: 'user', content: `简历数据：${JSON.stringify(parsed)}${jdContext}` }],
      temperature: 0.3,
      maxTokens: 4096,
      jsonMode: true,
      userApiKey: userKey.apiKey,
      userProvider: userKey.provider,
    });

    const text = response.content;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        await prisma.resume.update({
          where: { id: params.id },
          data: { diagnosisData: JSON.stringify(result) },
        });
        return NextResponse.json(result);
      }
    } catch (e) {
      console.error('Diagnosis parse error:', e);
    }

    return NextResponse.json({ error: '诊断生成失败' }, { status: 500 });
  } catch (error: any) {
    console.error('Diagnosis error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.resume.update({
    where: { id: params.id },
    data: { diagnosisData: '' },
  });
  return NextResponse.json({ success: true });
}
