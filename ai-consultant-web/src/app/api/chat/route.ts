import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool, convertToModelMessages } from 'ai';
import { agents } from '@/features/agents/config';
import { buildGaoXiaoxinContext } from '@/lib/gaoXiaoxinContext';
import { buildGaoXiaoxinSystemPrompt } from '@/lib/gaoXiaoxinPrompt';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// Initialize OpenRouter provider
// Use `compatibility: 'compatible'` so that the client talks to
// OpenRouter's OpenAI-compatible `chat/completions` API instead of
// the newer Responses API, which avoids "Invalid Responses API request" errors.
const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  headers: {
    'HTTP-Referer': 'https://ai-consultant.com', // Replace with your actual site URL
    'X-Title': 'AI Consultant', // Replace with your actual site name
  },
});

export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  const anonymousId = searchParams.get('anonymousId');

  if (!sessionId) {
    return new Response('Missing sessionId', { status: 400 });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    const sessionWithOptional = session as typeof session & { anonymousId?: string | null; currentCanvasData?: unknown };
    // Optional ownership check: if both session and request have anonymousId, they must match
    if (anonymousId != null && anonymousId !== '' && sessionWithOptional.anonymousId != null && sessionWithOptional.anonymousId !== anonymousId) {
      return new Response('Forbidden', { status: 403 });
    }

    return new Response(JSON.stringify({
      messages: session.messages,
      canvasData: sessionWithOptional.currentCanvasData ?? null,
      agentId: session.agentId
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Fetch Session Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Ensure we always have a messages array to avoid "undefined.map" errors
    const rawMessages = (body as any)?.messages;
    const messages = Array.isArray(rawMessages) ? rawMessages : [];
    const agentId = (body as any)?.agentId;
    const sessionId = (body as any)?.sessionId;
    const anonymousId = typeof (body as any)?.anonymousId === 'string' ? (body as any).anonymousId : null;

    // Fetch current canvas data for context
    let currentCanvasData: any = null;
    if (sessionId) {
      try {
        const session = await prisma.session.findUnique({ where: { id: sessionId } });
        currentCanvasData = session && 'currentCanvasData' in session ? (session as { currentCanvasData?: unknown }).currentCanvasData : null;
      } catch (e) {
        console.error('Failed to fetch session context:', e);
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[Chat API] Body keys:', body && typeof body === 'object' ? Object.keys(body) : typeof body);
      console.debug('[Chat API] Messages length:', Array.isArray(messages) ? messages.length : 'non-array');
      console.debug('[Chat API] Session ID:', sessionId);
      // Validate last message is from user and log summary for debugging context-order issues
      if (messages.length > 0) {
        const last = messages[messages.length - 1] as { role?: string; content?: string; parts?: Array<{ type?: string; text?: string }> };
        const lastIsUser = last?.role === 'user';
        console.debug('[Chat API] Last message role is user:', lastIsUser);
        const lastContent = typeof last?.content === 'string'
          ? last.content
          : Array.isArray(last?.parts)
            ? (last.parts as Array<{ text?: string }>).map((p) => p.text ?? '').join('')
            : '';
        console.debug('[Chat API] Last user message (first 100 chars):', lastContent.substring(0, 100));
      }
    }

    const key = (agentId || 'gxx') as keyof typeof agents;
    const agent = agents[key];
    if (!agent) {
      return new Response('Agent not found', { status: 404 });
    }

    // Get plain text from a message (supports both content and parts-based UIMessage shape)
    const getMessageText = (msg: { content?: string; parts?: Array<{ type?: string; text?: string }> }): string => {
      if (typeof msg?.content === 'string') return msg.content;
      if (Array.isArray(msg?.parts)) return (msg.parts as Array<{ text?: string }>).map((p) => p.text ?? '').join('').trim();
      return '';
    };

    // Save user message to DB
    if (sessionId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1] as { role?: string; content?: string; parts?: Array<{ type?: string; text?: string }> };
      if (lastMessage.role === 'user') {
        const lastContent = getMessageText(lastMessage);
        try {
          // Ensure session exists
          await prisma.session.upsert({
            where: { id: sessionId },
            update: {
              updatedAt: new Date(),
              ...(anonymousId != null && { anonymousId }),
            },
            create: {
              id: sessionId,
              agentId: key,
              title: lastContent ? lastContent.substring(0, 50) : '新会话',
              ...(anonymousId != null && { anonymousId }),
            },
          });

          await prisma.message.create({
            data: {
              sessionId,
              role: 'user',
              content: lastContent || '(无文本)',
            },
          });
        } catch (dbError) {
          console.error('Failed to save user message to DB:', dbError);
          // Continue execution even if DB fails
        }
      }
    }

    // Build system prompt, with special handling for the Gao Xiaoxin agent
    let systemPrompt = agent.systemPrompt;
    if (key === 'gxx') {
      const context = buildGaoXiaoxinContext();
      systemPrompt = buildGaoXiaoxinSystemPrompt(context, currentCanvasData);
    }

    // Use Gemini 3.0 Flash on OpenRouter.
    const result = streamText({
      model: openrouter.chat('google/gemini-3-flash-preview'),
      system: systemPrompt,
      temperature: 0.3, // Enforce stricter adherence to system prompt instructions
      // Safely convert UI messages coming from `useChat` into model messages
      messages: messages.length > 0 ? await convertToModelMessages(messages) : [],
      tools: {
        updateCanvas: tool({
          description:
            '根据对话内容更新商业画布的结构化数据。每当收集或细化 product/target/price/niche/diff 中任意字段时调用。支持部分更新：只传已知字段，未知的可省略。',
          parameters: agent.schema,
          execute: async (data: any) => {
            // This execution happens on the server.
            // Merge with existing canvas so partial updates do not overwrite other fields.
            let merged = data;
            if (sessionId) {
               try {
                 const existing = await prisma.session.findUnique({ where: { id: sessionId } });
                 const existingData = (existing && 'currentCanvasData' in existing ? (existing as { currentCanvasData?: unknown }).currentCanvasData ?? null : null) as Record<string, unknown> | null;
                 merged = { ...(existingData && typeof existingData === 'object' ? existingData : {}), ...(data && typeof data === 'object' ? data : {}) };

                 await prisma.session.update({
                    where: { id: sessionId },
                    data: { currentCanvasData: merged } as Prisma.SessionUpdateInput,
                 });

                 await prisma.report.create({
                   data: {
                     sessionId,
                     content: merged,
                   }
                 });
               } catch (e) {
                 console.error('Failed to save canvas report:', e);
               }
            }
            return merged;
          },
        } as any),
      },
      toolChoice: 'auto',
      onFinish: async (completion) => {
        if (!sessionId) return;
        try {
          const content = typeof completion?.text === 'string' ? completion.text : '';
          const rawTools = (completion as { toolInvocations?: unknown[] })?.toolInvocations ?? (completion as { steps?: { toolInvocations?: unknown[] }[] })?.steps?.flatMap((s: { toolInvocations?: unknown[] }) => s.toolInvocations ?? []) ?? [];
          const toolInvocations = Array.isArray(rawTools) ? rawTools : [];
          await prisma.message.create({
            data: {
              sessionId,
              role: 'assistant',
              content,
              toolInvocations,
            } as Prisma.MessageUncheckedCreateInput,
          });
        } catch (e) {
          console.error('Failed to save assistant message:', e);
        }
      },
      onError: (error) => {
        console.error('[OpenRouter Stream Error]:', error);
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error('Chat API Error:', error);
    
    // Extract more details if available (e.g., from OpenRouter response)
    const errorDetails = error.response?.data || error.message || String(error);
    console.error('Detailed Error:', JSON.stringify(errorDetails, null, 2));

    return new Response(JSON.stringify({ 
      error: 'Internal Server Error', 
      details: error instanceof Error ? error.message : String(error),
      fullDetails: errorDetails 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
