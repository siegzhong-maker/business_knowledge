'use client';

import { useAgentStore } from '@/lib/store';
import { useExport } from './ExportToolbar';
import { FileCheck2, ChevronUp, Download } from 'lucide-react';

export function FloatingToolbar() {
  const currentAgentId = useAgentStore((state) => state.currentAgentId);
  const handleExport = useExport();

  if (currentAgentId !== 'gxx') return null;

  return (
    <div className="fixed bottom-6 left-[67%] -translate-x-1/2 glass-panel shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-full px-4 py-2 flex items-center gap-2 z-50">
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 rounded-full transition-colors text-sm text-slate-700 font-medium"
      >
        <FileCheck2 className="w-4 h-4 text-blue-600" />
        报告视图
        <ChevronUp className="w-3 h-3 text-slate-400" />
      </button>
      <div className="w-px h-5 bg-slate-200 mx-1" />
      <button
        type="button"
        onClick={handleExport}
        className="flex items-center gap-1 pl-3 pr-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full transition-colors text-sm font-medium shadow-sm"
      >
        <Download className="w-4 h-4" />
        导出 PDF
      </button>
    </div>
  );
}
