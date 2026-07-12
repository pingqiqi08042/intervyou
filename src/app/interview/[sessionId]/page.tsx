'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/fetch-with-key';
import { useVoice } from '@/hooks/useVoice';

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export default function InterviewPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [sendError, setSendError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const voice = useVoice();
  const candidateCountRef = useRef(0);

  // 语音转文字 → 追加到输入框
  useEffect(() => {
    if (voice.transcript && !voice.listening) {
      setInput((prev) => (prev ? prev + voice.transcript : voice.transcript));
      voice.clearError();
    }
  }, [voice.listening]);

  // 语音错误 3 秒后自动清除
  useEffect(() => {
    if (voice.error) {
      const t = setTimeout(() => voice.clearError(), 3000);
      return () => clearTimeout(t);
    }
  }, [voice.error]);

  // 加载开场白
  useEffect(() => {
    apiFetch(`/api/sessions/${params.sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.messages) setMessages(data.messages);
        if (data.status === 'completed') setIsComplete(true);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || sending || isComplete) return;

    const userInput = input;
    setInput('');
    setSending(true);

    // 乐观更新
    const tempId = `temp-${Date.now()}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      role: 'candidate',
      content: userInput,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await apiFetch(
        `/api/sessions/${params.sessionId}/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: userInput }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '发送失败');
      }

      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      candidateCountRef.current += 1;
      setSendError('');

      // 至少 3 轮问答后才允许 Agent 主动结束
      if (data.isComplete && candidateCountRef.current >= 3) {
        setIsComplete(true);
      }
    } catch (e: any) {
      // 发送失败：移除临时消息，恢复输入，显示错误
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(userInput);
      setSendError(e.message || '发送失败，请重试');
      setTimeout(() => setSendError(''), 4000);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-400">Loading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-1px)] flex flex-col">
      {/* 顶部状态栏 */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold text-sm">{isComplete ? '面试结束' : '面试进行中'}</h2>
        <div className="flex items-center gap-2">
          {!isComplete && (
            <button
              onClick={() => setShowExit(true)}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition-colors"
            >
              退出
            </button>
          )}
          {isComplete && (
            <span className="text-xs text-gray-400">可在面试记录中查看</span>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages
          .filter((m) => m.role !== 'system')
          .map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === 'interviewer'
                  ? 'justify-start'
                  : 'justify-end'
              }`}
            >
              <div
                className={
                  msg.role === 'interviewer'
                    ? 'chat-bubble-interviewer'
                    : 'chat-bubble-candidate'
                }
              >
                {msg.role === 'interviewer' && (
                  <span className="text-xs text-gray-400 block mb-1">
                    面试官
                  </span>
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

        {sending && (
          <div className="flex justify-start">
            <div className="chat-bubble-interviewer">
              <div className="typing-indicator">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* 底部输入区 */}
      <div className="border-t bg-white p-4">
        {isComplete ? (
          <button
            onClick={() =>
              router.push(`/report/${params.sessionId}`)
            }
            className="w-full bg-blue-500 text-white py-3 rounded-xl font-medium hover:bg-blue-600 transition-colors"
          >
            查看复盘报告
          </button>
        ) : (
          <>
            <div className="flex gap-2 items-end relative">
              {voice.isSupported && (
                <button
                  onClick={() => voice.listening ? voice.stop() : voice.start()}
                  title={voice.listening ? '停止录音' : '语音输入'}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 mb-0.5 ${
                    voice.listening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'border border-gray-300 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                </button>
              )}
              {voice.error && (
                <span className="absolute -top-6 left-12 text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">{voice.error}</span>
              )}
              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    e.stopPropagation();
                    sendMessage();
                  }
                }}
                placeholder={voice.listening ? '正在聆听...' : '输入你的回答... Enter 发送，Shift+Enter 换行'}
                disabled={sending || voice.listening}
                rows={1}
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50 resize-none"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="bg-blue-500 text-white px-5 py-3 rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors shrink-0"
              >
                发送
              </button>
            </div>
            {sendError && (
              <p className="text-xs text-red-500 mt-1">{sendError}</p>
            )}
          </>
        )}
      </div>

      {/* 退出弹窗 */}
      {showExit && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowExit(false)}>
          <div className="bg-white rounded-2xl p-6 w-80 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-4">退出面试</h3>
            <div className="space-y-2">
              <button
                onClick={async () => {
                  await apiFetch(`/api/sessions/${params.sessionId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'completed' }),
                  });
                  router.push(`/report/${params.sessionId}`);
                }}
                className="w-full text-left p-3 rounded-xl border border-red-200 hover:bg-red-50 transition-colors"
              >
                <div className="font-medium text-sm text-red-600">终止面试</div>
                <div className="text-xs text-gray-500 mt-0.5">结束并生成复盘报告</div>
              </button>
              <button
                onClick={() => router.push('/history')}
                className="w-full text-left p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-sm">暂时退出</div>
                <div className="text-xs text-gray-500 mt-0.5">保留进度，稍后继续</div>
              </button>
              <button
                onClick={() => setShowExit(false)}
                className="w-full text-center py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
