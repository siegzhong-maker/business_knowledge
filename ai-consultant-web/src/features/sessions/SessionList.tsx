'use client';

import { useEffect, useState } from 'react';
import { useAgentStore } from '@/lib/store';
import { agents } from '@/features/agents/config';
import { Button } from '@/components/ui/button';
import { History } from 'lucide-react';

export interface SessionItem {
  id: string;
  agentId: string;
  title?: string;
  updatedAt: string;
  createdAt: string;
}

export function SessionListDropdown() {
  const { anonymousId, sessionId, setSessionId, setAgent } = useAgentStore();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !anonymousId) return;
    setLoading(true);
    fetch(`/api/sessions?anonymousId=${encodeURIComponent(anonymousId)}&limit=30`)
      .then((res) => (res.ok ? res.json() : { sessions: [] }))
      .then((data) => {
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [open, anonymousId]);

  const agentName = (id: string) => agents[id as keyof typeof agents]?.name ?? id;
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      return sameDay ? d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('zh-CN');
    } catch {
      return '';
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="text-slate-400 hover:text-slate-600"
        onClick={() => setOpen((o) => !o)}
        title="会话历史"
      >
        <History className="w-5 h-5" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 max-h-[70vh] overflow-hidden bg-white rounded-xl shadow-xl border border-slate-200 z-50 flex flex-col">
            <div className="p-2 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              会话历史
            </div>
            <div className="overflow-y-auto min-h-0 flex-1">
              {loading ? (
                <div className="p-4 text-center text-sm text-slate-500">加载中...</div>
              ) : sessions.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">暂无历史会话</div>
              ) : (
                <ul className="py-1">
                  {sessions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setAgent(s.agentId);
                          setSessionId(s.id);
                          setOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 flex flex-col gap-0.5 ${s.id === sessionId ? 'bg-blue-50/80 text-blue-800' : 'text-slate-700'}`}
                      >
                        <span className="font-medium truncate">{s.title || '未命名会话'}</span>
                        <span className="text-xs text-slate-500 flex items-center justify-between">
                          <span>{agentName(s.agentId)}</span>
                          <span>{formatTime(s.updatedAt)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
