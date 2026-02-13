'use client';

import { useAgentStore } from '@/lib/store';
import { Download } from 'lucide-react';

export function downloadTextFile(filename: string, content: string) {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatGxxMarkdown(data: any) {
  return [
    '# 高小新战略诊断交付物',
    '',
    '## 项目概览',
    `- 产品/服务形态：${data.product || '（待补充）'}`,
    `- 目标客群：${data.target || '（待补充）'}`,
    `- 利润天花板（高）：${data.price || '（待补充）'}`,
    `- 破局切入点（小）：${data.niche || '（待补充）'}`,
    `- 核心差异化（新）：${data.diff || '（待补充）'}`,
    '',
    '## 高小新评分雷达',
    `- 高 (High)：${data.scores?.high ?? 0} / 5`,
    `- 小 (Small)：${data.scores?.small ?? 0} / 5`,
    `- 新 (New)：${data.scores?.new ?? 0} / 5`,
    '',
    '## 诊断总结',
    data.summary || '（暂无诊断总结，请继续与智能体对话以生成更完整的结论。）',
  ].join('\n');
}

function formatBmcMarkdown(data: any) {
  return [
    '# 商业模式画布（BMC）交付物',
    '',
    '## 上层：关键资源与合作',
    `- 关键合作伙伴 (KP)：${data.partners || '（待补充）'}`,
    `- 关键业务 (KA)：${data.activities || '（待补充）'}`,
    `- 核心资源 (KR)：${data.resources || '（待补充）'}`,
    '',
    '## 中层：价值与客户',
    `- 价值主张 (VP)：${data.value || '（待补充）'}`,
    `- 客户关系 (CR)：${data.relationship || '（待补充）'}`,
    `- 渠道通路 (CH)：${data.channels || '（待补充）'}`,
    `- 客户细分 (CS)：${data.segments || '（待补充）'}`,
    '',
    '## 下层：成本与收益',
    `- 成本结构 (C$)：${data.costs || '（待补充）'}`,
    `- 收入来源 (R$)：${data.revenue || '（待补充）'}`,
  ].join('\n');
}

export function useExport() {
  const { currentAgentId, canvasData } = useAgentStore();

  const handleExport = () => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);

    if (currentAgentId === 'gxx') {
      const data = canvasData.gxx || {};
      const content = formatGxxMarkdown(data);
      downloadTextFile(`gxx-report-${date}.md`, content);
    } else if (currentAgentId === 'bmc') {
      const data = canvasData.bmc || {};
      const content = formatBmcMarkdown(data);
      downloadTextFile(`bmc-canvas-${date}.md`, content);
    } else {
      const raw = canvasData[currentAgentId] ?? {};
      const content = JSON.stringify(raw, null, 2);
      downloadTextFile(`canvas-${currentAgentId}-${date}.json`, content);
    }
  };

  return handleExport;
}

/** Compact export button for use inside canvas headers */
export function ExportButton({ className = '' }: { className?: string }) {
  const handleExport = useExport();

  return (
    <button
      type="button"
      onClick={handleExport}
      className={`flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors text-xs font-medium ${className}`}
    >
      <Download className="w-3.5 h-3.5" />
      导出交付物
    </button>
  );
}

