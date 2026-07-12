/**
 * index.ts — Prompt 模块统一导出
 */

export { BASE_SYSTEM_PROMPT } from './base';
export { MODE_PROMPTS } from './modes';
export { DIFFICULTY_PROMPTS } from './difficulty';
export { OUTPUT_FORMAT_INSTRUCTION, FEEDBACK_SYSTEM_PROMPT } from './evaluation';
export { RESUME_PARSER_PROMPT, buildResumeParseMessages } from './resume-parser';
export { buildSystemPrompt, analyzePrompt } from './builder';
export type * from './types';
