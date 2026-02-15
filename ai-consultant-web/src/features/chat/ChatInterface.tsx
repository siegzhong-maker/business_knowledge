'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAgentStore } from '@/lib/store';
import { agents } from '@/features/agents/config';
import React, { useEffect, useRef, useState } from 'react';
import { Bot, User, Send, RefreshCw, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';

const PLACEHOLDER_BY_STEP: Record<number, string> = {
  0: "描述一下产品形态、准备卖给谁…",
  1: "你的目标客户是谁？可简短说…",
  2: "利润天花板或客单价大概怎样？",
  3: "破局切入点或细分人群是？",
  4: "核心差异化是什么？",
  5: "补充或修改任意一项，或直接问顾问…"
};

function getPlaceholderForGxx(canvasData: any): string {
  if (!canvasData?.gxx) return PLACEHOLDER_BY_STEP[0];
  const g = canvasData.gxx;
  const empty = (v: unknown) => v == null || v === "" || v === "等待输入...";
  const filled = [g.product, g.target, g.price, g.niche, g.diff].filter(v => !empty(v)).length;
  const step = Math.min(filled, 5);
  return PLACEHOLDER_BY_STEP[step];
}

const GXX_PERSISTENT_STEPS = [
  { key: 'product', label: '① 产品', prefill: '我的产品/服务是________。', isDone: (g: any) => {
    const e = (v: unknown) => v == null || v === '' || v === '等待输入...';
    return !e(g?.product);
  }},
  { key: 'target', label: '② 客群', prefill: '我的目标客群是________。', isDone: (g: any) => {
    const e = (v: unknown) => v == null || v === '' || v === '等待输入...';
    return !e(g?.target);
  }},
  { key: 'price', label: '③ 利润天花板', prefill: '客单价约________，利润天花板/频次________。', isDone: (g: any) => {
    const e = (v: unknown) => v == null || v === '' || v === '等待输入...';
    return !e(g?.price);
  }},
  { key: 'niche', label: '④ 破局点', prefill: '我的破局切入点是________。', isDone: (g: any) => {
    const e = (v: unknown) => v == null || v === '' || v === '等待输入...';
    return !e(g?.niche);
  }},
  { key: 'diff', label: '⑤ 差异化', prefill: '我的核心差异化是________。', isDone: (g: any) => {
    const e = (v: unknown) => v == null || v === '' || v === '等待输入...';
    return !e(g?.diff);
  }},
];

function getGxxFilledCount(canvasData: any): number {
  if (!canvasData?.gxx) return 0;
  const g = canvasData.gxx;
  const empty = (v: unknown) => v == null || v === '' || v === '等待输入...';
  return [g.product, g.target, g.price, g.niche, g.diff].filter(v => !empty(v)).length;
}

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
    return ["先切入细分人群中最痛的那批，再逐步扩展", "先做一线城市标杆客户，验证后再复制"];
  }
  if (!hasDiff) {
    return ["差异化在于新渠道红利，比竞品更早触达目标人群", "主打服务体验和口碑，形成复购闭环"];
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
  const { currentAgentId, updateCanvasData, canvasData, sessionId, setSessionId, anonymousId, setAnonymousId, setChatLoading, sessionRestoreInProgress, setSessionRestoreInProgress, invalidateSessionList, pendingExtractMessage, setPendingExtractMessage, setSessionTitle } = useAgentStore();
  const config = agents[currentAgentId];
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const sendingRef = useRef(false);
  const restoringRef = useRef(false);
  const [isSending, setIsSending] = useState(false);

  const [error, setError] = useState<Error | undefined>(undefined);
  const lastAutoExtractMsgIdRef = useRef<string | null>(null);
  const [canvasUpdateToastFields, setCanvasUpdateToastFields] = useState<string[]>([]);

  const GXX_FIELD_LABELS: Record<string, string> = {
    product: '产品/服务',
    target: '目标客群',
    price: '利润天花板',
    niche: '破局切入点',
    diff: '核心差异化',
  };

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
    messages: config.welcomeMessages.map((m: string, i: number) => ({
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

  // Unified session restore: on sessionId change, fetch from server (404 = new session, 200 = restore)
  useEffect(() => {
    if (!sessionId || !anonymousId) return;

    restoringRef.current = true;
    setSessionRestoreInProgress(true);
    const fetchSession = async () => {
      try {
        const params = new URLSearchParams({ sessionId, anonymousId });
        const res = await fetch(`/api/chat?${params.toString()}`);
        if (!res.ok) {
          // New session (404): welcome messages + initial canvas
          if (res.status === 404) {
            const agentConfig = agents[currentAgentId as keyof typeof agents];
            const initialState = agentConfig?.initialState ?? {};
            setMessages(
              config.welcomeMessages.map((m: string, i: number) => ({
                id: `welcome-${config.id}-${i}`,
                role: 'assistant',
                parts: [{ type: 'text' as const, text: m }],
              }))
            );
            updateCanvasData(currentAgentId, initialState);
          }
          setSessionRestoreInProgress(false);
          return;
        }
        const data = await res.json();

        // 1. Restore Messages
        if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
          const restoredMessages = data.messages.map((m: any) => {
            const text = typeof m.content === 'string' ? m.content : '';
            return {
              id: m.id,
              role: m.role,
              content: text,
              parts: [{ type: 'text' as const, text }],
              toolInvocations: Array.isArray(m.toolInvocations) ? m.toolInvocations : undefined,
              createdAt: new Date(m.createdAt),
            };
          });
          setMessages(restoredMessages);
        } else {
          setMessages(
            config.welcomeMessages.map((m: string, i: number) => ({
              id: `welcome-${config.id}-${i}`,
              role: 'assistant',
              parts: [{ type: 'text' as const, text: m }],
            }))
          );
        }

        // 2. Restore Canvas
        if (data.canvasData && data.agentId) {
          updateCanvasData(data.agentId, data.canvasData);
        } else {
          const agentConfig = agents[(data.agentId || currentAgentId) as keyof typeof agents];
          if (agentConfig?.initialState) {
            updateCanvasData(data.agentId || currentAgentId, agentConfig.initialState);
          }
        }

        setSessionRestoreInProgress(false);
      } catch (error) {
        console.warn('Failed to hydrate session from server:', error);
        setSessionRestoreInProgress(false);
      } finally {
        restoringRef.current = false;
      }
    };

    fetchSession();
  }, [sessionId, anonymousId, currentAgentId, setMessages, updateCanvasData, setSessionRestoreInProgress, config.welcomeMessages, config.id]);

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    setChatLoading(isLoading);
  }, [isLoading, setChatLoading]);

  // Auto-complete: when assistant finishes and canvas is incomplete (5 fields + scores but no summary/actionList), trigger extract after 3s (once per assistant message)
  useEffect(() => {
    if (isLoading || currentAgentId !== 'gxx') return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;
    if (lastAutoExtractMsgIdRef.current === lastMsg.id) return;

    // Avoid loop: do not auto-trigger if last user message was our extract prompt
    const lastUserMsg = [...messages].reverse().find((m: { role?: string }) => m.role === 'user') as { content?: string; parts?: { text?: string }[] } | undefined;
    const lastUserText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : (Array.isArray(lastUserMsg?.parts) ? (lastUserMsg.parts as { text?: string }[]).map((p) => p.text ?? '').join('') : '');
    if (lastUserText?.includes('请根据当前对话历史重新提取')) return;

    const g = canvasData?.gxx;
    const empty = (v: unknown) => v == null || v === '' || v === '等待输入...';
    const filledCount = [g?.product, g?.target, g?.price, g?.niche, g?.diff].filter((v) => !empty(v)).length;
    const hasAnyScore = ((g?.scores?.high || 0) + (g?.scores?.small || 0) + (g?.scores?.new || 0)) > 0;
    const missingSummaryOrActions = !g?.summary?.trim() || !Array.isArray(g?.actionList) || g.actionList.length === 0;

    if (filledCount < 5 || !hasAnyScore || !missingSummaryOrActions) return;

    const timer = setTimeout(() => {
      lastAutoExtractMsgIdRef.current = lastMsg.id;
      setPendingExtractMessage('请根据当前对话历史重新提取并更新画布所有字段。务必调用 updateCanvas 填写 summary、actionList、scores: { high, small, new }（各 0-5 分）、scoreReasons，四者缺一不可。');
    }, 3000);
    return () => clearTimeout(timer);
  }, [isLoading, messages, currentAgentId, canvasData, setPendingExtractMessage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    
    handleSend(input);
  };

  const handleSend = async (value: string) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setIsSending(true);
    setInput('');
    setError(undefined);
    setExpandedReplies(new Set()); // Clear expanded replies when sending
    if (currentAgentId === 'gxx') {
      updateCanvasData('gxx', { suggestedReplies: [] });
    }

    try {
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
      invalidateSessionList();
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err : new Error('Failed to send message'));
      setInput(value);
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  // When canvas requests "从对话重新提取", send the extract prompt
  useEffect(() => {
    if (!pendingExtractMessage?.trim()) return;
    const msg = pendingExtractMessage;
    setPendingExtractMessage(null);
    void handleSend(msg);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- handleSend is intentionally omitted to avoid re-running on its deps
  }, [pendingExtractMessage, setPendingExtractMessage]);

  const quickReplies = [
    "我有成熟 SaaS 业务，想拓展新渠道或新品类",
    "我想做面向大企业的员工心理健康 AI 服务",
    "现有业务增长放缓，想探索第二增长曲线"
  ];

  const isWelcomeOnly = messages.length === config.welcomeMessages.length;
  const firstUserMessage = messages.find((m: any) => m.role === 'user') as { content?: string; parts?: { text?: string }[] } | undefined;
  const sessionTitle =
    firstUserMessage == null
      ? '新会话'
      : (typeof firstUserMessage.content === 'string'
          ? firstUserMessage.content
          : Array.isArray(firstUserMessage.parts)
            ? firstUserMessage.parts.map((p) => p.text ?? '').join('')
            : ''
        ).trim().slice(0, 50) || '未命名会话';

  useEffect(() => {
    setSessionTitle(sessionTitle === '新会话' ? null : sessionTitle);
  }, [sessionTitle, setSessionTitle]);

  const lastMessage = messages[messages.length - 1];
  const lastIsAssistant = (lastMessage as any)?.role === "assistant";
  const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user') as { content?: string; parts?: { text?: string }[] } | undefined;
  const lastUserMessageText = lastUserMessage == null ? '' : (typeof lastUserMessage.content === 'string' ? lastUserMessage.content : Array.isArray(lastUserMessage.parts) ? lastUserMessage.parts.map((p) => p.text ?? '').join('') : '').trim();
  const apiSuggestedReplies = (currentAgentId === 'gxx' ? canvasData?.gxx?.suggestedReplies : null) ?? [];
  const isValidSuggestedReply = (s: string) =>
    typeof s === 'string' &&
    s.trim().length > 3 &&
    !s.includes('等待输入') &&
    !/^[\u4e00-\u9fa5\/]+\s*[:：]\s*等待输入/.test(s.trim());
  // Dedupe by content (keep first), and hide options identical to the last message the user sent
  const suggestedRepliesRaw = (Array.isArray(apiSuggestedReplies) ? apiSuggestedReplies : []).filter(isValidSuggestedReply);
  const seenContent = new Set<string>();
  const suggestedReplies = suggestedRepliesRaw
    .filter((s) => {
      const t = s.trim();
      if (seenContent.has(t)) return false;
      seenContent.add(t);
      if (lastUserMessageText && t === lastUserMessageText) return false;
      return true;
    })
    .slice(0, 3);
  const showSuggestedReplies =
    !isLoading && lastIsAssistant && suggestedReplies.length > 0;

  const isConsultationComplete = currentAgentId === 'gxx' && canvasData?.gxx?.summary && Array.isArray(canvasData.gxx.actionList) && canvasData.gxx.actionList.length > 0;
  const fallbackReplies = currentAgentId === 'gxx' ? getFallbackSuggestedReplies(canvasData) : [];
  const showFallbackReplies =
    !isLoading && lastIsAssistant && suggestedReplies.length === 0 && fallbackReplies.length > 0 && !isConsultationComplete;
  const chatPlaceholder =
    isConsultationComplete
      ? "输入追问，或在右侧画布复诊更新诊断"
      : currentAgentId === "gxx"
        ? getPlaceholderForGxx(canvasData)
        : "直接打字回复...";

  // Watch for tool results to update canvas (AI SDK 6: parts with output; legacy: toolInvocations with result)
  // Traverse all assistant messages so we pick up tool results from any message (streaming may split them).
  const canvasFieldKeys = ['product', 'target', 'price', 'niche', 'diff'];
  useEffect(() => {
    type PartLike = {
      type: string;
      toolInvocation?: { toolName?: string; state?: string; result?: unknown; output?: unknown; args?: unknown };
      toolName?: string;
      state?: string;
      output?: unknown;
      result?: unknown;
      args?: unknown;
    };

    const collectedFields: string[] = [];

    const safeUpdateCanvas = (agentId: string, data: any, collectFields = false) => {
      if (!data || typeof data !== 'object') return;
      if (collectFields) {
        canvasFieldKeys.forEach((k) => {
          if (k in data && data[k] != null && data[k] !== '' && data[k] !== '等待输入...') {
            collectedFields.push(k);
          }
        });
      }

      const normalizedData = { ...data };
      if (normalizedData.scores && typeof normalizedData.scores === 'object') {
        const normalizedScores: Record<string, number> = {};
        Object.keys(normalizedData.scores).forEach((key) => {
          normalizedScores[key.toLowerCase()] = normalizedData.scores[key];
        });
        normalizedData.scores = normalizedScores;
      }

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

    const applyToolFromPart = (p: PartLike, collect: boolean) => {
      const toolResult = (x: PartLike): unknown => {
        if (x.toolInvocation != null) {
          const r = x.toolInvocation.result ?? x.toolInvocation.output;
          if (r !== undefined) return r;
          if (x.toolInvocation.args !== undefined) return x.toolInvocation.args;
        }
        if (x.output !== undefined || x.result !== undefined) return x.output ?? x.result;
        if (x.args !== undefined) return x.args;
        return undefined;
      };
      let name = '';
      if (p.type === 'tool-invocation' && p.toolInvocation) {
        name = p.toolInvocation.toolName?.toLowerCase() ?? '';
        if (name === 'updatecanvas') {
          const result = p.toolInvocation.result ?? p.toolInvocation.output ?? p.toolInvocation.args;
          if (result != null && (p.toolInvocation.state === 'result' || p.toolInvocation.state === 'output-available' || result !== undefined)) {
            safeUpdateCanvas(currentAgentId, result, collect);
          }
        }
        return;
      }
      if (p.type === 'dynamic-tool' || p.type?.startsWith('tool-') || p.type === 'tool-call' || p.type === 'tool-result') {
        name = (p.toolName ?? p.type?.replace(/^tool-/, '') ?? '').toLowerCase();
        if (name === 'updatecanvas') {
          const out = toolResult(p);
          if (out != null) safeUpdateCanvas(currentAgentId, out, collect);
        }
      }
    };

    const applyToolInvocations = (msg: { toolInvocations?: Array<{ toolName?: string; result?: unknown; args?: unknown }> }, collect: boolean) => {
      const list = (msg as { toolInvocations?: unknown }).toolInvocations;
      if (!Array.isArray(list)) return;
      list.forEach((tool: any) => {
        if (tool?.toolName?.toLowerCase() !== 'updatecanvas') return;
        if (tool.result != null) safeUpdateCanvas(currentAgentId, tool.result, collect);
        else if (tool.args != null) safeUpdateCanvas(currentAgentId, tool.args, collect);
      });
    };

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || msg.role !== 'assistant') continue;
      const isLastMessage = i === messages.length - 1;
      if (isLastMessage) collectedFields.length = 0;

      const parts: PartLike[] = Array.isArray(msg.parts) ? (msg.parts as PartLike[]) : [];
      for (const p of parts) applyToolFromPart(p, isLastMessage);
      applyToolInvocations(msg as { toolInvocations?: Array<{ toolName?: string; result?: unknown; args?: unknown }> }, isLastMessage);
    }

    const lastMsg = messages[messages.length - 1];
    if (collectedFields.length > 0 && lastMsg && (lastMsg as { role?: string }).role === 'assistant' && currentAgentId === 'gxx') {
      const unique = [...new Set(collectedFields)];
      setCanvasUpdateToastFields(unique);
    }
  }, [messages, currentAgentId, updateCanvasData]);

  // Clear canvas update toast after 3s
  useEffect(() => {
    if (canvasUpdateToastFields.length === 0) return;
    const t = setTimeout(() => setCanvasUpdateToastFields([]), 3000);
    return () => clearTimeout(t);
  }, [canvasUpdateToastFields]);

  // Scroll to bottom on new message
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);



  return (
    <div className="w-full flex flex-col relative h-full">
       {/* Header: agent name + session title / loading */}
       <div className="flex-none px-5 py-4 border-b border-slate-200 flex flex-col gap-1 bg-white/95 backdrop-blur z-30 relative">
          <div className="flex items-center gap-3">
             <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 relative ${config.iconColor}`}>
                <Bot className="w-6 h-6" />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
             </div>
             <div>
                <h2 className="font-semibold text-slate-900 text-sm">{config.name}</h2>
                <p className="text-xs text-slate-500">{config.description}</p>
             </div>
          </div>
          {sessionRestoreInProgress ? (
             <p className="text-xs text-amber-600 flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                正在加载会话...
             </p>
          ) : (
             <p className="text-xs text-slate-500 mt-0.5 truncate" title={sessionTitle}>
                当前会话：{sessionTitle}
             </p>
          )}
       </div>

       {/* Messages */}
       <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-6 bg-slate-50/50" ref={scrollRef}>
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
          {sessionRestoreInProgress ? (
             <div className="space-y-8 animate-pulse px-2 mt-4">
                {/* Skeleton Loader */}
                <div className="flex gap-3 max-w-[85%]">
                   <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0"></div>
                   <div className="space-y-2 w-full">
                      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                      <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                   </div>
                </div>
                <div className="flex gap-3 max-w-[85%] ml-auto flex-row-reverse">
                   <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0"></div>
                   <div className="h-10 bg-slate-200 rounded-2xl w-1/2"></div>
                </div>
                <div className="flex gap-3 max-w-[85%]">
                   <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0"></div>
                   <div className="space-y-2 w-full">
                      <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                      <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                      <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                   </div>
                </div>
             </div>
          ) : (
            (() => {
            const seenIds = new Set<string>();
            const messagesToRender = messages.filter((m: any) => {
              const id = m?.id ?? '';
              if (seenIds.has(id)) return false;
              seenIds.add(id);
              return true;
            });
            return messagesToRender.map((m: any) => {
             // Support both `content` (older shape) and `parts` (UIMessage shape); include text + reasoning
             let textContent =
               m.content ??
               (Array.isArray(m.parts)
                 ? m.parts
                     .filter((p: any) => (p.type === 'text' || p.type === 'reasoning') && typeof p.text === 'string')
                     .map((p: any) => p.text)
                     .join('')
                 : '');
             // When assistant only sent tool calls (e.g. updateCanvas) with no text, show fallback so we never "have no reply"
             const hasToolParts = Array.isArray(m.parts) && m.parts.some((p: any) =>
               p.type?.startsWith?.('tool-') ||
               p.type === 'dynamic-tool' ||
               p.type === 'tool-invocation' ||
               p.type === 'tool-call' ||
               p.type === 'tool-result' ||
               p.toolInvocation != null ||
               p.toolName != null
             );
             if (m.role === 'assistant' && !textContent?.trim() && hasToolParts) {
               textContent = "（已根据您的输入更新画布，请继续...）";
             }

             // 不渲染无内容的“空气泡”（用户或助手消息内容为空时；assistant 仅有工具调用时已在上方设为 fallback）
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
                       // Use div with role="button" to avoid nested <button> when markdown has nested lists
                       return (
                         <li className="!list-none !my-1 !p-0 !bg-transparent !border-0 !rounded-none">
                           <div
                             role="button"
                             tabIndex={0}
                             onClick={(e) => {
                               const btnText = (e.currentTarget as HTMLElement).textContent?.trim();
                               if (btnText) {
                                 setInput(btnText);
                                 inputRef.current?.focus();
                               }
                             }}
                             onKeyDown={(e) => {
                               if (e.key === 'Enter' || e.key === ' ') {
                                 e.preventDefault();
                                 const btnText = (e.currentTarget as HTMLElement).textContent?.trim();
                                 if (btnText) {
                                   setInput(btnText);
                                   inputRef.current?.focus();
                                 }
                               }
                             }}
                             className="w-full text-left py-2.5 px-3 rounded-xl bg-amber-50/70 border border-amber-100 cursor-pointer hover:bg-amber-100/80 transition-colors font-medium text-slate-700"
                           >
                             {children}
                           </div>
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
          );
          });
          })() )}
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
                           disabled={isLoading || isSending}
                           onClick={() => { if (isLoading || isSending) return; handleSend(reply); }}
                           className="max-w-full px-4 py-2.5 break-words text-left bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm rounded-xl border border-blue-200 hover:border-blue-300 transition-colors shadow-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
                         >
                           {reply}
                         </button>
                      ))}
                   </div>
                )}
                {showFallbackReplies && (
                   <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">示例回复</p>
                      <div className="flex flex-wrap gap-2">
                         {fallbackReplies.map((reply: string, i: number) => {
                           const isExpanded = expandedReplies.has(i);
                           const extendedPrompts = [
                             "这个切入点的市场数据或标杆案例有哪些？",
                             "实施这个方向需要哪些资源？团队和资金大概要多少？",
                             "拓展过程中的主要风险是什么？如何规避？"
                           ];
                           return (
                             <div key={i} className="flex flex-col gap-2 w-full">
                                <div className="flex items-center gap-2">
                                   <button
                                      type="button"
                                      disabled={isLoading || isSending}
                                      onClick={() => { if (isLoading || isSending) return; handleSend(reply); }}
                                      className="flex-1 text-left px-4 py-2.5 break-words bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-xl border border-slate-200 hover:border-slate-300 transition-colors shadow-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
                                   >
                                      {reply}
                                   </button>
                                   <button
                                      type="button"
                                      onClick={() => {
                                         const newExpanded = new Set(expandedReplies);
                                         if (isExpanded) {
                                            newExpanded.delete(i);
                                         } else {
                                            newExpanded.add(i);
                                         }
                                         setExpandedReplies(newExpanded);
                                      }}
                                      className="px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl border border-blue-200 hover:border-blue-300 transition-colors shadow-sm flex items-center gap-1.5 text-xs font-medium"
                                      title="延伸提问"
                                   >
                                      <Sparkles className="w-3.5 h-3.5" />
                                      {isExpanded ? '收起' : '延伸'}
                                   </button>
                                </div>
                                {isExpanded && (
                                   <div className="ml-0 pl-4 border-l-2 border-blue-200 space-y-1.5">
                                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">延伸提问</p>
                                      {extendedPrompts.map((prompt, j) => (
                                         <button
                                            key={j}
                                            type="button"
                                            disabled={isLoading || isSending}
                                            onClick={() => { if (isLoading || isSending) return; handleSend(prompt); }}
                                            className="w-full text-left break-words px-3 py-2 bg-blue-50/50 hover:bg-blue-50 text-slate-600 text-xs rounded-lg border border-blue-100 hover:border-blue-200 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                                         >
                                            <ChevronRight className="w-3 h-3 inline mr-1.5 text-blue-400" />
                                            {prompt}
                                         </button>
                                      ))}
                                   </div>
                                )}
                             </div>
                           );
                         })}
                      </div>
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
       <div className="flex-none p-4 bg-white border-t border-slate-100 w-full z-20">
          {canvasUpdateToastFields.length > 0 && (
            <p className="mb-2 text-xs text-slate-500">
              已更新：{canvasUpdateToastFields.map((k) => GXX_FIELD_LABELS[k] ?? k).join('、')}
            </p>
          )}
          {/* Light hint - single next step suggestion */}
          {currentAgentId === 'gxx' && !isConsultationComplete && (() => {
            const filled = getGxxFilledCount(canvasData);
            const nextStep = GXX_PERSISTENT_STEPS.find((s) => !s.isDone(canvasData?.gxx));
            if (!nextStep || filled >= 5) return null;
            return (
              <p className="mb-2 text-xs text-slate-500">
                画布 {filled}/5 · 可以说说{nextStep.label.replace(/^[①②③④⑤]\s*/, '')}
                <button
                  type="button"
                  onClick={() => { setInput(nextStep.prefill); inputRef.current?.focus(); }}
                  className="ml-1 text-blue-600 hover:underline"
                >
                  填空
                </button>
              </p>
            );
          })()}
          {/* Quick Replies - Only show when no USER messages exist yet */}
          {!messages.some((m: { role: string }) => m.role === 'user') && (
             <div className="mb-2">
               {currentAgentId === 'gxx' && (
                 <p className="text-[10px] text-slate-500 mb-2">从零验证新项目 · 或基于现有业务拓展新渠道/新品类，均可</p>
               )}
               <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar mb-1">
                {quickReplies.map((reply, i) => (
                   <button
                     key={i}
                     type="button"
                     disabled={isLoading || isSending}
                     onClick={() => { if (isLoading || isSending) return; handleSend(reply); }}
                     className="whitespace-nowrap px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-200 transition-colors shadow-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
                   >
                      {reply}
                   </button>
                ))}
               </div>
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
