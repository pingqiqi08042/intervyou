/**
 * user-key.ts — 从请求头读取用户自有 API Key
 *
 * 前端在 localStorage 中存储用户 Key，
 * 每次请求通过 x-llm-api-key 和 x-llm-provider 头发送。
 * 后端绝不存储用户 Key——每次请求即用即弃。
 */

import { NextRequest } from 'next/server';

export interface UserKey {
  apiKey?: string;
  provider?: string;
}

export function getUserKey(req: NextRequest): UserKey {
  const apiKey = req.headers.get('x-llm-api-key') || undefined;
  const provider = req.headers.get('x-llm-provider') || undefined;
  return { apiKey, provider };
}
