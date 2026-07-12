/**
 * fetch-with-key.ts — 封装 fetch，自动附带用户 API Key
 *
 * 读取 localStorage 中的用户 Key，注入请求头。
 */

function getLlmHeaders(): Record<string, string> {
  try {
    if (typeof window === 'undefined') return {};
    const stored = localStorage.getItem('intervyou_user_llm_config');
    if (!stored) return {};
    const { apiKey, provider } = JSON.parse(stored);
    if (!apiKey) return {};
    return {
      'x-llm-api-key': apiKey,
      'x-llm-provider': provider || 'deepseek',
    };
  } catch {
    return {};
  }
}

export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const headers = {
    ...(options?.headers || {}),
    ...getLlmHeaders(),
  };
  return fetch(url, { ...options, headers });
}
