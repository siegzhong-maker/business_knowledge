'use client';

import { useAgentStore } from '@/lib/store';
import { PanelLeft, MessageSquarePlus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { SessionSidebar } from './SessionSidebar';

const COLLAPSED_WIDTH = 56;

export function WorkspaceLeftColumn() {
  const { sidebarCollapsed, setSidebarCollapsed, setSessionId } = useAgentStore();

  const handleNewChat = () => {
    setSessionId(uuidv4());
  };

  if (sidebarCollapsed) {
    return (
      <aside
        className="h-full shrink-0 flex flex-col items-center py-3 gap-2 border-r border-slate-200 bg-white shadow-[2px_0_8px_rgba(0,0,0,0.04)] z-10"
        style={{ width: COLLAPSED_WIDTH, minWidth: COLLAPSED_WIDTH }}
      >
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="展开对话历史"
          aria-label="展开对话历史"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleNewChat}
          className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="新建对话"
          aria-label="新建对话"
        >
          <MessageSquarePlus className="w-5 h-5" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="h-full w-full min-w-0 flex flex-col border-r border-slate-200 bg-white shadow-[2px_0_8px_rgba(0,0,0,0.04)] z-10 overflow-hidden"
    >
      <div className="flex flex-col h-full min-h-0 w-full">
        <SessionSidebar onCollapse={() => setSidebarCollapsed(true)} onNewChat={handleNewChat} />
      </div>
    </aside>
  );
}
