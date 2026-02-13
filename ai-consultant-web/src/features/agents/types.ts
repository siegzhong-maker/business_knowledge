import { z } from 'zod';

export type CanvasComponentType = 'GaoXiaoxinView' | 'BMCGridView';

export interface GuidedStep {
  step: number;
  label: string;
  /** Template pre-filled into input for user to edit and send (not sent to AI directly) */
  prefill: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  iconColor: string;
  systemPrompt: string;
  welcomeMessages: string[];
  canvasComponent: CanvasComponentType;
  schema: z.ZodType<any, any>;
  initialState: any;
  /** Suggested reply buttons shown under assistant messages (e.g. gxx) */
  suggestedRepliesTemplates?: string[];
  /** Step-by-step prompts for welcome flow (product → target → diff) */
  guidedSteps?: GuidedStep[];
}
