'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/fetch-with-key';

const MODES = [
  { key: 'resume_deep_dive', label: '简历深挖', desc: '每段经历四层递进追问', rounds: '8-12 轮' },
  { key: 'behavioral', label: '行为面试', desc: 'STAR 软技能专项训练', rounds: '6-8 轮' },
  { key: 'comprehensive', label: '综合模拟', desc: '全流程真实面试', rounds: '12-15 轮' },
];

const DIFFICULTIES = [
  { key: 'guided', label: '引导', desc: '帮助梳理，新手友好' },
  { key: 'standard', label: '标准', desc: '大厂面试，专业评估' },
  { key: 'pressure', label: '压力', desc: '极限追问，高压训练' },
];

interface ResumeItem { id: string; fileName: string; name: string; }

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetId = searchParams.get('resumeId') || '';
  const presetName = searchParams.get('name') || '';

  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [resumeId, setResumeId] = useState(presetId);
  const [mode, setMode] = useState('comprehensive');
  const [difficulty, setDifficulty] = useState('standard');
  const [jobRole, setJobRole] = useState('auto');
  const [jdText, setJdText] = useState('');
  const [jdTitle, setJdTitle] = useState('');
  const [jobPanelOpen, setJobPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const JOB_ROLES = ['auto', 'backend', 'frontend', 'product', 'data', 'ops'] as const;
  const JOB_LABELS: Record<string, string> = {
    auto: '自动', backend: '后端', frontend: '前端', product: '产品',
    data: '数据', ops: '运营',
  };

  useEffect(() => {
    apiFetch('/api/resumes/list')
      .then((r) => r.json())
      .then((d) => {
        setResumes(d.resumes || []);
        if (!presetId && d.resumes?.length) setResumeId(d.resumes[0].id);
      })
      .catch(console.error)
      .finally(() => setLoadingResumes(false));
  }, []);

  async function startInterview() {
    if (!resumeId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId, mode, difficulty, jobRole, jdText: jdText.trim(), jdTitle: jdTitle.trim() }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error); }
      const data = await res.json();
      router.push(`/interview/${data.sessionId}`);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  if (loadingResumes) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (resumes.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-6 py-10 text-center">
        <div className="bg-white rounded-xl p-10 shadow-sm border">
          <p className="text-gray-500 text-sm mb-4">还没有简历，请先上传</p>
          <button onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            去上传简历
          </button>
        </div>
      </div>
    );
  }

  const selected = resumes.find((r) => r.id === resumeId);

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <h2 className="text-xl font-bold text-center mb-8">
        {presetName || selected?.name || '选择简历'}，准备面试
      </h2>

      {/* 简历选择 — 紧凑下拉 */}
      <div className="mb-7">
        <h3 className="text-sm font-medium text-gray-700 mb-2">选择简历</h3>
        <ResumePicker resumes={resumes} selectedId={resumeId} onSelect={setResumeId} />
      </div>

      {/* 岗位 & JD — 可折叠 */}
      <div className="mb-7 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setJobPanelOpen(!jobPanelOpen)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-700">岗位 &amp; JD</span>
            <span className="text-xs text-gray-400">
              {jobRole === 'auto' ? '自动检测' : JOB_LABELS[jobRole] || jobRole}
              {jdText && ' · 已填JD'}
            </span>
          </div>
          <span className={`text-gray-400 text-xs transition-transform ${jobPanelOpen ? 'rotate-90' : ''}`}>&#8250;</span>
        </button>

        {jobPanelOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
            {/* 岗位选择 */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-2">目标岗位</h4>
              <div className="grid grid-cols-4 gap-1.5">
                {JOB_ROLES.map((r) => (
                  <button key={r} onClick={() => setJobRole(r)}
                    className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                      jobRole === r ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-150 bg-white text-gray-600 hover:border-gray-300'
                    }`}>
                    {JOB_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            {/* JD 输入 */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-2">JD（选填）</h4>
              <input
                type="text" value={jdTitle} onChange={(e) => setJdTitle(e.target.value)}
                placeholder="岗位名称，如：AI 产品经理（校招）"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs mb-2 focus:outline-none focus:border-blue-400"
              />
              <textarea
                value={jdText} onChange={(e) => setJdText(e.target.value)}
                placeholder="粘贴 JD 内容...&#10;面试将围绕 JD 的关键要求展开针对性提问"
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* 模式 */}
      <div className="mb-7">
        <h3 className="text-sm font-medium text-gray-700 mb-3">面试模式</h3>
        <div className="space-y-2">
          {MODES.map((m) => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={`w-full text-left p-4 rounded-xl border transition-colors ${
                mode === m.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{m.label}</span>
                <span className="text-xs text-gray-400">{m.rounds}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 难度 */}
      <div className="mb-8">
        <h3 className="text-sm font-medium text-gray-700 mb-3">难度等级</h3>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => (
            <button key={d.key} onClick={() => setDifficulty(d.key)}
              className={`p-3 rounded-xl border text-center transition-colors ${
                difficulty === d.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}>
              <div className="text-sm font-medium">{d.label}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{d.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-4 text-red-500 text-center text-sm">{error}</p>}

      <button onClick={startInterview} disabled={loading || !resumeId}
        className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {loading ? '准备中...' : '开始面试'}
      </button>
    </div>
  );
}

function ResumePicker({
  resumes, selectedId, onSelect,
}: {
  resumes: ResumeItem[]; selectedId: string; onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = resumes.find((r) => r.id === selectedId);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm hover:border-gray-300 transition-colors"
      >
        <span className="truncate">{selected ? `${selected.name} · ${selected.fileName}` : '选择简历'}</span>
        <span className={`text-gray-400 text-xs transition-transform shrink-0 ml-2 ${open ? 'rotate-180' : ''}`}>&#9660;</span>
      </button>
      {open && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {resumes.map((r) => (
            <button key={r.id}
              onClick={() => { onSelect(r.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                r.id === selectedId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}>
              <span className="font-medium">{r.name}</span>
              <span className="text-gray-400 ml-2 text-xs">{r.fileName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" /></div>}>
      <SetupContent />
    </Suspense>
  );
}
