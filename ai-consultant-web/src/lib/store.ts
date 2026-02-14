import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { agents } from '@/features/agents/config';
import { UIMessage as Message } from 'ai';

export interface AgentState {
  currentAgentId: string;
  sessionId: string | null;
  anonymousId: string | null; // Phase 1: stable identity for session list (no login)
  messages: Message[];
  chatLoading: boolean;
  // Ephemeral: true when session list selected a session (skip agent-reset welcome overwrite)
  sessionRestoreInProgress: boolean;
  // Left sidebar: false = expanded (resizable px), true = collapsed (icon strip only)
  sidebarCollapsed: boolean;
  // Resizable layout widths (px), persisted
  sidebarWidth: number;
  chatWidth: number;
  // Store canvas data for each agent: { gxx: {...}, bmc: {...} }
  canvasData: Record<string, any>;

  setAgent: (agentId: string) => void;
  setSidebarCollapsed: (v: boolean) => void;
  setSidebarWidth: (w: number) => void;
  setChatWidth: (w: number) => void;
  setSessionId: (sessionId: string) => void;
  setAnonymousId: (anonymousId: string) => void;
  setSessionRestoreInProgress: (v: boolean) => void;
  setMessages: (messages: Message[]) => void;
  setChatLoading: (loading: boolean) => void;
  addMessage: (message: Message) => void;
  updateCanvasData: (agentId: string, data: any) => void;
  resetCanvas: (agentId: string) => void;
  /** Ephemeral: bump to trigger session list refetch (e.g. after send or delete). */
  sessionListVersion: number;
  invalidateSessionList: () => void;
  /** Trigger chat to send a message (e.g. "从对话重新提取"). Canvas sets this, ChatInterface consumes. */
  pendingExtractMessage: string | null;
  setPendingExtractMessage: (msg: string | null) => void;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set) => ({
      currentAgentId: 'gxx',
      sessionId: null,
      anonymousId: null,
      messages: [],
      chatLoading: false,
      sessionRestoreInProgress: false,
      sidebarCollapsed: false,
      sidebarWidth: 260,
      chatWidth: 420,
      canvasData: {
        gxx: agents.gxx.initialState,
        bmc: agents.bmc.initialState,
      },

      setAgent: (agentId) => set({ currentAgentId: agentId, messages: [] }), // Reset chat on switch for now
      setSessionId: (sessionId) => set({ sessionId }),
      setAnonymousId: (anonymousId) => set({ anonymousId }),
      setSessionRestoreInProgress: (sessionRestoreInProgress) => set({ sessionRestoreInProgress }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      setChatWidth: (chatWidth) => set({ chatWidth }),
      setMessages: (messages) => set({ messages }),
      setChatLoading: (chatLoading) => set({ chatLoading }),
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      
      updateCanvasData: (agentId, data) => set((state) => {
        const merged = { ...state.canvasData[agentId], ...data };
        // When AI updates actionList, sync actionListChecked length (preserve existing check state)
        if (agentId === 'gxx' && Array.isArray(data.actionList)) {
          const existing = (state.canvasData.gxx?.actionListChecked as boolean[]) ?? [];
          merged.actionListChecked = data.actionList.map((_: unknown, i: number) => existing[i] ?? false);
        }
        return { canvasData: { ...state.canvasData, [agentId]: merged } };
      }),

      resetCanvas: (agentId) => set((state) => ({
        canvasData: {
          ...state.canvasData,
          [agentId]: agents[agentId].initialState
        }
      })),

      sessionListVersion: 0,
      invalidateSessionList: () => set({ sessionListVersion: Date.now() }),

      pendingExtractMessage: null,
      setPendingExtractMessage: (msg) => set({ pendingExtractMessage: msg }),
    }),
    {
      name: 'ai-consultant-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
      partialize: (state) => ({
        currentAgentId: state.currentAgentId,
        sessionId: state.sessionId,
        anonymousId: state.anonymousId,
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
        chatWidth: state.chatWidth,
      }),
    }
  )
);
