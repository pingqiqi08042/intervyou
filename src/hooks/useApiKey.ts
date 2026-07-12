'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'intervyou_user_llm_config';

interface UserLlmConfig {
  apiKey: string;
  provider: string;
}

export function useApiKey() {
  const [config, setConfig] = useState<UserLlmConfig>({ apiKey: '', provider: 'deepseek' });
  const [isOpen, setIsOpen] = useState(false);

  // 从 localStorage 读取
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setConfig(parsed);
      }
    } catch {}
  }, []);

  // 保存并关闭
  const save = useCallback((cfg: UserLlmConfig) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    setConfig(cfg);
    setIsOpen(false);
  }, []);

  // 清除
  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setConfig({ apiKey: '', provider: 'deepseek' });
  }, []);

  // 生成请求头（每次 fetch 时调用）
  const headers = config.apiKey
    ? {
        'x-llm-api-key': config.apiKey,
        'x-llm-provider': config.provider,
      }
    : {};

  return {
    config,
    isOpen,
    setIsOpen,
    save,
    clear,
    headers,
    hasKey: !!config.apiKey,
  };
}
