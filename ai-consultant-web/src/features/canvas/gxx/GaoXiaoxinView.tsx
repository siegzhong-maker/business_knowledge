'use client';

import { useState, useRef, useEffect } from 'react';
import { useAgentStore } from '@/lib/store';
import { ExportButton } from '@/features/export/ExportToolbar';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

const EMPTY_PLACEHOLDER = '等待输入...';
function isFilled(v: unknown): boolean {
  return v != null && v !== '' && v !== EMPTY_PLACEHOLDER;
}

const FIELD_GUIDANCE: Record<string, string> = {
  product: '在左侧对话中描述产品，我会帮你提炼',
  target: '在对话中说明目标客户，我会帮你提炼',
  price: '完成产品与客群描述后将评估利润天花板',
  niche: '在对话中说明破局切入点，我会帮你提炼',
  diff: '在对话中说明核心差异化，我会帮你提炼',
};

export function GaoXiaoxinView() {
  const data = useAgentStore((state) => state.canvasData.gxx);
  const updateCanvasData = useAgentStore((state) => state.updateCanvasData);
  const prevDataRef = useRef<string | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const key = JSON.stringify({
      product: data.product,
      target: data.target,
      summary: data.summary,
      scores: data.scores,
      actionList: data.actionList,
    });
    if (prevDataRef.current === null) {
      prevDataRef.current = key;
      return;
    }
    if (prevDataRef.current !== key) {
      prevDataRef.current = key;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1500);
      return () => clearTimeout(t);
    }
  }, [data]);

  const filledCount = [
    data.product,
    data.target,
    data.price,
    data.niche,
    data.diff,
  ].filter(isFilled).length;
  const isColdStart = filledCount === 0;
  const progressLabel = isColdStart
    ? '完成左侧 3 步对话，将自动生成诊断'
    : `已填写 ${filledCount}/5 项`;

  const totalScore = (data.scores?.high || 0) + (data.scores?.small || 0) + (data.scores?.new || 0);
  const hasAnyScore = totalScore > 0;

  const chartData = [
    { subject: '高 (High)', A: data.scores?.high || 0, fullMark: 5 },
    { subject: '小 (Small)', A: data.scores?.small || 0, fullMark: 5 },
    { subject: '新 (New)', A: data.scores?.new || 0, fullMark: 5 },
  ];

  return (
    <div className={`w-full max-w-4xl min-w-0 bg-white shadow-lg rounded-2xl border border-slate-200 p-8 flex flex-col gap-6 min-h-[800px] fade-in relative overflow-hidden transition-shadow ${flash ? 'update-flash' : ''}`}>
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

      <div className="flex justify-between items-start border-b border-slate-100 pb-5 z-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            商业可行性诊断书
          </h1>
          <p className="text-slate-500 text-sm mt-1">基于高小新战略模型</p>
          <p className="text-xs text-slate-400 mt-1">{progressLabel}</p>
        </div>
        <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-green-50 text-green-600 border border-green-200 rounded-full text-xs font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Real-time
            </span>
            <ExportButton />
        </div>
      </div>

      {isColdStart && (
        <div className="z-10 px-4 py-3 rounded-xl bg-blue-50/80 border border-blue-100 text-sm text-slate-700">
          请先在左侧按 <strong>① 产品</strong> → <strong>② 客群</strong> → <strong>③ 差异化</strong> 的顺序与顾问对话，此处将实时生成诊断与评分。
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 space-y-4">
          <div className="grid grid-cols-2 gap-3">
             <FieldBox label="产品/服务形态" value={data.product} fieldKey="product" colSpan={2} editable onSave={(v) => updateCanvasData('gxx', { product: v || undefined })} />
             <FieldBox label="目标客群" value={data.target} fieldKey="target" editable onSave={(v) => updateCanvasData('gxx', { target: v || undefined })} />
             <FieldBox label="利润天花板 (高)" value={data.price} fieldKey="price" highlight />
             <FieldBox label="破局切入点 (小)" value={data.niche} fieldKey="niche" colSpan={2} highlight editable onSave={(v) => updateCanvasData('gxx', { niche: v || undefined })} />
             <FieldBox label="核心差异化 (新)" value={data.diff} fieldKey="diff" colSpan={2} highlight editable onSave={(v) => updateCanvasData('gxx', { diff: v || undefined })} />
          </div>
        </div>
        <div className="col-span-2 flex flex-col items-center justify-start p-5 bg-slate-50 rounded-2xl border border-slate-100 h-full">
           <h3 className="text-sm font-semibold text-slate-800 mb-2 w-full text-left flex items-center gap-2">
              <span className="text-brand-500">🎯</span> 高小新多维模型评分
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
               <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                 <svg className="w-3/4 h-3/4 text-slate-200" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3">
                   <polygon points="50,10 90,80 10,80" />
                 </svg>
                 <p className="text-sm text-slate-400 mt-2">完成左侧 3 步对话后将生成高小新评分</p>
                 <p className="text-xs text-slate-300 mt-0.5">描述产品、客群与差异化即可获得评估</p>
               </div>
             )}
           </div>
           {hasAnyScore && (
             <div className="mt-4 text-center">
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">综合评估得分</div>
               <div className="text-4xl font-black text-blue-600 tracking-tighter mt-1">
                 {totalScore.toFixed(1)}
               </div>
             </div>
           )}
        </div>
      </div>
      
      {data.summary && (
        <div className="mt-4 p-5 bg-amber-50/60 border border-amber-100/60 rounded-xl">
           <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
             <span className="text-amber-500">💡</span> AI 诊断点评
           </h3>
           <p className="text-sm text-slate-700 leading-relaxed italic">{data.summary}</p>
        </div>
      )}
      
      {Array.isArray(data.actionList) && data.actionList.length > 0 && (
        <div className="mt-2 min-w-0">
           <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Action List</h4>
           <ul className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
             {data.actionList.map((action: string, idx: number) => (
               <li key={idx} className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                  <div className="mt-1 w-4 h-4 rounded border-2 border-slate-300 flex-shrink-0"></div>
                  <span className="text-slate-700 text-sm leading-snug break-words">{action}</span>
               </li>
             ))}
           </ul>
        </div>
      )}
    </div>
  );
}

function FieldBox({
  label,
  value,
  fieldKey,
  colSpan = 1,
  highlight = false,
  editable = false,
  onSave,
}: {
  label: string;
  value?: string;
  fieldKey?: string;
  colSpan?: number;
  highlight?: boolean;
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
  const displayValue = filled ? value : (FIELD_GUIDANCE[fieldKey ?? ''] ?? '完成左侧对话后将自动填充');

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
      className={`p-3.5 rounded-xl border transition-all duration-300 ${colSpan === 2 ? 'col-span-2' : ''} ${filled ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'} ${editable ? 'cursor-text' : ''}`}
      onClick={editable && !editing ? startEditing : undefined}
    >
      <label className={`text-[10px] font-bold uppercase block mb-1 ${highlight ? 'text-blue-500' : 'text-slate-400'}`}>
        {label}
      </label>
      {editable && editing ? (
        <input
          ref={inputRef}
          type="text"
          className="w-full text-sm font-medium text-slate-700 bg-white border border-blue-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div className={`text-sm font-medium min-h-[1.25rem] ${filled ? 'text-slate-700' : 'text-slate-400'}`}>
          {displayValue}
        </div>
      )}
    </div>
  );
}
