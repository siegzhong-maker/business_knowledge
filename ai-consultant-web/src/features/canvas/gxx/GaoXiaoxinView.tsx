'use client';

import { useState, useRef, useEffect } from 'react';
import { useAgentStore } from '@/lib/store';
import { ExportButton } from '@/features/export/ExportToolbar';
import { Target, Radar as RadarIcon, Lightbulb, LayoutDashboard, ArrowRight } from 'lucide-react';
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

function getNextStepSuggestion(data: { product?: string; target?: string; price?: string; niche?: string; diff?: string }): { label: string; example: string } | null {
  const filled = (v: unknown) => v != null && v !== '' && v !== '等待输入...';
  if (filled(data.price) && filled(data.niche) && filled(data.diff)) return null;
  if (!filled(data.niche)) {
    return { label: '破局切入点', example: '先做一线城市律所合伙人，他们查阅法条最频繁' };
  }
  if (!filled(data.diff)) {
    return { label: '核心差异化', example: '主打无摄像头隐私设计，客户在敏感场合也能用' };
  }
  if (!filled(data.price)) {
    return { label: '利润天花板', example: '客单价约 5万/年，订阅制，不算高频刚需' };
  }
  return null;
}

export function GaoXiaoxinView() {
  const data = useAgentStore((state) => state.canvasData.gxx);
  const updateCanvasData = useAgentStore((state) => state.updateCanvasData);
  const chatLoading = useAgentStore((state) => state.chatLoading);
  const prevFieldsRef = useRef<Record<string, unknown>>({});
  const [flashingField, setFlashingField] = useState<string | null>(null);

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
    ? '完成左侧 3 步对话，将自动生成诊断'
    : `已填写 ${filledCount}/5 项`;

  const hasAnyScore = (data.scores?.high || 0) + (data.scores?.small || 0) + (data.scores?.new || 0) > 0;
  const avgScore = ((data.scores?.high || 0) + (data.scores?.small || 0) + (data.scores?.new || 0)) / 3;
  const totalScorePercent = hasAnyScore ? Math.round((avgScore / 5) * 100) : 0;

  const chartData = [
    { subject: '高 (High)', A: data.scores?.high || 0, fullMark: 5 },
    { subject: '小 (Small)', A: data.scores?.small || 0, fullMark: 5 },
    { subject: '新 (New)', A: data.scores?.new || 0, fullMark: 5 },
  ];

  return (
    <div data-pdf-export className="w-full max-w-4xl min-w-0 bg-white shadow-lg rounded-2xl border border-slate-200 p-8 flex flex-col gap-6 h-full overflow-y-auto fade-in relative">
      <div data-pdf-hide className="absolute inset-0 z-0 opacity-[0.01] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

      <div className="flex justify-between items-start border-b border-slate-100 pb-5 z-10">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b] tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-[#2563eb]" />
            商业可行性诊断书
          </h1>
          <p className="text-[#64748b] text-sm mt-1">基于高小新战略模型实时生成</p>
          <p className="text-xs text-[#475569] mt-1">{progressLabel}</p>
        </div>
        <div data-pdf-hide className="flex items-center gap-2">
            <span className={`px-3 py-1 border rounded-full text-xs font-medium flex items-center gap-1 transition-colors ${chatLoading ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${chatLoading ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                {chatLoading ? '思考并提取中...' : '监听会话中...'}
            </span>
            <ExportButton />
        </div>
      </div>

      {isColdStart && (
        <div className="z-10 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 text-sm text-[#1e293b]">
          请先在左侧按 <strong>① 产品</strong> → <strong>② 客群</strong> → <strong>③ 差异化</strong> 的顺序与顾问对话，此处将实时生成诊断与评分。
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 space-y-4">
          <h3 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-[#3b82f6]" />
            项目沙盘推演
          </h3>
          <div className="grid grid-cols-2 gap-3">
             <FieldBox label="产品/服务形态" value={data.product} fieldKey="product" colSpan={2} flash={flashingField === 'product'} editable onSave={(v) => updateCanvasData('gxx', { product: v || undefined })} />
             <FieldBox label="目标客群" value={data.target} fieldKey="target" flash={flashingField === 'target'} editable onSave={(v) => updateCanvasData('gxx', { target: v || undefined })} />
             <FieldBox label="利润天花板 (高)" value={data.price} fieldKey="price" highlight flash={flashingField === 'price'} />
             <FieldBox label="破局切入点 (小)" value={data.niche} fieldKey="niche" colSpan={2} highlight flash={flashingField === 'niche'} editable onSave={(v) => updateCanvasData('gxx', { niche: v || undefined })} />
             <FieldBox label="核心差异化 (新)" value={data.diff} fieldKey="diff" colSpan={2} highlight flash={flashingField === 'diff'} editable onSave={(v) => updateCanvasData('gxx', { diff: v || undefined })} />
          </div>
        </div>
        <div className="col-span-2 flex flex-col items-center justify-start p-5 bg-slate-50 rounded-2xl border border-slate-100 h-full">
           <h3 className="text-sm font-semibold text-[#1e293b] mb-6 w-full text-left flex items-center gap-2">
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
               <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 text-xs text-[#475569]">
                 等待数据填充<br />生成雷达图
               </div>
             )}
           </div>
           {hasAnyScore && (
             <div className="mt-8 text-center">
               <div className="text-[10px] font-bold text-[#475569] uppercase tracking-widest">综合评估得分</div>
               <div className="text-4xl font-black text-[#2563eb] tracking-tighter mt-1">
                 {totalScorePercent}
               </div>
             </div>
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
      
      <div className={`flex-1 mt-2 pt-5 border-t border-slate-100 transition-opacity duration-700 ${(!data.summary && (!data.actionList || data.actionList.length === 0)) ? 'opacity-70' : 'opacity-100'}`}>
        <h3 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2 mb-4">
          <Lightbulb className="w-4 h-4 text-[#f59e0b]" /> AI 诊断点评 & 下一步行动
        </h3>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 mb-5 shadow-sm">
          <p className={`text-sm leading-relaxed font-semibold ${data.summary ? 'text-[#1e293b]' : 'text-[#475569] italic'}`}>
            {data.summary || '当前数据不足，AI 分析引擎待命中，请继续在左侧与顾问交流...'}
          </p>
        </div>
        
        <h4 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3 ml-1">Action List</h4>
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
                      updateCanvasData('gxx', { actionListChecked: next });
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
      className={`p-3.5 rounded-xl border transition-all duration-300 ${colSpan === 2 ? 'col-span-2' : ''} ${filled ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'} ${editable ? 'cursor-text' : ''} ${flash ? 'update-flash' : ''}`}
      onClick={editable && !editing ? startEditing : undefined}
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
        <div className={`text-sm font-semibold min-h-[1.25rem] break-words ${filled ? 'text-[#1e293b]' : 'text-[#475569]'}`}>
          {displayValue}
        </div>
      )}
    </div>
  );
}
