import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/sessions/[sessionId]/canvas
 * Updates session's currentCanvasData with partial merge.
 * Body: { data: Record<string, unknown> } or { agentId: string, data: Record<string, unknown> }
 * Query: anonymousId (required for ownership)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { searchParams } = new URL(req.url);
  const anonymousId = searchParams.get('anonymousId');

  if (!sessionId || !anonymousId || anonymousId.trim() === '') {
    return new Response(
      JSON.stringify({ error: 'Missing sessionId or anonymousId' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, anonymousId: true, currentCanvasData: true },
    });

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (session.anonymousId !== anonymousId.trim()) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const data = (body?.data ?? body) as Record<string, unknown>;
    if (!data || typeof data !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid body: data required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const existing = (session.currentCanvasData as Record<string, unknown>) ?? {};
    
    // Deep merge helper
    const deepMerge = (target: any, source: any): any => {
      if (typeof target !== 'object' || target === null || typeof source !== 'object' || source === null) {
        return source;
      }
      const result = { ...target };
      for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          if (key === 'scores' && typeof source[key] === 'object' && typeof target[key] === 'object') {
             result[key] = deepMerge(target[key], source[key]);
          } else {
             result[key] = source[key];
          }
        }
      }
      return result;
    };

    const merged = deepMerge(existing, data);

    await prisma.session.update({
      where: { id: sessionId },
      data: { currentCanvasData: merged } as Prisma.SessionUpdateInput,
    });

    return new Response(JSON.stringify({ ok: true, data: merged }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('PATCH canvas error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
