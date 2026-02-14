import type { z } from 'zod';

export type CanvasComponentType = 'GaoXiaoxinView' | 'BMCGridView';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  iconColor: string;
  canvasComponent: CanvasComponentType;
  schema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  initialState: Record<string, unknown>;
  welcomeMessages: string[];
  guidedSteps?: { step: number; label: string; prefill: string }[];
  systemPrompt: string;
}
