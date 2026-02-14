'use client';

import { useCallback } from 'react';
import { useAgentStore } from '@/lib/store';
import { WorkspaceLeftColumn } from '@/features/sessions/WorkspaceLeftColumn';
import { ChatInterface } from '@/features/chat/ChatInterface';
import { CanvasContainer } from '@/features/canvas/CanvasContainer';
import { FloatingToolbar } from '@/features/export/FloatingToolbar';
import { ResizerHandle } from './ResizerHandle';

const RESIZER_WIDTH = 6;
const MIN_SIDEBAR = 200;
const MAX_SIDEBAR = 400;
const MIN_CHAT = 360;
const MAX_CHAT = 600;
const MIN_CANVAS = 400;
const COLLAPSED_SIDEBAR_WIDTH = 56;

export function ResizableWorkspace() {
  const { sidebarCollapsed, sidebarWidth, chatWidth } = useAgentStore();

  const handleSidebarResize = useCallback((deltaX: number) => {
    const state = useAgentStore.getState();
    const totalWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const maxSidebar = totalWidth - RESIZER_WIDTH - state.chatWidth - RESIZER_WIDTH - MIN_CANVAS;
    const clampedMax = Math.min(MAX_SIDEBAR, maxSidebar);
    const newSidebar = Math.min(
      Math.max(state.sidebarWidth + deltaX, MIN_SIDEBAR),
      clampedMax
    );
    useAgentStore.getState().setSidebarWidth(newSidebar);
  }, []);

  const handleChatResize = useCallback((deltaX: number) => {
    const state = useAgentStore.getState();
    const totalWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const leftWidth = state.sidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : state.sidebarWidth;
    const maxChat = totalWidth - leftWidth - RESIZER_WIDTH - RESIZER_WIDTH - MIN_CANVAS;
    const newChat = Math.min(
      Math.max(state.chatWidth + deltaX, MIN_CHAT),
      Math.min(MAX_CHAT, maxChat)
    );
    useAgentStore.getState().setChatWidth(newChat);
  }, []);

  const leftWidth = sidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : sidebarWidth;

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div
        className="h-full shrink-0 flex flex-col"
        style={{ width: leftWidth, minWidth: leftWidth }}
      >
        <WorkspaceLeftColumn />
      </div>
      {!sidebarCollapsed && (
        <ResizerHandle
          onDrag={handleSidebarResize}
          className="self-stretch"
        />
      )}
      <section
        className="shrink-0 flex flex-col overflow-hidden bg-slate-50/80 border-r border-slate-100"
        style={{ width: chatWidth, minWidth: chatWidth }}
      >
        <ChatInterface />
      </section>
      <ResizerHandle className="self-stretch" onDrag={handleChatResize} />
      <section className="flex-1 min-w-[400px] flex flex-col overflow-hidden relative bg-slate-100">
        <CanvasContainer />
        <FloatingToolbar />
      </section>
    </div>
  );
}
