'use client';

import { useAgentStore } from '@/lib/store';
import { ExportButton } from '@/features/export/ExportToolbar';
import { Link, Zap, Database, HeartHandshake, UsersRound, Truck, Target, TrendingDown, TrendingUp } from 'lucide-react';

export function BMCGridView() {
  const data = useAgentStore((state) => state.canvasData.bmc);

  return (
    <div className="w-full max-w-5xl bg-white shadow-lg rounded-2xl border border-slate-200 p-8 flex flex-col gap-6 min-h-[800px] fade-in">
       <div className="flex justify-between items-start border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            精益商业模式画布 (BMC)
          </h1>
          <p className="text-slate-500 text-sm mt-1">全局系统化梳理业务模式</p>
        </div>
        <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-green-50 text-green-600 border border-green-200 rounded-full text-xs font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                实时同步中
            </span>
            <ExportButton />
        </div>
      </div>

      <div className="bmc-grid flex-1">
         {/* KP */}
         <div className="bmc-box" style={{ gridColumn: 'span 2', gridRow: 'span 2' }}>
            <Label icon={<Link className="w-3 h-3 text-purple-500" />} text="关键合作伙伴 (KP)" />
            <Value text={data.partners} />
         </div>

         {/* KA & KR */}
         <div className="flex flex-col gap-3" style={{ gridColumn: 'span 2', gridRow: 'span 2' }}>
            <div className="bmc-box flex-1">
               <Label icon={<Zap className="w-3 h-3 text-purple-500" />} text="关键业务 (KA)" />
               <Value text={data.activities} />
            </div>
            <div className="bmc-box flex-1">
               <Label icon={<Database className="w-3 h-3 text-purple-500" />} text="核心资源 (KR)" />
               <Value text={data.resources} />
            </div>
         </div>

         {/* VP */}
         <div className="bmc-box border-purple-200 bg-purple-50/30" style={{ gridColumn: 'span 2', gridRow: 'span 2' }}>
            <Label icon={<HeartHandshake className="w-3 h-3 text-purple-600" />} text="价值主张 (VP)" className="text-purple-700" />
            <Value text={data.value} />
         </div>

         {/* CR & CH */}
         <div className="flex flex-col gap-3" style={{ gridColumn: 'span 2', gridRow: 'span 2' }}>
             <div className="bmc-box flex-1">
                <Label icon={<UsersRound className="w-3 h-3 text-purple-500" />} text="客户关系 (CR)" />
                <Value text={data.relationship} />
             </div>
             <div className="bmc-box flex-1">
                <Label icon={<Truck className="w-3 h-3 text-purple-500" />} text="渠道通路 (CH)" />
                <Value text={data.channels} />
             </div>
         </div>

         {/* CS */}
         <div className="bmc-box border-blue-200 bg-blue-50/30" style={{ gridColumn: 'span 2', gridRow: 'span 2' }}>
            <Label icon={<Target className="w-3 h-3 text-blue-600" />} text="客户细分 (CS)" className="text-blue-700" />
            <Value text={data.segments} />
         </div>

         {/* Costs */}
         <div className="bmc-box" style={{ gridColumn: 'span 5', gridRow: 'span 1' }}>
             <Label icon={<TrendingDown className="w-3 h-3 text-rose-500" />} text="成本结构 (C$)" />
             <Value text={data.costs} />
         </div>

         {/* Revenue */}
         <div className="bmc-box" style={{ gridColumn: 'span 5', gridRow: 'span 1' }}>
             <Label icon={<TrendingUp className="w-3 h-3 text-emerald-500" />} text="收入来源 (R$)" />
             <Value text={data.revenue} />
         </div>
      </div>
    </div>
  );
}

function Label({ icon, text, className }: any) {
  return (
    <label className={`bmc-label ${className || ''}`}>
      {icon} {text}
    </label>
  );
}

function Value({ text }: any) {
  return (
    <div className={`bmc-value ${(!text || text === '等待输入...' || text.includes('?')) ? 'bmc-placeholder' : ''}`}>
      {text || '等待输入...'}
    </div>
  );
}
