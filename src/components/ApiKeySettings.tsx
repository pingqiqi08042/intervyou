'use client';

import { useState } from 'react';
import { useApiKey } from '@/hooks/useApiKey';

const PROVIDER_INFO: Record<string, { label: string; url: string; tip: string }> = {
  deepseek: {
    label: 'DeepSeek（推荐）',
    url: 'https://platform.deepseek.com',
    tip: '注册送 500 万 tokens 免费额度，够用几百次面试',
  },
  claude: {
    label: 'Claude',
    url: 'https://console.anthropic.com',
    tip: '效果最好但较贵，需要海外手机号注册',
  },
  openai: {
    label: 'OpenAI',
    url: 'https://platform.openai.com',
    tip: 'GPT-4o 综合能力强，需要海外手机号',
  },
};

export default function ApiKeySettings() {
  const { config, isOpen, setIsOpen, save, clear, hasKey } = useApiKey();
  const [key, setKey] = useState(config.apiKey);
  const [provider, setProvider] = useState(config.provider);
  const info = PROVIDER_INFO[provider] || PROVIDER_INFO.deepseek;

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => {
          setKey(config.apiKey);
          setProvider(config.provider);
          setIsOpen(!isOpen);
        }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${hasKey ? 'bg-green-500' : 'bg-gray-300'}`} />
        <span>API 配置</span>
        {hasKey && <span className="text-[10px] text-green-600 ml-auto">{provider}</span>}
        <span className={`text-gray-400 text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>&#8250;</span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-2">
          {/* Provider 选择 */}
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-400"
          >
            {Object.entries(PROVIDER_INFO).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          {/* Key 输入 */}
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="粘贴 API Key（sk-...）"
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
          />

          {/* Provider 指引 */}
          <p className="text-[10px] text-gray-400 leading-relaxed">
            {info.tip}。
            <a href={info.url} target="_blank" rel="noreferrer"
              className="text-blue-500 hover:underline ml-1">去注册 &rarr;</a>
          </p>

          {/* 按钮 */}
          <div className="flex gap-2">
            <button
              onClick={() => save({ apiKey: key.trim(), provider })}
              disabled={!key.trim()}
              className="flex-1 bg-gray-900 text-white py-1.5 rounded text-xs font-medium hover:bg-black disabled:opacity-40 transition-colors"
            >
              {hasKey ? '更新' : '保存'}
            </button>
            {hasKey && (
              <button onClick={clear} className="text-xs text-gray-400 hover:text-red-500 px-2">清除</button>
            )}
          </div>

          <p className="text-[10px] text-gray-400 leading-relaxed">
            Key 仅存浏览器本地，不上传服务器。不填 Key 则使用平台提供的免费额度。
          </p>
        </div>
      )}
    </div>
  );
}
