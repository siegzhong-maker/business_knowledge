'use client';

import { useState } from 'react';
import { useAgentStore } from '@/lib/store';
import { useExportPdf, previewGxxReportAsImage } from './ExportToolbar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileCheck2, ChevronUp, Download, Loader2 } from 'lucide-react';

export function FloatingToolbar() {
  const currentAgentId = useAgentStore((state) => state.currentAgentId);
  const handleExportPdf = useExportPdf();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleOpenPreview = async () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewImage(null);
    try {
      const img = await previewGxxReportAsImage();
      setPreviewImage(img ?? null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPreviewImage(null);
  };

  if (currentAgentId !== 'gxx') return null;

  return (
    <>
      <div className="fixed bottom-6 left-[80%] -translate-x-1/2 glass-panel shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-full px-4 py-2 flex items-center gap-2 z-50">
        <button
          type="button"
          onClick={handleOpenPreview}
          title="预览导出 PDF 效果"
          aria-label="预览导出 PDF 效果"
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 rounded-full transition-colors text-sm text-slate-700 font-medium"
        >
          <FileCheck2 className="w-4 h-4 text-blue-600" />
          报告视图
          <ChevronUp className="w-3 h-3 text-slate-400" />
        </button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={handleExportPdf}
          aria-label="导出 PDF 报告"
          className="flex items-center gap-1 pl-3 pr-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full transition-colors text-sm font-medium shadow-sm"
        >
          <Download className="w-4 h-4" />
          导出 PDF
        </button>
      </div>

      <Dialog open={previewOpen} onOpenChange={(open) => !open && handleClosePreview()}>
        <DialogContent
          className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0"
          showCloseButton
        >
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>PDF 导出预览</DialogTitle>
          </DialogHeader>
          <div
            className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-6 min-h-[200px] flex bg-slate-50 rounded-b-lg ${previewImage ? 'items-start justify-center' : 'items-center justify-center'}`}
          >
            {previewLoading && (
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="w-10 h-10 animate-spin" />
                <span className="text-sm">生成预览中...</span>
              </div>
            )}
            {!previewLoading && previewImage && (
              <img
                src={previewImage}
                alt="PDF 导出预览"
                className="w-full max-w-full h-auto rounded-lg shadow-lg border border-slate-200"
              />
            )}
            {!previewLoading && !previewImage && (
              <span className="text-sm text-slate-500">预览生成失败，请重试</span>
            )}
          </div>
          {!previewLoading && previewImage && (
            <div className="px-6 pb-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  handleExportPdf();
                  handleClosePreview();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                导出 PDF
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
