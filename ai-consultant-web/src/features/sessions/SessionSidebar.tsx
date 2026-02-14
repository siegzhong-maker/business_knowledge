'use client';

import { useEffect, useState } from 'react';
import { useAgentStore } from '@/lib/store';
import { agents } from '@/features/agents/config';
import { Button } from '@/components/ui/button';
import { Plus, Radar, LayoutGrid, PanelLeftClose, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export interface SessionItem {
  id: string;
  agentId: string;
  title?: string;
  updatedAt: string;
  createdAt: string;
}

export interface SessionSidebarProps {
  onCollapse?: () => void;
  onNewChat?: () => void;
}

export function SessionSidebar({ onCollapse, onNewChat }: SessionSidebarProps = {}) {
  const {
    anonymousId,
    setAnonymousId,
    sessionId,
    setSessionId,
    setAgent,
    setSessionRestoreInProgress,
    currentAgentId,
    sessionListVersion,
    invalidateSessionList,
  } = useAgentStore();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (!anonymousId) return;
    setLoading(true);
    fetch(`/api/sessions?anonymousId=${encodeURIComponent(anonymousId)}&limit=30`)
      .then((res) => (res.ok ? res.json() : { sessions: [] }))
      .then((data) => {
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [anonymousId, sessionListVersion]);

  const agentName = (id: string) => agents[id as keyof typeof agents]?.name ?? id;
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      return sameDay
        ? d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString('zh-CN');
    } catch {
      return '';
    }
  };

  const handleNewSession = () => {
    if (onNewChat) {
      onNewChat();
      return;
    }
    setSessionId(uuidv4());
  };

  const handleSelectSession = (s: SessionItem) => {
    setSessionRestoreInProgress(true);
    setAgent(s.agentId);
    setSessionId(s.id);
  };

  const handleDeleteSession = async (e: React.MouseEvent, s: SessionItem) => {
    e.stopPropagation();
    if (!anonymousId) return;
    if (!confirm('确定删除该会话？对话记录将无法恢复。')) return;
    try {
      const res = await fetch(
        `/api/sessions/${encodeURIComponent(s.id)}?anonymousId=${encodeURIComponent(anonymousId)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) return;
      invalidateSessionList();
      if (s.id === sessionId) {
        if (onNewChat) onNewChat();
        else setSessionId(uuidv4());
      }
    } catch {
      // ignore
    }
  };
  
  const handleEditAnonymousId = () => {
    const newId = prompt('请输入您的匿名ID (UUID格式) 以恢复历史记录:', anonymousId || '');
    if (newId && newId.trim() !== anonymousId) {
      if (confirm('更改 ID 将切换到新的用户身份，当前未保存的会话可能丢失。确定吗？')) {
        setAnonymousId(newId.trim());
        // Force refresh session list
        invalidateSessionList();
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-slate-100 shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-1">
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
              title="收起对话历史"
              aria-label="收起对话历史"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
          <span
            className="text-base font-bold text-slate-800 tracking-wider truncate min-w-0 flex-1"
            title="当前智能体"
          >
            {agentName(currentAgentId)}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-center gap-2 border-slate-200 text-slate-700 hover:bg-slate-50"
          onClick={handleNewSession}
        >
          <Plus className="w-4 h-4" />
          新会话
        </Button>
      </div>

      <div className="p-2 border-b border-slate-100 shrink-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
          智能体
        </span>
        <div className="flex flex-col gap-0.5">
          {Object.values(agents).map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => {
                setAgent(agent.id);
                setSessionId(uuidv4());
              }}
              className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm ${
                currentAgentId === agent.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${agent.iconColor}`}
              >
                {agent.id === 'gxx' ? (
                  <Radar className="w-3.5 h-3.5" />
                ) : (
                  <LayoutGrid className="w-3.5 h-3.5" />
                )}
              </div>
              <span className="font-medium truncate">{agent.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-slate-500">加载中...</div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500">暂无历史会话</div>
        ) : (
          <ul className="py-1 px-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <div
                  className={`group flex items-stretch rounded-lg border-l-2 ${
                    s.id === sessionId
                      ? 'bg-blue-50 border-blue-500'
                      : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectSession(s)}
                    title={s.title ? `${s.title} · ${agentName(s.agentId)}` : undefined}
                    className={`flex-1 min-w-0 text-left px-3 py-2.5 text-sm transition-colors flex flex-col gap-0.5 ${
                      s.id === sessionId ? 'text-blue-800' : 'text-slate-700'
                    }`}
                  >
                    <span className="font-medium truncate" title={s.title || '未命名会话'}>{s.title || '未命名会话'}</span>
                    <span className="text-xs text-slate-500 flex items-center justify-between gap-1">
                      <span className="truncate">{agentName(s.agentId)}</span>
                      <span className="shrink-0">{formatTime(s.updatedAt)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSession(e, s)}
                    className="shrink-0 p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="删除会话"
                    aria-label="删除会话"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Anonymous ID Debug Footer */}
      <div 
        className="p-2 border-t border-slate-100 text-[10px] text-slate-400 text-center cursor-pointer hover:text-slate-600 transition-colors"
        onClick={() => setShowDebug(!showDebug)}
        title="点击显示/隐藏调试信息"
      >
        ID: {anonymousId?.slice(0, 8)}...
      </div>
      
      {showDebug && (
        <div className="p-2 bg-slate-50 border-t border-slate-100 text-xs">
          <div className="mb-1 text-slate-500 font-mono break-all">{anonymousId}</div>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full h-7 text-xs"
            onClick={handleEditAnonymousId}
          >
            修改 ID (恢复历史)
          </Button>
        </div>
      )}
    </div>
  );
}
