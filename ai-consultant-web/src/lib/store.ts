import { create } from 'zustand';
import { agents } from '@/features/agents/config';
import { UIMessage as Message } from 'ai';

export interface AgentState {
  currentAgentId: string;
  sessionId: string | null;
  messages: Message[];
  // Store canvas data for each agent: { gxx: {...}, bmc: {...} }
  canvasData: Record<string, any>;
  
  setAgent: (agentId: string) => void;
  setSessionId: (sessionId: string) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateCanvasData: (agentId: string, data: any) => void;
  resetCanvas: (agentId: string) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  currentAgentId: 'gxx',
  sessionId: null,
  messages: [],
  canvasData: {
    gxx: agents.gxx.initialState,
    bmc: agents.bmc.initialState,
  },

  setAgent: (agentId) => set({ currentAgentId: agentId, messages: [] }), // Reset chat on switch for now
  setSessionId: (sessionId) => set({ sessionId }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  
  updateCanvasData: (agentId, data) => set((state) => ({
    canvasData: {
      ...state.canvasData,
      [agentId]: { ...state.canvasData[agentId], ...data }
    }
  })),

  resetCanvas: (agentId) => set((state) => ({
    canvasData: {
      ...state.canvasData,
      [agentId]: agents[agentId].initialState
    }
  }))
}));
