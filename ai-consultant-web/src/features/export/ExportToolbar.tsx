'use client';

import { useAgentStore } from '@/lib/store';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

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

const html2canvasOptions = {
  scale: 2,
  useCORS: true,
  logging: false,
  onclone(_: unknown, clonedEl: HTMLElement) {
    const TEXT_TAGS = ['P', 'SPAN', 'LABEL', 'DIV', 'H1', 'H2', 'H3', 'H4', 'LI', 'STRONG', 'INPUT'];
    const walk = (node: Element) => {
      if (node instanceof HTMLElement) {
        if (node.hasAttribute('data-pdf-hide')) {
          node.style.setProperty('display', 'none', 'important');
        } else {
          node.style.setProperty('opacity', '1', 'important');
          if (TEXT_TAGS.includes(node.tagName)) {
            node.style.setProperty('color', '#1e293b', 'important');
          }
          // Remove max-height constraints on scrollable containers to ensure full content is captured
          const computedStyle = window.getComputedStyle(node);
          if (computedStyle.overflowY === 'auto' || computedStyle.overflowY === 'scroll') {
            node.style.setProperty('max-height', 'none', 'important');
            node.style.setProperty('overflow-y', 'visible', 'important');
          }
        }
      }
      for (const child of Array.from(node.children)) walk(child);
    };
    walk(clonedEl);
  },
};

/** Capture report as image for preview (same visual as PDF export). Returns data URL or null. */
export async function previewGxxReportAsImage(): Promise<string | null> {
  const el = document.querySelector<HTMLElement>('[data-pdf-export]');
  if (!el) return null;
  
  // Store original styles
  const originalHeight = el.style.height;
  const originalOverflow = el.style.overflow;
  const originalMaxHeight = el.style.maxHeight;
  
  // Temporarily remove height constraints to ensure full content is captured
  el.style.height = 'auto';
  el.style.overflow = 'visible';
  el.style.maxHeight = 'none';
  
  // Scroll to top to ensure we capture from the beginning
  el.scrollIntoView({ behavior: 'instant', block: 'start' });
  el.scrollTop = 0;
  
  // Wait for layout to settle
  await new Promise((r) => setTimeout(r, 300));
  
  try {
    const canvas = await html2canvas(el, {
      ...html2canvasOptions,
      width: el.scrollWidth,
      height: el.scrollHeight,
    });
    return canvas.toDataURL('image/png');
  } finally {
    // Restore original styles
    el.style.height = originalHeight;
    el.style.overflow = originalOverflow;
    el.style.maxHeight = originalMaxHeight;
  }
}

export async function exportGxxReportToPdf(): Promise<void> {
  const el = document.querySelector<HTMLElement>('[data-pdf-export]');
  if (!el) {
    console.warn('PDF export target not found');
    return;
  }
  
  // Store original styles
  const originalHeight = el.style.height;
  const originalOverflow = el.style.overflow;
  const originalMaxHeight = el.style.maxHeight;
  
  // Temporarily remove height constraints to ensure full content is captured
  el.style.height = 'auto';
  el.style.overflow = 'visible';
  el.style.maxHeight = 'none';
  
  // Scroll to top to ensure we capture from the beginning
  el.scrollIntoView({ behavior: 'instant', block: 'start' });
  el.scrollTop = 0;
  
  // Wait for layout to settle
  await new Promise((r) => setTimeout(r, 300));
  
  try {
    const canvas = await html2canvas(el, {
      ...html2canvasOptions,
      width: el.scrollWidth,
      height: el.scrollHeight,
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pw = 210;
    const ph = 297;
    const pxToMm = 25.4 / 96;
    const cwMm = canvas.width * pxToMm;
    const chMm = canvas.height * pxToMm;
    const ratio = Math.min(pw / cwMm, ph / chMm) * 0.95;
    const w = cwMm * ratio;
    const h = chMm * ratio;
    const x = (pw - w) / 2;
    const y = (ph - h) / 2;
    pdf.addImage(imgData, 'PNG', x, y, w, h);
    const date = new Date().toISOString().slice(0, 10);
    pdf.save(`商业可行性诊断书-${date}.pdf`);
  } finally {
    // Restore original styles
    el.style.height = originalHeight;
    el.style.overflow = originalOverflow;
    el.style.maxHeight = originalMaxHeight;
  }
}

function showExportFeedback(type: 'success' | 'error', message: string) {
  if (type === 'error') {
    alert(`PDF 导出失败：${message}`);
    return;
  }
  const el = document.createElement('div');
  el.textContent = message;
  el.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg z-[60]';
  document.body.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 2000);
}

export function useExportPdf() {
  return async () => {
    try {
      await exportGxxReportToPdf();
      showExportFeedback('success', 'PDF 已导出');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('PDF export failed:', err);
      showExportFeedback('error', msg);
    }
  };
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

