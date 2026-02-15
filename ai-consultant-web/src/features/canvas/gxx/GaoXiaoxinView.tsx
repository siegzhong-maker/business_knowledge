'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAgentStore } from '@/lib/store';
import { agents } from '@/features/agents/config';
import { formatGxxSummaryForCopy } from '@/features/export/ExportToolbar';
import { Target, Radar as RadarIcon, Lightbulb, LayoutDashboard, ArrowRight, RotateCcw, Sparkles, Trophy, Sprout, TrendingUp, Copy, MoreHorizontal } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMPTY_PLACEHOLDER = '等待输入...';
function isFilled(v: unknown): boolean {
  return v != null && v !== '' && v !== EMPTY_PLACEHOLDER;
}

const FIELD_EMPTY_HINT = '点击填写或从对话提取';

const NEXT_STEP_ORDER: { key: 'product' | 'target' | 'price' | 'niche' | 'diff'; label: string; example: string }[] = [
  { key: 'product', label: '产品/服务形态', example: '我的产品是________，主要面向________。' },
  { key: 'target', label: '目标客群', example: '我的目标客群是________，核心痛点是________。' },
  { key: 'price', label: '利润天花板', example: '客单价约 5万/年，订阅制，不算高频刚需' },
  { key: 'niche', label: '破局切入点', example: '先做一线城市律所合伙人，他们查阅法条最频繁' },
  { key: 'diff', label: '核心差异化', example: '主打无摄像头隐私设计，客户在敏感场合也能用' },
];

function getNextStepSuggestion(data: { product?: string; target?: string; price?: string; niche?: string; diff?: string }): { label: string; example: string } | null {
  const filled = (v: unknown) => v != null && v !== '' && v !== '等待输入...';
  for (const step of NEXT_STEP_ORDER) {
    if (!filled(data[step.key])) {
      return { label: step.label, example: step.example };
    }
  }
  return null;
}

const CANVAS_PERSIST_DEBOUNCE_MS = 400;

export function GaoXiaoxinView() {
  const data = useAgentStore((state) => state.canvasData.gxx);
  const updateCanvasData = useAgentStore((state) => state.updateCanvasData);
  const resetCanvas = useAgentStore((state) => state.resetCanvas);
  const setPendingExtractMessage = useAgentStore((state) => state.setPendingExtractMessage);
  const sessionId = useAgentStore((state) => state.sessionId);
  const anonymousId = useAgentStore((state) => state.anonymousId);
  const chatLoading = useAgentStore((state) => state.chatLoading);
  const prevFieldsRef = useRef<Record<string, unknown>>({});
  const persistTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPersistRef = useRef<Record<string, unknown> | null>(null);
  const [flashingField, setFlashingField] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const persistCanvasToDb = useCallback(
    (patch: Record<string, unknown>) => {
      if (!sessionId || !anonymousId) return;
      pendingPersistRef.current = { ...(pendingPersistRef.current ?? {}), ...patch };
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null;
        const toSend = pendingPersistRef.current;
        pendingPersistRef.current = null;
        if (!toSend) return;
        
        fetch(
            `/api/sessions/${encodeURIComponent(sessionId)}/canvas?anonymousId=${encodeURIComponent(anonymousId)}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: toSend }),
              keepalive: true,
            }
          ).catch(e => console.warn('Failed to persist canvas:', e));
      }, CANVAS_PERSIST_DEBOUNCE_MS);
    },
    [sessionId, anonymousId]
  );

  const handleCanvasEdit = useCallback(
    (patch: Record<string, unknown>) => {
      updateCanvasData('gxx', patch);
      persistCanvasToDb(patch);
    },
    [updateCanvasData, persistCanvasToDb]
  );

  const handleResetCanvas = useCallback(() => {
    if (!confirm('确定要重置画布吗？所有已填写的诊断内容将被清空。')) return;
    const initialState = agents.gxx.initialState as Record<string, unknown>;
    resetCanvas('gxx');
    if (sessionId && anonymousId) {
      fetch(
        `/api/sessions/${encodeURIComponent(sessionId)}/canvas?anonymousId=${encodeURIComponent(anonymousId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: initialState }),
        }
      ).catch((e) => console.warn('Failed to persist canvas reset:', e));
    }
  }, [resetCanvas, sessionId, anonymousId]);

  const handleExtractFromChat = useCallback(() => {
    setPendingExtractMessage('请根据当前对话历史重新提取并更新画布所有字段。务必调用 updateCanvas 填写 scores: { high, small, new }（各 0-5 分）、summary、actionList、scoreReasons，用于生成雷达图与诊断，不可省略。');
  }, [setPendingExtractMessage]);

  const handleCompleteDiagnosis = useCallback(() => {
    setPendingExtractMessage('请根据当前对话历史重新提取并更新画布所有字段。务必调用 updateCanvas 填写 summary、actionList、scores: { high, small, new }（各 0-5 分）、scoreReasons，四者缺一不可。');
  }, [setPendingExtractMessage]);

  const handleFollowUpConsultation = useCallback(() => {
    setPendingExtractMessage('我已完成部分行动建议，想更新诊断。请根据当前画布（含已勾选的行动）和对话历史，重新评估并调用 updateCanvas 更新 summary、actionList、scores。务必提供 scores 用于雷达图。');
  }, [setPendingExtractMessage]);

  const handleCopySummary = useCallback(async () => {
    const text = formatGxxSummaryForCopy(data);
    try {
      await navigator.clipboard.writeText(text);
      const el = document.createElement('div');
      el.textContent = '已复制诊断摘要';
      el.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg z-[60]';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2000);
    } catch {
      // ignore
    }
  }, [data]);

  // Flush pending changes on unmount or session change
  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      if (pendingPersistRef.current && sessionId && anonymousId) {
        // Flush pending data using keepalive
        const toSend = pendingPersistRef.current;
        pendingPersistRef.current = null;
        fetch(
          `/api/sessions/${encodeURIComponent(sessionId)}/canvas?anonymousId=${encodeURIComponent(anonymousId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: toSend }),
            keepalive: true,
          }
        ).catch(e => console.warn('Failed to flush canvas on unmount:', e));
      }
    };
  }, [sessionId, anonymousId]);

  const fieldsToTrack = ['product', 'target', 'price', 'niche', 'diff'] as const;
  useEffect(() => {
    let fieldToFlash: string | null = null;
    for (const key of fieldsToTrack) {
      const curr = data[key];
      const prev = prevFieldsRef.current[key];
      prevFieldsRef.current[key] = curr;
      if (prev !== undefined && curr !== prev) {
        fieldToFlash = fieldToFlash ?? key;
      }
    }
    if (fieldToFlash) {
      setFlashingField(fieldToFlash);
      const t = setTimeout(() => setFlashingField(null), 1500);
      return () => clearTimeout(t);
    }
  }, [data.product, data.target, data.price, data.niche, data.diff]);

  const filledCount = [
    data.product,
    data.target,
    data.price,
    data.niche,
    data.diff,
  ].filter(isFilled).length;
  const isColdStart = filledCount === 0;
  const progressLabel = isColdStart
    ? '完成左侧 5 项对话，将自动生成诊断'
    : `已填写 ${filledCount}/5 项`;

  const hasAnyScore = (data.scores?.high || 0) + (data.scores?.small || 0) + (data.scores?.new || 0) > 0;
  const avgScore = ((data.scores?.high || 0) + (data.scores?.small || 0) + (data.scores?.new || 0)) / 3;
  const totalScorePercent = hasAnyScore ? Math.round((avgScore / 5) * 100) : 0;

  const chartData = [
    { subject: '高', A: data.scores?.high || 0, fullMark: 5 },
    { subject: '小', A: data.scores?.small || 0, fullMark: 5 },
    { subject: '新', A: data.scores?.new || 0, fullMark: 5 },
  ];

  return (
    <div data-pdf-export className="w-full min-w-0 bg-white shadow-lg rounded-2xl border border-slate-200 p-8 flex flex-col gap-6 h-full overflow-y-auto fade-in relative">
      <div data-pdf-hide className="absolute inset-0 z-0 opacity-[0.01] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

      <div className="flex justify-between items-start border-b border-slate-100 pb-5 z-10">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b] tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-[#2563eb]" />
            商业可行性诊断书
            <span
              data-pdf-hide
              title="高：高天花板/高频/高毛利；小：小切口/MVP/小团队；新：新人群/新渠道/新红利"
              className="text-xs font-medium text-slate-400 hover:text-slate-600 cursor-help"
            >
              ?
            </span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <Select
              value={data.stage || '0-1'}
              onValueChange={(val) => handleCanvasEdit({ stage: val })}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs font-medium border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                <SelectValue placeholder="选择阶段" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0-1" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <Sprout className="w-3.5 h-3.5 text-blue-500" />
                      <span>0-1 生存阶段</span>
                    </div>
                    <span className="text-[10px] text-slate-500">聚焦生存与验证</span>
                  </div>
                </SelectItem>
                <SelectItem value="1-10" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-cyan-500" />
                      <span>1-10 增长阶段</span>
                    </div>
                    <span className="text-[10px] text-slate-500">可复制性与团队建设</span>
                  </div>
                </SelectItem>
                <SelectItem value="10-100" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      <span>10-100 成王阶段</span>
                    </div>
                    <span className="text-[10px] text-slate-500">效率与护城河</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-[#94a3b8]">{progressLabel}</span>
          </div>
        </div>
        <div data-pdf-hide className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreMenu((v) => !v)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              title="更多操作"
              aria-label="更多操作"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} aria-hidden />
                <div className="absolute right-0 top-full mt-1 py-1 min-w-[160px] bg-white rounded-lg border border-slate-200 shadow-lg z-50">
                  <button
                    type="button"
                    onClick={() => { handleExtractFromChat(); setShowMoreMenu(false); }}
                    disabled={chatLoading}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    从对话重新提取
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleResetCanvas(); setShowMoreMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 text-slate-600"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    重置画布
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {isColdStart && (
        <p className="z-10 text-sm text-slate-600">
          在左侧对话中描述你的产品和客群，画布会自动更新
        </p>
      )}

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 space-y-4">
          <h3 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-[#3b82f6]" />
            项目沙盘推演
          </h3>
          <div className="grid grid-cols-2 gap-3 [&>div]:min-h-[72px]">
             <FieldBox label="产品/服务形态" value={data.product} fieldKey="product" colSpan={2} flash={flashingField === 'product'} editable onSave={(v) => handleCanvasEdit({ product: v || undefined })} />
             <FieldBox label="目标客群" value={data.target} fieldKey="target" flash={flashingField === 'target'} editable onSave={(v) => handleCanvasEdit({ target: v || undefined })} />
             <FieldBox label="利润天花板 (高)" value={data.price} fieldKey="price" highlight flash={flashingField === 'price'} editable onSave={(v) => handleCanvasEdit({ price: v || undefined })} />
             <FieldBox label="破局切入点 (小)" value={data.niche} fieldKey="niche" colSpan={2} highlight flash={flashingField === 'niche'} editable onSave={(v) => handleCanvasEdit({ niche: v || undefined })} />
             <FieldBox label="核心差异化 (新)" value={data.diff} fieldKey="diff" colSpan={2} highlight flash={flashingField === 'diff'} editable onSave={(v) => handleCanvasEdit({ diff: v || undefined })} />
          </div>
        </div>
        <div className="col-span-2 flex flex-col items-center justify-start p-5 bg-slate-50 rounded-2xl border border-slate-100 h-full">
           <h3 className="text-sm font-semibold text-[#1e293b] mb-6 w-full text-left flex items-center gap-2" title="高：天花板/高频/高毛利；小：小切口/MVP/小团队；新：新人群/新渠道/新红利">
              <RadarIcon className="w-4 h-4 text-[#3b82f6]" />
              高小新多维模型评分
           </h3>
           <div className="w-full aspect-square relative mt-2">
             {hasAnyScore ? (
               <ResponsiveContainer width="100%" height="100%">
                 <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                   <PolarGrid />
                   <PolarAngleAxis dataKey="subject" tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }} />
                   <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                   <Radar name="Score" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2.5} />
                 </RadarChart>
               </ResponsiveContainer>
             ) : (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 text-xs text-[#475569] bg-slate-50/50 rounded-xl">
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-200 mb-3" />
                  <span>完成左侧 5 项后将在此显示评分</span>
               </div>
             )}
           </div>
           {hasAnyScore && (
             <>
               <div className="mt-8 text-center">
                 <div className="text-[10px] font-bold text-[#475569] uppercase tracking-widest">综合评估得分</div>
                 <div className="text-4xl font-black text-[#2563eb] tracking-tighter mt-1">
                   {totalScorePercent}
                 </div>
               </div>
               {data.scores?.high != null || data.scores?.small != null || data.scores?.new != null ? (
                 (() => {
                   const reasons = data.scoreReasons as { high?: string; small?: string; new?: string } | undefined;
                   const items = [
                     { label: '高', score: data.scores?.high, reason: reasons?.high },
                     { label: '小', score: data.scores?.small, reason: reasons?.small },
                     { label: '新', score: data.scores?.new, reason: reasons?.new },
                   ].filter((i) => i.reason != null && i.reason.trim() !== '');
                   if (items.length === 0) return null;
                   return (
                     <div className="mt-4 w-full space-y-2 text-left">
                       <div className="text-[10px] font-bold text-[#475569] uppercase tracking-widest">评分依据</div>
                       {items.map((item, i) => (
                         <div key={i} className="text-xs text-[#475569] pl-1">
                           <span className="font-semibold text-[#334155]">{item.label}</span>
                           {item.score != null && <span className="text-[#2563eb] ml-1">({item.score} 分)</span>}
                           ：{item.reason}
                         </div>
                       ))}
                     </div>
                   );
                 })()
               ) : null}
             </>
           )}
        </div>
      </div>

      {filledCount >= 1 && filledCount < 5 && (() => {
        const next = getNextStepSuggestion(data);
        return next ? (
          <div className="z-10 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-[#1e293b] flex items-start gap-2">
            <ArrowRight className="w-4 h-4 text-[#3b82f6] flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">接下来可以告诉顾问：</span>
              你的<strong>{next.label}</strong>是什么？例如：{next.example}
            </div>
          </div>
        ) : null;
      })()}

      {filledCount >= 5 && (!hasAnyScore || !data.summary?.trim() || !Array.isArray(data.actionList) || data.actionList.length === 0) && (
        <div className="z-10 px-4 py-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-[#78350f] flex flex-col gap-3">
          <p className="font-semibold">诊断尚未生成。请点击下方「生成诊断」由顾问根据当前信息补全评分与建议。</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCompleteDiagnosis}
              disabled={chatLoading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
            >
              生成诊断
            </button>
            <button
              type="button"
              onClick={handleExtractFromChat}
              disabled={chatLoading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium border border-slate-200 disabled:opacity-50 disabled:pointer-events-none"
            >
              从对话重新提取
            </button>
          </div>
        </div>
      )}
      
      <div className={`flex-1 mt-2 pt-5 border-t border-slate-100 transition-opacity duration-700 ${(!data.summary && (!data.actionList || data.actionList.length === 0)) ? 'opacity-70' : 'opacity-100'}`}>
        <h3 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2 mb-4">
          <Lightbulb className="w-4 h-4 text-[#f59e0b]" /> AI 诊断点评 & 下一步行动
        </h3>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 mb-4 shadow-sm">
          <p className={`text-sm leading-relaxed font-semibold ${data.summary ? 'text-[#1e293b]' : 'text-[#475569] italic'}`}>
            {data.summary || '当前数据不足，AI 分析引擎待命中，请继续在左侧与顾问交流...'}
          </p>
          {data.summary && (
            <p className="text-[10px] text-[#94a3b8] mt-2">诊断依据来自高小新会议纪要知识库</p>
          )}
        </div>
        {data.summary && (
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <button
              type="button"
              onClick={handleFollowUpConsultation}
              disabled={chatLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors text-xs font-medium border border-emerald-200 disabled:opacity-50 disabled:pointer-events-none"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              复诊
            </button>
            <button
              type="button"
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-xs font-medium border border-slate-200"
            >
              <Copy className="w-3.5 h-3.5" />
              复制摘要
            </button>
          </div>
        )}
        {data.summary && Array.isArray(data.actionList) && data.actionList.length > 0 && (() => {
          const checkedCount = (data.actionListChecked ?? []).filter(Boolean).length;
          if (checkedCount === 0) return null;
          return (
            <p className="text-xs text-emerald-600 mb-3 ml-1">您已标记 {checkedCount} 项完成，点击「复诊」可更新诊断建议</p>
          );
        })()}
        
        <h4 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3 ml-1">
          Action List
          {Array.isArray(data.actionList) && data.actionList.length > 0 && (() => {
            const checkedCount = (data.actionListChecked ?? []).slice(0, data.actionList.length).filter(Boolean).length;
            return <span className="font-normal text-slate-500 ml-1">（{checkedCount}/{data.actionList.length} 已完成）</span>;
          })()}
        </h4>
        {Array.isArray(data.actionList) && data.actionList.length > 0 ? (
          <ul className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
            {data.actionList.map((action: string, idx: number) => {
              const checked = Array.isArray(data.actionListChecked) ? (data.actionListChecked[idx] ?? false) : false;
              return (
                <li key={idx} className="flex items-start gap-3 p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-100">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = [...(data.actionListChecked ?? [])];
                      while (next.length <= idx) next.push(false);
                      next[idx] = !next[idx];
                      handleCanvasEdit({ actionListChecked: next });
                    }}
                    className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                  />
                  <span className={`text-sm leading-snug break-words font-semibold ${checked ? 'text-[#64748b] line-through' : 'text-[#1e293b]'}`}>{action}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="space-y-3 opacity-70">
            <li className="flex items-start gap-2 text-sm text-[#475569]">
              <div className="w-4 h-4 mt-0.5 rounded border-2 border-slate-300 flex-shrink-0"></div>
              <span>等待提取待办事项...</span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

function FieldBox({
  label,
  value,
  fieldKey,
  colSpan = 1,
  highlight = false,
  flash = false,
  editable = false,
  onSave,
}: {
  label: string;
  value?: string;
  fieldKey?: string;
  colSpan?: number;
  highlight?: boolean;
  flash?: boolean;
  editable?: boolean;
  onSave?: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value ?? '');
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const filled = isFilled(value);
  const displayValue = filled ? value : FIELD_EMPTY_HINT;

  const handleBlur = () => {
    setEditing(false);
    const trimmed = localValue.trim();
    const current = (isFilled(value) ? value : '') ?? '';
    if (editable && onSave && trimmed !== current) {
      onSave(trimmed);
    }
  };

  const startEditing = () => {
    if (!editing) {
      if (!isFilled(value)) setLocalValue('');
      setEditing(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div
      className={`p-3.5 rounded-xl border transition-all duration-300 ${colSpan === 2 ? 'col-span-2' : ''} ${filled ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'} ${editable ? 'cursor-text' : ''} ${flash ? 'update-flash' : ''}`}
      onClick={editable && !editing ? startEditing : undefined}
      title={editable && !editing ? '点击编辑' : undefined}
    >
      <label className={`text-[10px] font-bold uppercase block mb-1 ${highlight ? 'text-[#2563eb]' : 'text-[#334155]'}`}>
        {label}
      </label>
      {editable && editing ? (
        <input
          ref={inputRef}
          type="text"
          className="w-full text-sm font-semibold text-[#1e293b] bg-white border border-blue-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div className={`text-sm font-semibold min-h-[1.25rem] leading-relaxed break-words ${filled ? 'text-[#1e293b]' : 'text-[#475569]'}`}>
          {displayValue}
        </div>
      )}
    </div>
  );
}
