'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/fetch-with-key';

const MODE_LABELS: Record<string, string> = {
  resume_deep_dive: '简历深挖', behavioral: '行为面试',
  technical: '技术面试', comprehensive: '综合模拟',
};

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    apiFetch('/api/history')
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function deleteSession(id: string) {
    if (!confirm('删除这条面试记录？')) return;
    await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h2 className="text-lg font-bold mb-6">面试记录</h2>
      {sessions.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border text-center">
          <p className="text-gray-400 text-sm">暂无面试记录</p>
          <button onClick={() => router.push('/')} className="mt-4 text-blue-600 text-sm hover:underline">上传简历开始第一次面试</button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.id} onClick={() => { if (s.status === 'completed') router.push(`/report/${s.id}`); else router.push(`/interview/${s.id}`); }}
              className="relative group bg-white rounded-xl p-4 shadow-sm border hover:border-blue-300 cursor-pointer transition-colors">
              <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                className="absolute top-2 right-2 w-5 h-5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
              <div className="flex items-center justify-between">
                <div><span className="font-medium text-sm">{s.name}</span><span className="text-gray-400 text-xs ml-2">{MODE_LABELS[s.mode] || s.mode} · {s.difficulty}</span></div>
                <div className="flex items-center gap-3">
                  {s.score != null && <span className="text-sm font-bold text-blue-600">{s.score}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded ${s.status === 'completed' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-600'}`}>{s.status === 'completed' ? '已完成' : '继续面试'}</span>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-1">{new Date(s.createdAt).toLocaleString('zh-CN')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
