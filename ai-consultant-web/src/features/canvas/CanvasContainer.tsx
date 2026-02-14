'use client';

import { useAgentStore } from '@/lib/store';
import { agents } from '@/features/agents/config';
import { GaoXiaoxinView } from './gxx/GaoXiaoxinView';
import { BMCGridView } from './bmc/BMCGridView';

export function CanvasContainer() {
  const currentAgentId = useAgentStore((state) => state.currentAgentId);
  const config = agents[currentAgentId];

  return (
    <div className="w-full flex-1 bg-slate-100 relative overflow-y-auto overflow-x-hidden flex justify-center p-8 pb-28">
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div className="z-10 w-full max-w-6xl flex justify-center">
        {config?.canvasComponent === 'GaoXiaoxinView' && <GaoXiaoxinView />}
        {config?.canvasComponent === 'BMCGridView' && <BMCGridView />}
      </div>
    </div>
  );
}
