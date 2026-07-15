'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReviewPage({ params }: { params: { sessionId: string } }) {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sessions/${params.sessionId}`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.sessionId]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">面试回看</h2>
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">返回</button>
      </div>
      <div className="space-y-4">
        {messages.filter((m: any) => m.role !== 'system').map((msg: any) => (
          <div key={msg.id} className={`flex ${msg.role === 'interviewer' ? 'justify-start' : 'justify-end'}`}>
            <div className={msg.role === 'interviewer'
              ? 'bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[75%]'
              : 'bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[75%]'
            }>
              <span className="text-xs opacity-50 block mb-1">{msg.role === 'interviewer' ? '面试官' : '候选人'}</span>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
