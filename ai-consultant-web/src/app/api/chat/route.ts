import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool, convertToModelMessages } from 'ai';
import { agents } from '@/features/agents/config';
import { buildGaoXiaoxinContext } from '@/lib/gaoXiaoxinContext';
import { buildGaoXiaoxinSystemPrompt } from '@/lib/gaoXiaoxinPrompt';

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

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[Chat API] Body keys:', body && typeof body === 'object' ? Object.keys(body) : typeof body);
      console.debug('[Chat API] Messages length:', Array.isArray(messages) ? messages.length : 'non-array');
    }

    const key = (agentId || 'gxx') as keyof typeof agents;
    const agent = agents[key];
    if (!agent) {
      return new Response('Agent not found', { status: 404 });
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
            'Update the business canvas with structured data from the conversation. Call whenever you gather or refine any of product/target/price/niche/diff. Partial updates are supported: send only the fields you know; omit others.',
          parameters: agent.schema,
          execute: async (data: any) => {
            // This execution happens on the server.
            // The result is sent to the client as a tool-result.
            // The client `useChat` will receive this.
            return data;
          },
        } as any),
      },
      toolChoice: 'auto',
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
