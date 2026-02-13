'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAgentStore } from '@/lib/store';
import { agents } from '@/features/agents/config';
import { useEffect, useRef, useState } from 'react';
import { Bot, User, Send, ChevronDown, RotateCcw, Radar, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';

const PLACEHOLDER_BY_STEP: Record<number, string> = {
  0: "描述一下产品形态、准备卖给谁…",
  1: "你的目标客户是谁？可简短说…",
  2: "破局点或核心差异化是什么？",
  3: "补充或修改任意一项，或直接问顾问…"
};

function getPlaceholderForGxx(canvasData: any): string {
  if (!canvasData?.gxx) return PLACEHOLDER_BY_STEP[0];
  const g = canvasData.gxx;
  const empty = (v: unknown) => v == null || v === "" || v === "等待输入...";
  const filled = [g.product, g.target, g.price, g.niche, g.diff].filter(v => !empty(v)).length;
  const step = Math.min(filled, 3);
  return PLACEHOLDER_BY_STEP[step];
}

export function ChatInterface() {
  const { currentAgentId, setAgent, updateCanvasData, canvasData, sessionId, setSessionId } = useAgentStore();
  const config = agents[currentAgentId];
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [error, setError] = useState<Error | undefined>(undefined);
  
  // Initialize session ID
  useEffect(() => {
    if (!sessionId) {
      setSessionId(uuidv4());
    }
  }, [sessionId, setSessionId]);

  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    // Seed chat with welcome messages in UIMessage shape (parts-based)
    messages: config.welcomeMessages.map((m, i) => ({
      id: `welcome-${config.id}-${i}`,
      role: 'assistant',
      parts: [{ type: 'text', text: m }],
    })),
    onError: (err) => {
       console.error('Chat error:', err);
       setError(err);
    },
    onFinish: (message: any) => {
       // Tool invocations are handled by the useEffect below
    }
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    
    handleSend(input);
  };

  const handleSend = async (value: string) => {
    setInput('');
    setError(undefined);
    if (currentAgentId === 'gxx') {
      updateCanvasData('gxx', { suggestedReplies: [] });
    }
    
    try {
      // `useChat` will construct the proper UIMessage with parts internally
      await sendMessage(
        { text: value },
        {
          body: { 
            agentId: currentAgentId,
            sessionId: sessionId
          },
        },
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err : new Error('Failed to send message'));
      setInput(value);
    }
  };

  const quickReplies = [
    "我想做面向大企业的员工心理健康 AI 服务",
    "我的产品是智能 AI 眼镜",
    "想做一个针对留学生的求职辅导平台"
  ];

  const isWelcomeOnly = messages.length === config.welcomeMessages.length;
  const lastMessage = messages[messages.length - 1];
  const lastIsAssistant = (lastMessage as any)?.role === "assistant";
  const apiSuggestedReplies = (currentAgentId === 'gxx' ? canvasData?.gxx?.suggestedReplies : null) ?? [];
  const showSuggestedReplies =
    !isLoading && lastIsAssistant && Array.isArray(apiSuggestedReplies) && apiSuggestedReplies.length > 0;
  const suggestedReplies = apiSuggestedReplies.slice(0, 3);

  const chatPlaceholder =
    currentAgentId === "gxx"
      ? getPlaceholderForGxx(canvasData)
      : "直接打字回复...";

  // Watch for tool results to update canvas (AI SDK 6: parts with output; legacy: toolInvocations with result)
  useEffect(() => {
    // 1. Check the very last message first (most likely source of updates in streaming)
    const latestMsg = messages[messages.length - 1];
    if (!latestMsg || latestMsg.role !== 'assistant') return;

    const safeUpdateCanvas = (agentId: string, data: any) => {
      if (!data) return;
      
      // Normalize 'scores' keys to lowercase (High -> high) to handle model inconsistency
      const normalizedData = { ...data };
      if (normalizedData.scores && typeof normalizedData.scores === 'object') {
        const normalizedScores: Record<string, number> = {};
        Object.keys(normalizedData.scores).forEach((key) => {
          normalizedScores[key.toLowerCase()] = normalizedData.scores[key];
        });
        normalizedData.scores = normalizedScores;
      }

      // Ensure actionList is always an array so .map() in GaoXiaoxinView never throws
      if ('actionList' in normalizedData) {
        if (!Array.isArray(normalizedData.actionList)) {
          const raw = normalizedData.actionList;
          if (raw == null) {
            normalizedData.actionList = [];
          } else if (typeof raw === 'object' && raw !== null) {
            normalizedData.actionList = Object.values(raw).map((v) => String(v));
          } else {
            normalizedData.actionList = [String(raw)];
          }
        }
      }

      updateCanvasData(agentId, normalizedData);
    };

    // 2. Handle 'parts' (newer SDK: tool-invocation legacy shape or dynamic-tool / tool-* types)
    // Cast to PartLike[] so TS doesn't narrow part.type to only 'text' (SDK types can be strict)
    type PartLike = {
      type: string;
      toolInvocation?: { toolName?: string; state?: string; result?: unknown };
      toolName?: string;
      state?: string;
      output?: unknown;
    };
    const parts: PartLike[] = Array.isArray(latestMsg.parts) ? (latestMsg.parts as PartLike[]) : [];
    for (const p of parts) {
      // Legacy 'tool-invocation' shape
      if ((p as PartLike).type === 'tool-invocation' && p.toolInvocation) {
        const toolName = p.toolInvocation.toolName?.toLowerCase();
        if (toolName === 'updatecanvas' && p.toolInvocation.state === 'result') {
          safeUpdateCanvas(currentAgentId, p.toolInvocation.result);
        }
        continue;
      }
      // SDK 6 dynamic-tool / tool-* part (e.g. type === 'dynamic-tool' or 'tool-updateCanvas')
      if ((p.type === 'dynamic-tool' || p.type?.startsWith('tool-')) && (p.toolName || p.type?.replace(/^tool-/, ''))) {
        const name = (p.toolName ?? p.type.replace(/^tool-/, '')).toLowerCase();
        if (name === 'updatecanvas' && (p.state === 'output-available' || p.state === 'result') && p.output !== undefined) {
          safeUpdateCanvas(currentAgentId, p.output);
        }
      }
    }

    // 3. Handle 'toolInvocations' property (top-level on message)
    const msgWithTools = latestMsg as { toolInvocations?: Array<{ toolName?: string; result?: unknown; args?: unknown }> };
    if (Array.isArray(msgWithTools.toolInvocations)) {
      msgWithTools.toolInvocations.forEach((tool: any) => {
        if (tool?.toolName?.toLowerCase() === 'updatecanvas') {
           // We accept both partial (args) and final (result) updates if possible, 
           // but 'result' is safer. If 'args' are available during stream, we can use them too.
           if ('result' in tool) {
              safeUpdateCanvas(currentAgentId, tool.result);
           } else if ('args' in tool) {
              // Optional: Optimistic update from args while streaming
              safeUpdateCanvas(currentAgentId, tool.args);
           }
        }
      });
    }
  }, [messages, currentAgentId, updateCanvasData]);

  // Scroll to bottom on new message
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle agent switching reset
  // We use a key on the component in the parent page to force re-mount, 
  // but if we are inside the same component, we need to reset manually.
  // For now, let's assume the parent handles the key={currentAgentId} or we rely on `useChat`'s `initialMessages` update.
  // Actually `useChat` does not automatically reset when `initialMessages` change.
  // We should call `setMessages` when `currentAgentId` changes.
  useEffect(() => {
    // Reset messages with proper UIMessage shape when switching agents
    setMessages(
      config.welcomeMessages.map((m, i) => ({
        id: `welcome-${config.id}-${i}`,
        role: 'assistant',
        parts: [{ type: 'text', text: m }],
      })),
    );
    setInput('');
    setError(undefined);
  }, [currentAgentId, config.welcomeMessages, setMessages, config.id]);


  return (
    <div className="w-[35%] min-w-[380px] max-w-[450px] bg-white border-r border-slate-200 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10 relative h-full">
       {/* Header */}
       <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white/95 backdrop-blur z-30 relative">
          <div className="flex items-center gap-3 cursor-pointer group relative">
             <div className={`w-10 h-10 rounded-full flex items-center justify-center relative transition-transform group-hover:scale-105 ${config.iconColor}`}>
                <Bot className="w-6 h-6" />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
             </div>
             <div className="group relative">
                <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-1">
                   {config.name}
                   <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                </h2>
                <p className="text-xs text-slate-500">{config.description}</p>
                
                {/* Dropdown (Hover implementation) */}
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 hidden group-hover:flex flex-col overflow-hidden z-50">
                   <div className="p-2 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">核心智能体模型库</div>
                   {Object.values(agents).map(agent => (
                      <button key={agent.id} onClick={() => setAgent(agent.id)} className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0">
                         <div className={`w-8 h-8 rounded flex items-center justify-center ${agent.iconColor}`}>
                            {agent.id === 'gxx' ? <Radar className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
                         </div>
                         <div>
                            <div className="font-medium text-sm text-slate-800">{agent.name}</div>
                            <div className="text-[10px] text-slate-500">{agent.description}</div>
                         </div>
                      </button>
                   ))}
                </div>
             </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-slate-600"
            onClick={() =>
              setMessages(
                config.welcomeMessages.map((m, i) => ({
                  id: `welcome-${config.id}-${i}`,
                  role: 'assistant',
                  parts: [{ type: 'text', text: m }],
                }))
              )
            }
            title="重置会话"
          >
             <RotateCcw className="w-5 h-5" />
          </Button>
       </div>

       {/* Messages */}
       <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50 pb-32 no-scrollbar" ref={scrollRef}>
          {error && (
             <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
                出错了: {error.message}
             </div>
          )}
          {messages.map((m: any) => {
             // Support both `content` (older shape) and `parts` (UIMessage shape); include text + reasoning
             let textContent =
               m.content ??
               (Array.isArray(m.parts)
                 ? m.parts
                     .filter((p: any) => (p.type === 'text' || p.type === 'reasoning') && typeof p.text === 'string')
                     .map((p: any) => p.text)
                     .join('')
                 : '');
             // When assistant only sent tool calls (e.g. updateCanvas) with no text, do NOT show the bubble at all
             const hasToolParts = Array.isArray(m.parts) && m.parts.some((p: any) => p.type?.startsWith?.('tool-') || p.type === 'dynamic-tool');
             if (m.role === 'assistant' && !textContent?.trim() && hasToolParts) {
               return null;
             }

             return (
             <div key={m.id} className={`flex gap-3 max-w-[90%] fade-in ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 shadow-sm border border-slate-100 ${m.role === 'user' ? 'bg-slate-800 text-white' : config.iconColor}`}>
                   {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`p-3 rounded-2xl shadow-sm text-sm leading-relaxed prose prose-sm max-w-none ${m.role === 'user' ? 'prose-invert bg-slate-900 text-white rounded-tr-sm' : 'bg-white text-slate-700 rounded-tl-sm border border-slate-100'}`}>
                   {textContent ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{textContent}</ReactMarkdown> : null}
                   {/* Hide tool invocations in UI, they update the canvas */}
                </div>
             </div>
          )})}
          {isLoading && ((messages[messages.length - 1] as any)?.role === 'user') && (
             <div className="flex gap-3 max-w-[90%] fade-in">
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 shadow-sm border border-slate-100 ${config.iconColor}`}>
                   <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white p-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 text-sm text-slate-700">
                   <span className="w-1.5 h-4 bg-slate-400 inline-block animate-pulse align-middle"></span>
                </div>
             </div>
          )}
          {showSuggestedReplies && (
             <div className="flex flex-wrap gap-2 mt-1 ml-11">
                {suggestedReplies.map((reply: string, i: number) => (
                   <button
                     key={i}
                     type="button"
                     onClick={() => handleSend(reply)}
                     className="whitespace-nowrap px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 text-xs rounded-full border border-slate-200 hover:border-blue-200 transition-colors shadow-sm"
                   >
                     {reply}
                   </button>
                ))}
             </div>
          )}
       </div>

       {/* Input */}
       <div className="p-4 bg-white border-t border-slate-100 absolute bottom-0 w-full z-20">
          {/* Step guide - when only welcome messages */}
          {isWelcomeOnly && config.guidedSteps && config.guidedSteps.length > 0 && (
             <div className="mb-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">推荐路径</p>
                <div className="flex flex-wrap gap-2">
                   {config.guidedSteps.map((s) => (
                      <button
                        key={s.step}
                        type="button"
                        onClick={() => {
                          setInput(s.prefill);
                          inputRef.current?.focus();
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs rounded-lg border border-slate-200 hover:border-blue-200 transition-colors"
                      >
                        {s.label}
                      </button>
                   ))}
                </div>
             </div>
          )}
          {/* Quick Replies - Only show when no USER messages exist yet */}
          {!messages.some((m: { role: string }) => m.role === 'user') && (
             <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar mb-1">
                {quickReplies.map((reply, i) => (
                   <button 
                     key={i} 
                     onClick={() => handleSend(reply)} 
                     className="whitespace-nowrap px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-200 transition-colors shadow-sm font-medium"
                   >
                      {reply}
                   </button>
                ))}
             </div>
          )}

          <form onSubmit={handleSubmit} className="relative flex items-center">
             <Textarea
               ref={inputRef}
               value={input || ''}
               onChange={handleInputChange}
               placeholder={chatPlaceholder}
               className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 resize-none min-h-[50px] max-h-[100px] focus-visible:ring-offset-0"
               onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }}
             />
             <Button type="submit" size="icon" disabled={isLoading || !(input || '').trim()} className="absolute right-2 top-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-8 w-8">
                <Send className="w-4 h-4" />
             </Button>
          </form>
       </div>
    </div>
  );
}
