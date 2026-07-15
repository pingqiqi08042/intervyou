/**
 * llm-client.ts — 统一 LLM 调用抽象层
 *
 * 支持多种 Provider，通过环境变量切换。
 * 当前支持：DeepSeek（默认）、Claude、以及任何 OpenAI 兼容 API。
 *
 * 配置方式（.env）：
 *   LLM_PROVIDER=deepseek          # deepseek | claude | openai | custom
 *   LLM_API_KEY=sk-...             # API Key
 *   LLM_MODEL=deepseek-chat        # 模型名（可选，有默认值）
 *   LLM_BASE_URL=https://...       # 自定义 API 地址（仅 custom 模式需要）
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// ─── 类型 ──────────────────────────────────────────────────

export type Provider = 'deepseek' | 'claude' | 'openai' | 'custom';

export interface LlmConfig {
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl?: string; // 仅 openai-compatible provider
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ─── 默认配置 ──────────────────────────────────────────────

const DEFAULT_MODELS: Record<Provider, string> = {
  deepseek: 'deepseek-chat',          // DeepSeek V3
  claude: 'claude-sonnet-5-20250901', // Claude Sonnet 5
  openai: 'gpt-4o',                   // GPT-4o
  custom: '',
};

const DEFAULT_BASE_URLS: Record<Provider, string> = {
  deepseek: 'https://api.deepseek.com',
  claude: '',                          // 使用 Anthropic SDK，不需要 base URL
  openai: 'https://api.openai.com/v1',
  custom: '',
};

// ─── 配置解析 ──────────────────────────────────────────────

export function getLlmConfig(): LlmConfig {
  const provider = (process.env.LLM_PROVIDER || 'deepseek') as Provider;
  const apiKey = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  const model = process.env.LLM_MODEL || DEFAULT_MODELS[provider];
  const baseUrl = process.env.LLM_BASE_URL || DEFAULT_BASE_URLS[provider];

  if (!apiKey) {
    throw new Error(
      `未设置 API Key。请在 .env 中设置 LLM_API_KEY（或 ANTHROPIC_API_KEY）`
    );
  }

  return { provider, apiKey, model, baseUrl };
}

// ─── 统一调用接口 ──────────────────────────────────────────

export async function chat(params: {
  systemPrompt: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  // 用户自有 Key（优先级高于服务端配置）
  userApiKey?: string;
  userProvider?: string;
}): Promise<LlmResponse> {
  // 部署模式：强制要求用户提供自己的 Key（先检查用户 Key，避免触发服务端 Key 报错）
  const requireUserKey = process.env.REQUIRE_USER_KEY === 'true';
  if (requireUserKey && !params.userApiKey) {
    throw new Error('请先在左侧「API 配置」中填入你的 API Key（DeepSeek 免费注册即可获取）');
  }

  // 用户 Key 优先，没有则回退服务端 Key
  const serverConfig = params.userApiKey ? null : getLlmConfig() as LlmConfig | null;

  const config = (params.userApiKey
    ? {
        provider: (params.userProvider || serverConfig?.provider || 'deepseek') as Provider,
        apiKey: params.userApiKey,
        model: serverConfig?.model || 'deepseek-chat',
        baseUrl: DEFAULT_BASE_URLS[params.userProvider as Provider] || serverConfig?.baseUrl || 'https://api.deepseek.com',
      }
    : serverConfig!) as LlmConfig;

  if (config.provider === 'claude') {
    return chatWithClaude(config, params);
  }
  return chatWithOpenAI(config, params);
}

// ─── OpenAI 兼容实现（DeepSeek / OpenAI / 其他）─────────────

async function chatWithOpenAI(
  config: LlmConfig,
  params: {
    systemPrompt: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  }
): Promise<LlmResponse> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: params.systemPrompt },
    ...params.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const response = await client.chat.completions.create({
    model: config.model,
    messages,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.maxTokens ?? 1024,
    // DeepSeek 支持 OpenAI 兼容的 JSON 模式
    ...(params.jsonMode
      ? { response_format: { type: 'json_object' } }
      : {}),
  });

  const choice = response.choices[0];
  return {
    content: choice?.message?.content || '',
    model: response.model,
    usage: {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
    },
  };
}

// ─── Claude 实现（保留，可切换）──────────────────────────────

async function chatWithClaude(
  config: LlmConfig,
  params: {
    systemPrompt: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    temperature?: number;
    maxTokens?: number;
  }
): Promise<LlmResponse> {
  const client = new Anthropic({ apiKey: config.apiKey });

  const response = await client.messages.create({
    model: config.model,
    max_tokens: params.maxTokens ?? 1024,
    system: params.systemPrompt,
    messages: params.messages,
    temperature: params.temperature ?? 0.7,
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '';

  return {
    content: text,
    model: response.model,
    usage: {
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
    },
  };
}

// ─── 便捷函数：打印当前配置 ────────────────────────────────

export function printConfig(): string {
  try {
    const config = getLlmConfig();
    return [
      `Provider: ${config.provider}`,
      `Model: ${config.model}`,
      `Base URL: ${config.baseUrl || '(SDK default)'}`,
      `API Key: ${config.apiKey.substring(0, 12)}...`,
    ].join('\n');
  } catch (e: any) {
    return `⚠ 配置错误：${e.message}`;
  }
}
