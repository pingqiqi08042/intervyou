/**
 * builder.ts — 组装最终 System Prompt
 *
 * 将 base + mode + difficulty + output_format 拼接为完整 System Prompt。
 * 调优时，只需要修改对应的模块，然后跑测试即可。
 */

import { BASE_SYSTEM_PROMPT } from './base';
import { MODE_PROMPTS } from './modes';
import { DIFFICULTY_PROMPTS } from './difficulty';
import { OUTPUT_FORMAT_INSTRUCTION } from './evaluation';
import type { BuildPromptParams, InterviewMode } from './types';

// 不同模式的轮次上限
const MAX_ROUNDS: Record<InterviewMode, number> = {
  resume_deep_dive: 12,
  behavioral: 8,
  technical: 10,
  comprehensive: 15,
};

/**
 * 构建完整的 System Prompt
 */
export function buildSystemPrompt(params: BuildPromptParams & { jdText?: string; jdTitle?: string }): string {
  const { resume, mode, difficulty, currentPhase, questionIndex, jdText, jdTitle } = params;

  const resumeContext = formatResumeForPrompt(resume);
  const modeInstruction = MODE_PROMPTS[mode];
  const difficultyInstruction = DIFFICULTY_PROMPTS[difficulty];
  const maxRounds = MAX_ROUNDS[mode];

  const jdBlock = jdText ? [
    '',
    '---',
    '',
    '## 候选人目标岗位',
    jdTitle ? `岗位：${jdTitle}` : '',
    '',
    'JD 内容：',
    jdText,
    '',
    '**JD 对面试的指导**：',
    '- 候选人的目标是这个岗位，你的问题应该偏向这个方向',
    '- 如果简历中的经历与 JD 要求匹配，重点追问这些经历',
    '- 如果简历中缺少 JD 要求的某些技能/经验，在合适的时候提及',
  ].filter(Boolean).join('\n') : '';

  return [
    BASE_SYSTEM_PROMPT,
    '',
    '---',
    '',
    '## 候选人简历',
    '',
    '以下是你本次面试的候选人简历。你的每一个问题都必须从这份简历出发。',
    '',
    '```json',
    resumeContext,
    '```',
    jdBlock,
    '',
    '---',
    '',
    modeInstruction,
    '',
    '---',
    '',
    difficultyInstruction,
    '',
    '---',
    '',
    `## 当前状态`,
    `- 当前阶段：${currentPhase || '初始'}`,
    `- 当前问题序号：${questionIndex}`,
    `- 轮次上限：${maxRounds}`,
    '',
    '---',
    '',
    OUTPUT_FORMAT_INSTRUCTION,
  ].join('\n');
}

/**
 * 将简历结构化数据格式化为 prompt 友好的文本
 * 控制长度，避免超出 token 限制
 */
function formatResumeForPrompt(resume: BuildPromptParams['resume']): string {
  // 只提取关键信息，去掉冗余字段
  const compact = {
    name: resume.name,
    education: resume.education.map((e) =>
      `${e.school} · ${e.degree} · ${e.major} · ${e.year}`
    ),
    experiences: resume.experiences.map((exp) => ({
      company: exp.company,
      role: exp.role,
      duration: exp.duration,
      description: exp.description,
      // 亮点是追问的入口，保留
      highlights: exp.highlights,
      techStack: exp.techStack || [],
    })),
    projects: resume.projects.map((proj) => ({
      name: proj.name,
      role: proj.role,
      description: proj.description,
      highlights: proj.highlights,
      techStack: proj.techStack || [],
    })),
    skills: resume.skills,
  };

  // 用紧凑 JSON 输出，不换行节省 token
  return JSON.stringify(compact, null, 1);
}

/**
 * 调试用：打印 prompt 统计信息
 */
export function analyzePrompt(prompt: string): {
  totalChars: number;
  estimatedTokens: number;
  sections: string[];
} {
  const sections = prompt.split('\n---\n');
  return {
    totalChars: prompt.length,
    // Claude 的 token 估算：中文约 1 char ≈ 1.5 token，英文约 1 char ≈ 0.25 token
    // 粗略估算：1 char ≈ 0.5 token
    estimatedTokens: Math.ceil(prompt.length / 2),
    sections: sections.map((s) => s.trim().split('\n')[0] || '(empty)'),
  };
}
