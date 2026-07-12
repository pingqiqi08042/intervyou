/**
 * resume-parser.ts — 简历文本提取 + AI 结构化
 */

import { chat } from './llm-client';
import { RESUME_PARSER_PROMPT } from './prompts/resume-parser';
import type { ParsedResume } from './prompts/types';

export async function parseResumeText(
  rawText: string,
  userApiKey?: string,
  userProvider?: string
): Promise<ParsedResume> {
  const response = await chat({
    systemPrompt: RESUME_PARSER_PROMPT,
    messages: [{ role: 'user', content: `请解析以下简历文本：\n\n${rawText}` }],
    temperature: 0.1,
    maxTokens: 2048,
    jsonMode: true,
    userApiKey,
    userProvider,
  });

  const text = response.content;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Resume parse JSON error:', e);
  }

  throw new Error('简历解析失败，请检查文件格式');
}
