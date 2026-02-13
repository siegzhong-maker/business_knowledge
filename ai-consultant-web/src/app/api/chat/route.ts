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

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Ensure we always have a messages array to avoid "undefined.map" errors
    const rawMessages = (body as any)?.messages;
    const messages = Array.isArray(rawMessages) ? rawMessages : [];
    const agentId = (body as any)?.agentId;
    const sessionId = (body as any)?.sessionId;

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

    // Save user message to DB
    if (sessionId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        try {
          // Ensure session exists
          await prisma.session.upsert({
            where: { id: sessionId },
            update: { updatedAt: new Date() },
            create: {
              id: sessionId,
              agentId: key,
              title: lastMessage.content.substring(0, 50), // Simple title from first message
            },
          });

          await prisma.message.create({
            data: {
              sessionId,
              role: 'user',
              content: lastMessage.content,
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
      systemPrompt = buildGaoXiaoxinSystemPrompt(context);
    }

    // Use Gemini 3.0 Flash on OpenRouter.
    const result = streamText({
      model: openrouter.chat('google/gemini-3-flash-preview'),
      system: systemPrompt,
      // Safely convert UI messages coming from `useChat` into model messages
      messages: messages.length > 0 ? await convertToModelMessages(messages) : [],
      tools: {
        updateCanvas: tool({
          description:
            '根据对话内容更新商业画布的结构化数据。每当收集或细化 product/target/price/niche/diff 中任意字段时调用。支持部分更新：只传已知字段，未知的可省略。',
          parameters: agent.schema,
          execute: async (data: any) => {
            // This execution happens on the server.
            // Save canvas snapshot to DB
            if (sessionId) {
               try {
                 // Update Session with latest canvas data
                 await prisma.session.update({
                    where: { id: sessionId },
                    data: { currentCanvasData: data }
                 });

                 await prisma.report.create({
                   data: {
                     sessionId,
                     content: data, // JSON field
                   }
                 });
               } catch (e) {
                 console.error('Failed to save canvas report:', e);
               }
            }
            return data;
          },
        } as any),
      },
      toolChoice: 'auto',
      onFinish: async (completion) => {
        // Save assistant message to DB
        if (sessionId) {
          try {
            await prisma.message.create({
              data: {
                sessionId,
                role: 'assistant',
                content: completion.text,
                toolInvocations: (completion as any).toolInvocations ?? completion.steps?.flatMap((s: any) => s.toolInvocations ?? []) ?? [],
              } as Prisma.MessageUncheckedCreateInput,
            });
          } catch (e) {
             console.error('Failed to save assistant message:', e);
          }
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
