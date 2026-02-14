'use client';

import { useAgentStore } from '@/lib/store';
import { LayoutGrid } from 'lucide-react';

const BMC_FIELDS = [
  { key: 'partners', label: 'KP 关键合作伙伴' },
  { key: 'activities', label: 'KA 关键业务' },
  { key: 'resources', label: 'KR 核心资源' },
  { key: 'value', label: 'VP 价值主张' },
  { key: 'relationship', label: 'CR 客户关系' },
  { key: 'channels', label: 'CH 渠道通路' },
  { key: 'segments', label: 'CS 客户细分' },
  { key: 'costs', label: 'C$ 成本结构' },
  { key: 'revenue', label: 'R$ 收入来源' },
] as const;

export function BMCGridView() {
  const data = useAgentStore((state) => state.canvasData.bmc) ?? {};

  return (
    <div className="w-full min-w-0 bg-white shadow-lg rounded-2xl border border-slate-200 p-8 flex flex-col gap-6 h-full overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-5">
        <LayoutGrid className="w-6 h-6 text-purple-600" />
        <h1 className="text-2xl font-bold text-slate-900">商业模式画布 (BMC)</h1>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {BMC_FIELDS.map(({ key, label }) => (
          <div
            key={key}
            className="p-4 rounded-xl border border-slate-100 bg-slate-50 min-h-[80px]"
          >
            <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">
              {label}
            </div>
            <div className="text-sm font-semibold text-slate-800 min-h-[1.25rem]">
              {(data as Record<string, string>)[key] || '等待对话填充...'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
