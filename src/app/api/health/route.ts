import { NextResponse } from 'next/server';
import { chat } from '@/lib/llm-client';

export async function GET() {
  try {
    const start = Date.now();
    const response = await chat({
      systemPrompt: '回复一个单词：OK',
      messages: [{ role: 'user', content: 'ping' }],
      temperature: 0,
      maxTokens: 10,
      jsonMode: false,
    });
    const latency = Date.now() - start;

    return NextResponse.json({
      ok: true,
      model: response.model,
      latencyMs: latency,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message || '连接失败',
    }, { status: 500 });
  }
}
