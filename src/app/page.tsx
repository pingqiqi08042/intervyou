'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/fetch-with-key';

export default function HomePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [jdTitle, setJdTitle] = useState('');
  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [error, setError] = useState('');
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [diagnosis, setDiagnosis] = useState<any>(null);

  async function handleUpload() {
    if (!file && !pasteText.trim()) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      if (pasteText.trim()) {
        // Create a proper File from pasted text
        const textFile = new File([pasteText], 'resume.md', { type: 'text/markdown' });
        formData.append('file', textFile);
      } else if (file) {
        formData.append('file', file);
      }
      if (jdText.trim()) {
        formData.append('jdText', jdText.trim());
        formData.append('jdTitle', jdTitle.trim());
      }
      const res = await apiFetch('/api/resumes', { method: 'POST', body: formData });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || '上传失败'); }
      const data = await res.json();
      setResumeId(data.id);
      setPreview(data.parsedData);
      runDiagnosis(data.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function runDiagnosis(id: string) {
    setDiagnosing(true);
    try {
      const res = await apiFetch(`/api/resumes/${id}/diagnose`);
      if (res.ok) setDiagnosis(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setDiagnosing(false);
    }
  }

  // ─── 结果页：简历预览 + 诊断报告 ────────────────────────
  if (resumeId && preview) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {/* 简历预览 */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h2 className="font-semibold text-base mb-3">简历解析完成</h2>
          <div className="text-sm text-gray-600 space-y-1">
            <p className="font-medium text-gray-900">{preview.name}
              {preview.education?.[0] && <span className="font-normal text-gray-500"> · {preview.education[0].school} · {preview.education[0].major}</span>}
            </p>
            {preview.experiences?.slice(0, 3).map((exp: any, i: number) => (
              <p key={i} className="text-gray-500">{exp.company} — {exp.role}</p>
            ))}
          </div>
        </div>

        {/* 诊断 loading */}
        {diagnosing && (
          <div className="bg-white rounded-xl p-8 shadow-sm border text-center">
            <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mb-3" />
            <p className="text-sm text-gray-500">正在分析简历...</p>
          </div>
        )}

        {/* 诊断结果 */}
        {diagnosis && !diagnosing && (
          <div className="bg-white rounded-xl p-6 shadow-sm border space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">诊断报告</h2>
              <span className="text-2xl font-bold text-blue-600">{diagnosis.overallScore}</span>
            </div>

            {/* 维度评分条 */}
            {diagnosis.dimensionScores && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {Object.entries(diagnosis.dimensionScores).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 text-xs w-16 shrink-0">{k}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1">
                      <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${v}%` }} />
                    </div>
                    <span className="font-mono text-xs w-6 text-right">{v as number}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 风险点 */}
            {diagnosis.highRisks?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-red-600 mb-2">面试风险</h3>
                <div className="space-y-2">
                  {diagnosis.highRisks.map((r: any, i: number) => (
                    <div key={i} className="text-sm bg-red-50 border border-red-100 p-3 rounded-lg">
                      <p className="font-medium text-gray-900">"{r.quote}"</p>
                      <p className="text-gray-600 mt-1">{r.risk}</p>
                      <p className="text-gray-700 mt-1 text-xs">{r.fix}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 改写建议 */}
            {diagnosis.rewrites?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-amber-600 mb-2">改写建议</h3>
                <div className="space-y-2">
                  {diagnosis.rewrites.map((rw: any, i: number) => (
                    <div key={i} className="text-sm bg-amber-50 border border-amber-100 p-3 rounded-lg">
                      <p className="text-gray-400 line-through text-xs">原文：{rw.original}</p>
                      <p className="text-gray-900 mt-1">改写：{rw.improved}</p>
                      <p className="text-gray-500 text-xs mt-1">{rw.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 操作 */}
        <button
          onClick={() => router.push(`/setup?resumeId=${resumeId}&name=${encodeURIComponent(preview.name)}`)}
          className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          开始模拟面试
        </button>
        <button
          onClick={() => router.push(`/optimize?resumeId=${resumeId}&mode=diagnosis`)}
          className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-black transition-colors"
        >
          基于诊断优化简历
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => { setResumeId(null); setPreview(null); setDiagnosis(null); setFile(null); setPasteText(''); }}
            className="flex-1 border py-3 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            重新上传
          </button>
          <button
            onClick={() => { setResumeId(null); setPreview(null); setDiagnosis(null); setFile(null); setPasteText(''); }}
            className="flex-1 bg-gray-100 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
          >
            保存并退出
          </button>
        </div>
      </div>
    );
  }

  // ─── 上传页 ──────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-center mb-2">IntervYOU</h1>
      <p className="text-center text-gray-500 text-sm mb-10">诊断简历 + 模拟面试 + 复盘提升</p>

      {/* 上传 / 粘贴 */}
      <div className="bg-white rounded-xl shadow-sm border mb-5 overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => { setInputMode('file'); setPasteText(''); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${inputMode === 'file' ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50' : 'text-gray-400 hover:text-gray-600'}`}
          >上传文件</button>
          <button
            onClick={() => { setInputMode('paste'); setFile(null); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${inputMode === 'paste' ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50' : 'text-gray-400 hover:text-gray-600'}`}
          >粘贴文字</button>
        </div>

        {inputMode === 'file' ? (
          <div className="p-8">
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              <input id="fileInput" type="file" accept=".pdf,.doc,.docx,.md,.txt" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
              <div className="text-gray-400 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium text-sm">{file ? file.name : '点击或拖拽上传'}</p>
              <p className="text-gray-400 text-xs mt-1">PDF / Word / Markdown</p>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="直接粘贴简历文字...&#10;&#10;支持 Markdown 格式，也可以粘贴纯文本。&#10;从招聘网站或 Word 复制过来即可。"
              rows={10}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-400 resize-y"
            />
          </div>
        )}
      </div>

      {/* JD */}
      <div className="bg-white rounded-xl p-5 shadow-sm border mb-5">
        <h3 className="text-sm font-medium text-gray-700 mb-3">目标岗位（选填）</h3>
        <input
          type="text" value={jdTitle} onChange={(e) => setJdTitle(e.target.value)}
          placeholder="岗位名称，如：AI 产品经理（校招）"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400"
        />
        <textarea
          value={jdText} onChange={(e) => setJdText(e.target.value)}
          placeholder="粘贴目标岗位 JD，诊断会更精准——匹配度、关键词覆盖、针对性建议"
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
        />
      </div>

      <button onClick={handleUpload} disabled={loading || (!file && !pasteText.trim())}
        className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {loading ? '解析中...' : '开始分析'}
      </button>

      {error && <p className="mt-4 text-red-500 text-center text-sm">{error}</p>}

      {/* 诊断记录 */}
      <DiagnosisRecords />
    </div>
  );
}

function DiagnosisRecords() {
  const [records, setRecords] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [diagnosisCache, setDiagnosisCache] = useState<Record<string, any>>({});
  const router = useRouter();

  useEffect(() => {
    apiFetch('/api/resumes/list')
      .then((r) => r.json())
      .then((d) => {
        const withDiag = (d.resumes || []).filter((r: any) => r.hasDiagnosis);
        setRecords(withDiag);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!diagnosisCache[id]) {
      const res = await apiFetch(`/api/resumes/${id}/diagnose`);
      if (res.ok) {
        const data = await res.json();
        setDiagnosisCache((prev) => ({ ...prev, [id]: data }));
      }
    }
  }

  if (!loaded || records.length === 0) return null;

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border mt-5">
      <h3 className="text-sm font-medium text-gray-700 mb-3">诊断记录</h3>
      <div className="space-y-2">
        {records.map((r: any) => {
          const diag = diagnosisCache[r.id];
          return (
            <div key={r.id}>
              <button
                onClick={() => toggleExpand(r.id)}
                className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{r.name}</span>
                  <div className="flex items-center gap-2">
                    {diag?.overallScore && (
                      <span className="text-sm font-bold text-blue-600">{diag.overallScore}</span>
                    )}
                    <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">{r.fileName}</p>
              </button>
              {expandedId === r.id && diag && (
                <div className="bg-gray-50 rounded-lg p-4 mt-1 space-y-2 text-sm">
                  <button
                    onClick={async () => {
                      if (!confirm('删除这条诊断记录？')) return;
                      await apiFetch(`/api/resumes/${r.id}/diagnose`, { method: 'DELETE' });
                      setRecords((prev) => prev.filter((x) => x.id !== r.id));
                      setExpandedId(null);
                    }}
                    className="text-xs text-gray-400 hover:text-red-500 float-right"
                  >删除</button>
                  {diag.highRisks?.slice(0, 3).map((risk: any, i: number) => (
                    <div key={i} className="text-red-700 text-xs">
                      <span className="font-medium">"{risk.quote}"</span> — {risk.risk}
                    </div>
                  ))}
                  {diag.rewrites?.slice(0, 2).map((rw: any, i: number) => (
                    <div key={i} className="text-xs">
                      <span className="text-gray-400 line-through">{rw.original}</span>
                      <span className="text-gray-700 ml-2">→ {rw.improved}</span>
                    </div>
                  ))}
                  <button
                    onClick={() => router.push(`/optimize?resumeId=${r.id}&mode=diagnosis`)}
                    className="text-blue-600 text-xs hover:underline">
                    基于此诊断优化简历 →
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
