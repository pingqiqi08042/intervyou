'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/fetch-with-key';
import RadarChart from '@/components/RadarChart';

export default function ReportPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resumeId, setResumeId] = useState('');

  useEffect(() => {
    // 加载 session 信息（获取 resumeId）+ 复盘报告
    apiFetch(`/api/sessions/${params.sessionId}`)
      .then((r) => r.json())
      .then((data) => { if (data.id) setResumeId(data.resumeId || ''); })
      .catch(() => {});

    apiFetch(`/api/sessions/${params.sessionId}/feedback`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '获取报告失败');
        }
        return res.json();
      })
      .then((data) => setFeedback(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-400">正在生成复盘报告...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => router.push('/')}
          className="text-blue-500 underline"
        >
          返回首页
        </button>
      </div>
    );
  }

  if (!feedback) return null;

  const dims = feedback.dimensionScores || {};
  const dimLabels: Record<string, string> = {
    starCompleteness: 'STAR完整性',
    quantification: '量化能力',
    logicClarity: '逻辑清晰度',
    technicalDepth: '技术深度',
    communication: '沟通表达',
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-center mb-2">面试复盘报告</h1>
      <p className="text-center text-gray-500 mb-8">
        总体评分
      </p>

      {/* 总评分 */}
      <div className="text-center mb-8">
        <div className="text-5xl font-bold text-blue-500">
          {feedback.overallScore}
        </div>
        <div className="text-gray-400 text-sm">/ 100</div>
      </div>

      {/* 维度评分 — 雷达图 + 进度条 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border mb-6">
        <h3 className="font-semibold mb-4">能力维度</h3>
        <RadarChart data={dims} />
        <div className="grid grid-cols-5 gap-2 mt-4">
          {Object.entries(dims).map(([key, score]) => (
            <div key={key} className="text-center">
              <div className="text-xs text-gray-500">{dimLabels[key] || key}</div>
              <div className="text-sm font-bold text-gray-900">{score as number}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 优势 */}
      {feedback.strengths?.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border mb-6">
          <h3 className="font-semibold mb-3">优势</h3>
          <ul className="space-y-2">
            {feedback.strengths.map((s: string, i: number) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2">
                <span className="text-gray-300">—</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 改进建议 */}
      {feedback.improvements?.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border mb-6">
          <h3 className="font-semibold mb-3">待改进</h3>
          <div className="space-y-4">
            {feedback.improvements.map((imp: any, i: number) => (
              <div key={i} className="text-sm">
                <p className="font-medium text-red-600">{imp.issue}</p>
                <p className="text-gray-600 mt-1">{imp.suggestion}</p>
                {imp.rewriteExample && (
                  <p className="text-gray-500 mt-1 italic bg-gray-50 p-2 rounded">
                    — {imp.rewriteExample}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 简历建议 */}
      {feedback.resumeSuggestions?.length > 0 && (
        <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200 mb-6">
          <h3 className="font-semibold mb-3">简历改进建议</h3>
          <div className="space-y-3">
            {feedback.resumeSuggestions.map((rs: any, i: number) => (
              <div key={i} className="text-sm">
                <p className="font-medium">{rs.experienceReference}</p>
                <p className="text-gray-600">{rs.issue}</p>
                <p className="text-gray-700 mt-1">{rs.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 优化简历入口 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border mb-6">
        <h3 className="font-semibold mb-2">优化简历</h3>
        <p className="text-sm text-gray-500 mb-4">基于面试反馈生成优化简历，支持诊断 / 仅面试 / 综合三种模式。</p>
        <button
          onClick={() => router.push(`/optimize?resumeId=${resumeId}&mode=both`)}
          className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-black transition-colors"
        >
          去优化简历
        </button>
      </div>

      {/* 操作 */}
      <div className="flex gap-3">
        <button
          onClick={() => router.push('/')}
          className="flex-1 border border-gray-300 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
        >
          返回首页
        </button>
        <button
          onClick={() => router.push('/setup')}
          className="flex-1 bg-blue-500 text-white py-3 rounded-xl font-medium hover:bg-blue-600 transition-colors"
        >
          再练一次
        </button>
      </div>
    </main>
  );
}
