import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chat } from '@/lib/llm-client';
import { getUserKey } from '@/lib/user-key';
import { markdownToDocxBuffer } from '@/lib/docx-generator';
import type { ParsedResume } from '@/lib/prompts/types';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userKey = getUserKey(req);
    const body = await req.json().catch(() => ({}));
    const mode: string = body.mode || 'both';
    const format: string = body.format || 'md';
    const sessionId: string = body.sessionId || '';
    const useDiagnosis: boolean = body.useDiagnosis !== false;

    // Load specific session if provided, otherwise latest
    const sessionInclude = {
      include: { feedback: true },
      orderBy: { createdAt: 'desc' as const },
      take: 1,
    };
    const resume = await prisma.resume.findUnique({
      where: { id: params.id },
      include: {
        sessions: sessionId
          ? { where: { id: sessionId }, include: { feedback: true } }
          : sessionInclude,
      },
    });
    if (!resume) return NextResponse.json({ error: '简历不存在' }, { status: 404 });

    const parsed: ParsedResume = JSON.parse(resume.parsedData);
    const selectedSession = sessionId ? resume.sessions[0] : (resume.sessions[0] || null);
    const feedback = selectedSession?.feedback || null;

    // Build diagnosis insight from stored data
    let diagnosisInsight = '';
    if (useDiagnosis && resume.diagnosisData) {
      try {
        const diag = JSON.parse(resume.diagnosisData);
        if (diag.highRisks?.length) {
          diagnosisInsight = `\n## 简历诊断问题\n${diag.highRisks.map((r: any, i: number) => `${i + 1}. "${r.quote}" → ${r.risk} → ${r.fix}`).join('\n')}\n`;
        }
        if (diag.rewrites?.length) {
          diagnosisInsight += `\n## 改写建议\n${diag.rewrites.map((r: any, i: number) => `${i + 1}. 原文"${r.original}" → 改为"${r.improved}"`).join('\n')}\n`;
        }
      } catch {}
    }

    // —— 构建上下文 ——
    let interviewInsight = '';

    if (mode === 'interview' || mode === 'both') {
      if (feedback) {
        const dims = JSON.parse(feedback.dimensionScores || '{}');
        const improvements = JSON.parse(feedback.improvements || '[]');
        interviewInsight = `
## 面试暴露的问题
${improvements.map((imp: any, i: number) => `${i + 1}. ${imp.issue} → ${imp.suggestion}`).join('\n')}
## 面试评分
STAR ${dims.starCompleteness || '-'} | 量化 ${dims.quantification || '-'} | 逻辑 ${dims.logicClarity || '-'} | 深度 ${dims.technicalDepth || '-'} | 表达 ${dims.communication || '-'}
`;
      } else {
        interviewInsight = '\n（暂无面试数据，仅基于简历本身优化）\n';
      }
    }
    if (mode === 'diagnosis') {
      interviewInsight = ''; // 纯诊断模式，不用面试数据
    }

    const jdContext = resume.jdText
      ? `\n## 目标岗位\n${resume.jdTitle || ''}\n${resume.jdText}`
      : '';

    const tag = mode === 'diagnosis' ? '仅诊断' : mode === 'interview' ? '仅面试反馈' : '诊断+面试';
    if (mode === 'diagnosis') interviewInsight = '';

    const allInsight = [diagnosisInsight, interviewInsight].filter(Boolean).join('\n');

    const systemPrompt = `你是顶尖校招简历优化专家。根据「${tag}」生成优化简历。${jdContext}

## 优化原则
- 动作动词开头（主导/设计/优化/搭建），禁止"参与""协助"
- 每段经历至少 2 个量化数据，有对比基准
- 遵循 STAR：背景→行动→结果
- 面试中暴露的弱点：弱化描述或标注需准备
- 覆盖 JD 关键词，保持一页纸篇幅

## 输出
直接输出 Markdown 简历，不要额外解释。

# [姓名]
[学校] · [学位] · [专业] · [毕业年份]

## 实习经历
### [公司] — [职位]（[时间段]）
- [STAR+量化 bullet]
...

## 项目经历
### [项目名] — [角色]
- ...

## 技能
[分组列表]`;

    const response = await chat({
      systemPrompt,
      userApiKey: userKey.apiKey,
      userProvider: userKey.provider,
      messages: [{
        role: 'user',
        content: [
          '## 原始简历',
          JSON.stringify(parsed, null, 2),
          allInsight || '',
          '请生成优化简历。',
        ].join('\n'),
      }],
      temperature: 0.3,
      maxTokens: 4096,
    });

    let markdown = response.content
      .replace(/^```markdown\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    // 如果 Markdown 被代码块包裹了多行
    const mdMatch = markdown.match(/```(?:markdown)?\s*([\s\S]*?)```/);
    if (mdMatch) markdown = mdMatch[1].trim();

    // Word 格式：Markdown → 真实 .docx binary
    let docxBase64 = '';
    if (format === 'docx') {
      const buffer = await markdownToDocxBuffer(markdown);
      docxBase64 = buffer.toString('base64');
    }

    return NextResponse.json({
      markdown,
      docxBase64: docxBase64 || undefined,
      mode,
    });
  } catch (error: any) {
    console.error('Optimize error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
