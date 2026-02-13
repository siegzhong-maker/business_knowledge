'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAgentStore } from '@/lib/store';
import { agents } from '@/features/agents/config';
import React, { useEffect, useRef, useState } from 'react';
import { Bot, User, Send, ChevronDown, RotateCcw, Radar, LayoutGrid, RefreshCw } from 'lucide-react';
import { SessionListDropdown } from '@/features/sessions/SessionList';
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

const GXX_PERSISTENT_STEPS = [
  { key: 'productTarget', label: '① 产品+客群', prefill: '我的产品是________，主要面向________。', isDone: (g: any) => {
    const e = (v: unknown) => v == null || v === '' || v === '等待输入...';
    return !e(g?.product) && !e(g?.target);
  }},
  { key: 'niche', label: '② 破局点', prefill: '我的破局切入点是________。', isDone: (g: any) => {
    const e = (v: unknown) => v == null || v === '' || v === '等待输入...';
    return !e(g?.niche);
  }},
  { key: 'diff', label: '③ 差异化', prefill: '我的核心差异化是________。', isDone: (g: any) => {
    const e = (v: unknown) => v == null || v === '' || v === '等待输入...';
    return !e(g?.diff);
  }},
];

function getFallbackSuggestedReplies(canvasData: any): string[] {
  if (!canvasData?.gxx) return [];
  const g = canvasData.gxx;
  const empty = (v: unknown) => v == null || v === "" || v === "等待输入...";
  const hasProduct = !empty(g.product);
  const hasTarget = !empty(g.target);
  const hasPrice = !empty(g.price);
  const hasNiche = !empty(g.niche);
  const hasDiff = !empty(g.diff);
  if (hasProduct && hasTarget && hasPrice && hasNiche && hasDiff) return [];
  if (!hasProduct || !hasTarget) return [];
  if (!hasNiche) {
    return ["先切入律师中的诉讼律师，他们查阅法条最频繁", "先做一线城市律所合伙人，再扩展"];
  }
  if (!hasDiff) {
    return ["主打无摄像头隐私设计，客户在敏感场合也能用", "差异化是即时调取法条，比翻书快 10 倍"];
  }
  if (!hasPrice) {
    return ["客单价约 5 万/年，订阅制", "按年付费，单客 3–8 万不等"];
  }
  return [];
}

/** Strip canvas-schema JSON and updateCanvas tool calls from AI text (fallback when model leaks into reply). */
function sanitizeChatText(text: string): string {
  if (!text?.trim()) return text;
  // 1. Match ```json ... ``` or ``` ... ``` blocks
  const codeBlockRe = /```(?:json)?\s*([\s\S]*?)```/g;
  const canvasSchemaKeywords = ['"product"', '"target"', '"scores"', '"actionList"', '"suggestedReplies"', '"niche"', '"diff"', '"summary"'];
  const updateCanvasFieldNames = ['product', 'target', 'niche', 'diff', 'price', 'summary'];
  let result = text.replace(codeBlockRe, (_, inner) => {
    const trimmed = inner.trim();
    if (!trimmed) return '';
    // Heuristic: if block contains canvas schema fields (JSON format), remove
    const hasCanvasFields = canvasSchemaKeywords.some(k => trimmed.includes(k));
    // Heuristic: if block is updateCanvas(...) with product/target/etc (any format), remove
    const isUpdateCanvasBlock = trimmed.includes('updateCanvas') && updateCanvasFieldNames.some(f => trimmed.includes(f + '=') || trimmed.includes(f + ':'));
    if (hasCanvasFields || isUpdateCanvasBlock) return ''; // Remove entirely
    return `\`\`\`${inner}\`\`\``; // Keep other code blocks
  });

  // 2. Aggressive raw JSON cleanup
  // Match naked JSON-like blocks that contain canvas keywords
  // Heuristic: { ... "keyword" ... }
  const rawJsonRe = /\{[\s\S]*?(?:"product"|"target"|"scores"|"actionList"|"suggestedReplies"|"niche"|"diff"|"summary")[\s\S]*?\}/g;
  result = result.replace(rawJsonRe, (match) => {
    // Double check it looks like JSON (starts with { and ends with })
    if (match.trim().startsWith('{') && match.trim().endsWith('}')) {
       return '';
    }
    return match;
  });

  // 3. Strip leaked updateCanvas tool calls (inline or multiline: updateCanvas(product: "x", target="y") etc.)
  const updateCanvasRe = /updateCanvas\s*\([\s\S]*?\)/g;
  result = result.replace(updateCanvasRe, '');

  // Clean up excessive newlines left by removal
  result = result.replace(/\n{3,}/g, '\n\n').trim();
  return result;
}

function getTextFromNode(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getTextFromNode).join('');
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    if (props?.children != null) return getTextFromNode(props.children);
  }
  return '';
}

function isPlaceholderLikeListItem(text: string): boolean {
  const t = text?.trim() ?? '';
  return !t || t.includes('等待输入') || /^[\u4e00-\u9fa5\/]+\s*[:：]\s*等待输入/.test(t);
}

export function ChatInterface() {
  const { currentAgentId, setAgent, updateCanvasData, canvasData, sessionId, setSessionId, anonymousId, setAnonymousId, resetCanvas, setChatLoading } = useAgentStore();
  const config = agents[currentAgentId];
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [error, setError] = useState<Error | undefined>(undefined);
  
  // Initialize session ID and anonymous identity (for session list ownership)
  useEffect(() => {
    if (!sessionId) setSessionId(uuidv4());
    if (!anonymousId) setAnonymousId(uuidv4());
  }, [sessionId, setSessionId, anonymousId, setAnonymousId]);

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

  // Hydrate session from server on load (restores messages and canvas)
  useEffect(() => {
    if (!sessionId) return;
    
    // Only fetch if we haven't loaded messages yet (or to force sync)
    // For now, simple fetch on mount/sessionId change
    const fetchSession = async () => {
      try {
        const params = new URLSearchParams({ sessionId });
        if (anonymousId) params.set('anonymousId', anonymousId);
        const res = await fetch(`/api/chat?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();

        // 1. Restore Messages
        if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
          const restoredMessages = data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            // Map Prisma toolInvocations to UI shape if needed
            // useChat handles 'toolInvocations' property on message object
            toolInvocations: m.toolInvocations, 
            createdAt: new Date(m.createdAt)
          }));
          setMessages(restoredMessages);
        }

        // 2. Restore Canvas
        if (data.canvasData && data.agentId) {
          updateCanvasData(data.agentId, data.canvasData);
        }
      } catch (error) {
        console.warn('Failed to hydrate session from server:', error);
      }
    };

    fetchSession();
  }, [sessionId, anonymousId, setMessages, updateCanvasData]);

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    setChatLoading(isLoading);
  }, [isLoading, setChatLoading]);

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
            sessionId: sessionId,
            ...(anonymousId && { anonymousId }),
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
  const isValidSuggestedReply = (s: string) =>
    typeof s === 'string' &&
    s.trim().length > 3 &&
    !s.includes('等待输入') &&
    !/^[\u4e00-\u9fa5\/]+\s*[:：]\s*等待输入/.test(s.trim());
  const suggestedReplies = (Array.isArray(apiSuggestedReplies) ? apiSuggestedReplies : [])
    .filter(isValidSuggestedReply)
    .slice(0, 3);
  const showSuggestedReplies =
    !isLoading && lastIsAssistant && suggestedReplies.length > 0;

  const isConsultationComplete = currentAgentId === 'gxx' && canvasData?.gxx?.summary && Array.isArray(canvasData.gxx.actionList) && canvasData.gxx.actionList.length > 0;
  const fallbackReplies = currentAgentId === 'gxx' ? getFallbackSuggestedReplies(canvasData) : [];
  const showFallbackReplies =
    !isLoading && lastIsAssistant && suggestedReplies.length === 0 && fallbackReplies.length > 0 && !isConsultationComplete;
  const chatPlaceholder =
    isConsultationComplete
      ? "可继续追问或导出报告..."
      : currentAgentId === "gxx"
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
    type PartLike = {
      type: string;
      toolInvocation?: { toolName?: string; state?: string; result?: unknown; output?: unknown };
      toolName?: string;
      state?: string;
      output?: unknown;
      result?: unknown;
    };
    const parts: PartLike[] = Array.isArray(latestMsg.parts) ? (latestMsg.parts as PartLike[]) : [];
    for (const p of parts) {
      const toolResult = (x: PartLike): unknown => {
        if (x.toolInvocation && (x.toolInvocation.result !== undefined || x.toolInvocation.output !== undefined)) {
          return x.toolInvocation.result ?? x.toolInvocation.output;
        }
        if (x.output !== undefined || x.result !== undefined) return x.output ?? x.result;
        return undefined;
      };
      // Legacy 'tool-invocation' shape
      if (p.type === 'tool-invocation' && p.toolInvocation) {
        const name = p.toolInvocation.toolName?.toLowerCase();
        if (name === 'updatecanvas') {
          const result = p.toolInvocation.result ?? p.toolInvocation.output;
          if (result != null && (p.toolInvocation.state === 'result' || p.toolInvocation.state === 'output-available' || result !== undefined)) {
            safeUpdateCanvas(currentAgentId, result);
          }
        }
        continue;
      }
      // SDK 6 dynamic-tool / tool-* part
      if (p.type === 'dynamic-tool' || p.type?.startsWith('tool-')) {
        const name = (p.toolName ?? p.type?.replace(/^tool-/, '') ?? '').toLowerCase();
        if (name === 'updatecanvas') {
          const out = toolResult(p);
          if (out != null) safeUpdateCanvas(currentAgentId, out);
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
          <div className="flex items-center gap-1">
            <SessionListDropdown />
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-slate-600"
              onClick={() => {
                // 1. Clear messages (reset to welcome)
                setMessages(
                  config.welcomeMessages.map((m, i) => ({
                    id: `welcome-${config.id}-${i}`,
                    role: 'assistant',
                    parts: [{ type: 'text', text: m }],
                  }))
                );
                // 2. Reset Canvas
                resetCanvas(currentAgentId);
                // 3. New Session ID
                setSessionId(uuidv4());
              }}
              title="新建会话"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
          </div>
       </div>

       {/* Messages */}
       <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-6 bg-slate-50/50 pb-32" ref={scrollRef}>
          {error && (
             <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4 flex items-center justify-between gap-3">
                <span>出错了: {error.message}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-red-600 border-red-200 hover:bg-red-100"
                  onClick={() => {
                    const lastUser = [...messages].reverse().find((m: any) => m.role === 'user') as { content?: string; parts?: { text?: string }[] } | undefined;
                    const lastContent = typeof lastUser?.content === 'string'
                      ? lastUser.content
                      : (Array.isArray(lastUser?.parts)
                        ? lastUser.parts.map(p => p.text ?? '').join('')
                        : '');
                    setError(undefined);
                    if (lastContent?.trim()) {
                      setMessages(messages.filter((m: any) => m !== lastUser));
                      handleSend(lastContent);
                    }
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  重试
                </Button>
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
             // 不渲染无内容的“空气泡”（用户或助手消息内容为空时）
             if (!textContent?.trim()) {
               return null;
             }

             // Strip leaked canvas JSON from assistant replies (fallback)
             const displayText = m.role === 'assistant' && textContent ? sanitizeChatText(textContent) : textContent;

             // For assistant messages, render list items as clickable cards (except placeholder-like)
             const mdComponents =
               m.role === 'assistant'
                 ? {
                     li: ({ children }: { children?: React.ReactNode }) => {
                       const text = getTextFromNode(children);
                       const placeholderLike = isPlaceholderLikeListItem(text);
                       if (placeholderLike) {
                         return (
                           <li className="my-1 list-disc ml-4">
                             {children}
                           </li>
                         );
                       }
                       return (
                         <li className="!list-none !my-1 !p-0 !bg-transparent !border-0 !rounded-none">
                           <button
                             type="button"
                             onClick={(e) => {
                               const btnText = e.currentTarget.textContent?.trim();
                               if (btnText) {
                                 setInput(btnText);
                                 inputRef.current?.focus();
                               }
                             }}
                             className="w-full text-left py-2.5 px-3 rounded-xl bg-amber-50/70 border border-amber-100 cursor-pointer hover:bg-amber-100/80 transition-colors font-medium text-slate-700"
                           >
                             {children}
                           </button>
                         </li>
                       );
                     },
                   }
                 : undefined;

             return (
             <div key={m.id} className={`flex gap-3 max-w-[90%] fade-in ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 shadow-sm border border-slate-100 ${m.role === 'user' ? 'bg-slate-800 text-white' : config.iconColor}`}>
                   {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`p-3 rounded-2xl shadow-sm text-sm leading-relaxed prose prose-sm max-w-none break-words ${m.role === 'user' ? 'prose-invert bg-slate-900 text-white rounded-tr-sm' : 'chat-assistant-message bg-white text-slate-700 rounded-tl-sm border border-slate-100'}`}>
                   {displayText ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{displayText}</ReactMarkdown> : null}
                   {/* Hide tool invocations in UI, they update the canvas */}
                </div>
             </div>
          )})}
          {/* Suggested / fallback replies inside scroll area - avoid blocking conversation */}
          {(showSuggestedReplies || showFallbackReplies) && (
             <div className="pt-2 space-y-2">
                {showSuggestedReplies && (
                   <div className="flex flex-wrap gap-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-full mb-1">快捷回复</p>
                      {suggestedReplies.map((reply: string, i: number) => (
                         <button
                           key={i}
                           type="button"
                           onClick={() => handleSend(reply)}
                           className="whitespace-nowrap px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm rounded-xl border border-blue-200 hover:border-blue-300 transition-colors shadow-sm font-medium"
                         >
                           {reply}
                         </button>
                      ))}
                   </div>
                )}
                {showFallbackReplies && (
                   <div className="flex flex-wrap gap-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-full mb-1">示例回复</p>
                      {fallbackReplies.map((reply: string, i: number) => (
                         <button
                           key={i}
                           type="button"
                           onClick={() => handleSend(reply)}
                           className="whitespace-nowrap px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-xl border border-slate-200 hover:border-slate-300 transition-colors shadow-sm font-medium"
                         >
                           {reply}
                         </button>
                      ))}
                   </div>
                )}
             </div>
          )}
          {isLoading && ((messages[messages.length - 1] as any)?.role === 'user') && (
             <div className="flex gap-3 max-w-[90%] fade-in">
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 shadow-sm border border-slate-100 ${config.iconColor}`}>
                   <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white p-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 text-sm text-slate-700 flex items-center gap-2">
                   <span className="text-slate-500">正在思考</span>
                   <span className="flex gap-1">
                     <span className="w-1.5 h-3 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
                     <span className="w-1.5 h-3 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></span>
                     <span className="w-1.5 h-3 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></span>
                   </span>
                </div>
             </div>
          )}
       </div>

       {/* Input */}
       <div className="p-4 bg-white border-t border-slate-100 absolute bottom-0 w-full z-20">
          {/* Consultation complete banner */}
          {isConsultationComplete && (
             <div className="mb-3 px-4 py-2.5 rounded-xl bg-green-50 border border-green-100 text-sm text-green-700">
               咨询已完成，可继续追问或导出报告
             </div>
          )}
          {/* Step guide - persistent for gxx until consultation complete */}
          {currentAgentId === 'gxx' && !isConsultationComplete && (
             <div className="mb-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">推荐路径</p>
                <div className="flex flex-wrap gap-2">
                   {GXX_PERSISTENT_STEPS.map((s) => {
                     const done = s.isDone(canvasData?.gxx);
                     return (
                       <button
                         key={s.key}
                         type="button"
                         onClick={() => {
                           setInput(s.prefill);
                           inputRef.current?.focus();
                         }}
                         className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                           done
                             ? 'bg-green-50 text-green-700 border-green-200'
                             : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200 hover:border-blue-200'
                         }`}
                       >
                         {done ? `${s.label} ✓` : s.label}
                       </button>
                     );
                   })}
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
               disabled={isLoading}
               className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 resize-none min-h-[50px] max-h-[100px] focus-visible:ring-offset-0 disabled:opacity-50 disabled:bg-slate-100"
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
