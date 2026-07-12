/**
 * agent.ts — 面试引擎
 *
 * 将调优好的 Prompt 与 LLM 客户端连接，提供给 API Routes 使用。
 */

import { chat } from './llm-client';
import { buildSystemPromptV2 } from './prompts/system-v2';
import { FEEDBACK_SYSTEM_PROMPT } from './prompts/evaluation';
import type { ParsedResume, InterviewMode, Difficulty, AgentResponse } from './prompts/types';

// ─── 面试对话 ──────────────────────────────────────────────

export async function generateInterviewResponse(params: {
  resume: ParsedResume;
  mode: InterviewMode;
  difficulty: Difficulty;
  currentPhase?: string;
  questionIndex: number;
  history: { role: 'user' | 'assistant'; content: string }[];
  userAnswer?: string; // undefined = 开场白
  jdText?: string;
  jdTitle?: string;
  jobRole?: string;
  userApiKey?: string;
  userProvider?: string;
}): Promise<AgentResponse & { rawContent: string }> {
  const systemPrompt = buildSystemPromptV2({
    resume: params.resume,
    mode: params.difficulty, // guided / standard / pressure
    questionIndex: params.questionIndex,
    currentPhase: params.currentPhase,
    jdText: params.jdText,
    jdTitle: params.jdTitle,
    jobRole: params.jobRole,
  });

  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  if (!params.userAnswer) {
    // 首轮开场白
    messages.push({
      role: 'user',
      content:
        '面试即将开始。请根据你的角色设定，向候选人发出开场白和第一个问题。',
    });
  } else {
    // 清除历史中的评分 JSON，只保留 interview 消息文本
    const cleanHistory = params.history.map((msg) => {
      if (msg.role === 'assistant') {
        try {
          const parsed = JSON.parse(msg.content);
          if (parsed.message) return { role: 'assistant' as const, content: parsed.message };
        } catch {}
      }
      return msg;
    });
    messages.push(...cleanHistory);
    messages.push({ role: 'user', content: params.userAnswer });
  }

  const response = await chat({
    systemPrompt,
    messages,
    temperature: 0.5,
    maxTokens: 1024,
    jsonMode: true,
    userApiKey: params.userApiKey,
    userProvider: params.userProvider,
  });

  const text = response.content;

  // 解析 JSON 响应（带一次重试）
  let parsed: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
        if (parsed.message && parsed.message.length > 5) break;
      }
    } catch (e) {
      console.error(`Agent JSON parse error (attempt ${attempt + 1}):`, e);
    }

    if (attempt === 0) {
      // 重试：追加纠错消息再调一次
      messages.push({ role: 'user', content: '你的回复必须是合法 JSON 格式。请重新输出。' });
      const retryResponse = await chat({
        systemPrompt: '你必须输出合法 JSON，不要添加任何其他内容。',
        messages,
        temperature: 0.3,
        maxTokens: 1024,
        jsonMode: true,
        userApiKey: params.userApiKey,
        userProvider: params.userProvider,
      });
      const retryText = retryResponse.content;
      try {
        const jsonMatch = retryText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
          if (parsed.message && parsed.message.length > 5) break;
        }
      } catch {}
    }
  }

  if (parsed && parsed.message && typeof parsed.message === 'string' && parsed.message.length >= 5) {
    return { ...parsed, rawContent: text };
  }

  // 降级处理：尝试把原始文本中像面试官说的话提取出来
  const cleanText = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\{[\s\S]*\}/g, '')
    .trim();

  if (cleanText.length > 15 && cleanText.length < 300) {
    return {
      message: cleanText,
      metadata: { evaluation: {} as any, phase: params.currentPhase as any, questionIndex: params.questionIndex },
      isComplete: false,
      completionReason: null,
      rawContent: text,
    };
  }

  const fallbackMsg =
    params.questionIndex <= 1
      ? '请简单介绍一下你自己，包括你的教育背景和最近的一段实习经历。'
      : '你在这个项目中具体负责了哪些部分？可以展开说说吗？';

  return {
    message: fallbackMsg,
    metadata: { evaluation: {} as any, phase: params.currentPhase as any, questionIndex: params.questionIndex },
    isComplete: false,
    completionReason: null,
    rawContent: text,
  };
}

// ─── 复盘报告 ──────────────────────────────────────────────

export async function generateFeedback(params: {
  resume: ParsedResume;
  conversationText: string;
  userApiKey?: string;
  userProvider?: string;
}): Promise<any> {
  const systemPrompt = FEEDBACK_SYSTEM_PROMPT;

  const response = await chat({
    systemPrompt,
    userApiKey: params.userApiKey,
    userProvider: params.userProvider,
    messages: [
      {
        role: 'user',
        content: `请对以下面试进行复盘分析：\n\n候选人简历：${JSON.stringify(params.resume)}\n\n面试对话：\n${params.conversationText}`,
      },
    ],
    temperature: 0.3,
    maxTokens: 4096,
    jsonMode: true,
  });

  const text = response.content;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Feedback JSON parse error:', e);
  }

  return {
    overallScore: 0,
    dimensionScores: {},
    strengths: [],
    improvements: [],
    questionReviews: [],
    resumeSuggestions: [],
    fullReport: text,
  };
}
