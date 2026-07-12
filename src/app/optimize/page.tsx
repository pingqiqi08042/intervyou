'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/fetch-with-key';

interface ResumeItem { id: string; fileName: string; name: string; hasDiagnosis: boolean; }
interface SessionItem { id: string; mode: string; difficulty: string; score: number | null; createdAt: string; }

function OptimizeContent() {
  const searchParams = useSearchParams();
  const presetResumeId = searchParams.get('resumeId') || '';
  const presetMode = searchParams.get('mode') || 'both';

  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(presetResumeId);
  const [mode, setMode] = useState(presetMode);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [docxBase64, setDocxBase64] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch('/api/resumes/list')
      .then((r) => r.json())
      .then((d) => {
        const list = (d.resumes || []).map((r: any) => ({ ...r, hasDiagnosis: !!r.hasDiagnosis }));
        setResumes(list);
        if (list.length && !presetResumeId) setSelectedId(list[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // 切换简历时加载其面试记录
  useEffect(() => {
    if (!selectedId) return;
    apiFetch('/api/history')
      .then((r) => r.json())
      .then((d) => {
        const related = (d.sessions || []).filter((s: any) => {
          // 找到属于当前简历的 session（通过 name 匹配不太准确，简单全量返回）
          return s.status === 'completed';
        });
        setSessions(related);
        if (related.length) setSelectedSessionId(related[0].id);
      })
      .catch(console.error);
  }, [selectedId]);

  const pickerRef = useRef<HTMLDivElement>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  async function generate() {
    if (!selectedId) return;
    const useInterview = mode === 'interview' || mode === 'both';
    const useDiagnosis = mode === 'diagnosis' || mode === 'both';
    if (useInterview && !selectedSessionId) return;

    setGenerating(true);
    setMarkdown(''); setDocxBase64('');
    try {
      const res = await apiFetch(`/api/resumes/${selectedId}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          format: 'docx',
          sessionId: useInterview ? selectedSessionId : undefined,
          useDiagnosis,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMarkdown(data.markdown);
        setDocxBase64(data.docxBase64 || '');
      }
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  }

  function downloadMd() {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'resume.md'; a.click();
  }

  function downloadDoc() {
    if (!docxBase64) return;
    const bytes = Uint8Array.from(atob(docxBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'resume.docx'; a.click();
  }

  async function deleteResume(id: string) {
    if (!confirm('删除后无法恢复，确定吗？')) return;
    await apiFetch(`/api/resumes/${id}`, { method: 'DELETE' });
    setResumes((prev) => prev.filter((r) => r.id !== id));
    if (selectedId === id) { setSelectedId(''); setMarkdown(''); setDocxBase64(''); }
  }

  const MODES = [
    { key: 'diagnosis', label: '仅诊断', desc: '简历分析结果' },
    { key: 'interview', label: '仅面试', desc: '面试反馈' },
    { key: 'both', label: '综合', desc: '诊断 + 面试' },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h2 className="text-lg font-bold mb-1">优化简历</h2>
      <p className="text-sm text-gray-500 mb-6">选择数据源和记录，生成后选择格式下载</p>

      {resumes.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border text-center">
          <p className="text-gray-400 text-sm">暂无简历</p>
        </div>
      ) : (
        <>
          {/* Mode */}
          <div className="mb-5">
            <h3 className="text-sm font-medium text-gray-700 mb-2">数据源</h3>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => (
                <button key={m.key} onClick={() => setMode(m.key)}
                  className={`p-3 rounded-xl border text-center transition-colors ${
                    mode === m.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <div className="text-sm font-medium">{m.label}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Resume + Session picker */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {resumes.map((r) => (
              <div key={r.id}
                className={`relative group text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                  selectedId === r.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                onClick={() => setSelectedId(r.id)}>
                <p className="font-medium text-sm truncate pr-6">{r.name}</p>
                <p className="text-xs text-gray-400 truncate">{r.fileName}</p>
                <button onClick={(e) => { e.stopPropagation(); deleteResume(r.id); }}
                  className="absolute top-2 right-2 w-5 h-5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
              </div>
            ))}
          </div>

          {/* Interview session picker — only when mode involves interview */}
          {(mode === 'interview' || mode === 'both') && (
            <div className="mb-6" ref={pickerRef}>
              <h3 className="text-sm font-medium text-gray-700 mb-2">选择面试记录</h3>
              {sessions.length === 0 ? (
                <p className="text-xs text-gray-400">暂无已完成的面试记录</p>
              ) : (
                <div className="relative">
                  <button onClick={() => setSessionOpen(!sessionOpen)}
                    className="w-full flex items-center justify-between border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm hover:border-gray-300 transition-colors">
                    <span className="truncate">
                      {selectedSession
                        ? `${selectedSession.mode} · ${selectedSession.difficulty} · ${selectedSession.score ?? '-'}分 · ${new Date(selectedSession.createdAt).toLocaleDateString('zh-CN')}`
                        : '选择面试记录'}
                    </span>
                    <span className={`text-gray-400 text-xs transition-transform shrink-0 ml-2 ${sessionOpen ? 'rotate-180' : ''}`}>&#9660;</span>
                  </button>
                  {sessionOpen && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {sessions.map((s) => (
                        <button key={s.id}
                          onClick={() => { setSelectedSessionId(s.id); setSessionOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                            s.id === selectedSessionId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                          }`}>
                          <span>{s.mode} · {s.difficulty}</span>
                          <span className="ml-2 text-xs text-gray-400">{s.score ?? '-'}分 · {new Date(s.createdAt).toLocaleDateString('zh-CN')}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Diagnosis + interview status */}
          {(mode === 'diagnosis' || mode === 'both') && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">诊断记录</h3>
              {resumes.find((r) => r.id === selectedId)?.hasDiagnosis ? (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
                  已诊断 · 将使用该简历的诊断结果
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700">
                  该简历尚未诊断，请先在首页上传并分析
                </div>
              )}
            </div>
          )}

          <button onClick={generate} disabled={generating || !selectedId}
            className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-black disabled:opacity-40 transition-colors mb-8">
            {generating ? '生成中...' : '生成优化简历'}
          </button>
        </>
      )}

      {generating && (
        <div className="bg-white rounded-xl p-8 shadow-sm border text-center mb-6">
          <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mb-2" />
          <p className="text-sm text-gray-500">正在生成...</p>
        </div>
      )}

      {markdown && (
        <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">预览</h3>
            <button onClick={() => { navigator.clipboard.writeText(markdown); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="border border-gray-300 px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors">
              {copied ? '已复制' : '复制'}
            </button>
          </div>
          <div className="bg-gray-50 rounded-lg p-5 max-h-[60vh] overflow-y-auto">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{markdown}</pre>
          </div>
          {/* Download buttons below */}
          <div className="flex gap-3 pt-2">
            <button onClick={downloadMd}
              className="flex-1 border border-gray-300 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              下载 Markdown (.md)
            </button>
            <button onClick={downloadDoc}
              className="flex-1 bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-black transition-colors">
              下载 Word (.doc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OptimizePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" /></div>}>
      <OptimizeContent />
    </Suspense>
  );
}
