import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseResumeText } from '@/lib/resume-parser';
import { getUserKey } from '@/lib/user-key';

export async function POST(req: NextRequest) {
  const userKey = getUserKey(req);
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const jdText = (formData.get('jdText') as string) || '';
    const jdTitle = (formData.get('jdTitle') as string) || '';

    if (!file) {
      return NextResponse.json({ error: '请上传简历文件' }, { status: 400 });
    }

    // 提取文本
    let rawText = '';
    if (file.type === 'application/pdf') {
      const { default: pdfParse } = await import('pdf-parse');
      const buffer = Buffer.from(await file.arrayBuffer());
      rawText = (await pdfParse(buffer)).text;
    } else if (
      file.type.includes('word') ||
      file.name.endsWith('.docx')
    ) {
      const mammoth = await import('mammoth');
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(buffer),
      });
      rawText = result.value;
    } else {
      rawText = await file.text();
    }

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: '无法提取文本，请检查文件' },
        { status: 400 }
      );
    }

    // AI 结构化
    const parsedData = await parseResumeText(rawText, userKey.apiKey, userKey.provider);

    // 存库
    const resume = await prisma.resume.create({
      data: {
        fileName: file.name,
        rawText,
        parsedData: JSON.stringify(parsedData),
        jdText,
        jdTitle,
      },
    });

    return NextResponse.json({
      id: resume.id,
      fileName: resume.fileName,
      parsedData,
    });
  } catch (error: any) {
    console.error('Resume upload error:', error);
    return NextResponse.json(
      { error: error.message || '简历处理失败' },
      { status: 500 }
    );
  }
}
