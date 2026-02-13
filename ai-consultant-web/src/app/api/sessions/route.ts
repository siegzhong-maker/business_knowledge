import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const anonymousId = searchParams.get('anonymousId');
  const agentId = searchParams.get('agentId');
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10), 1), 100);
  const cursor = searchParams.get('cursor');

  if (!anonymousId || anonymousId.trim() === '') {
    return new Response(JSON.stringify({ error: 'Missing anonymousId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const where: { anonymousId: string; agentId?: string } = { anonymousId: anonymousId.trim() };
    if (agentId && agentId.trim() !== '') {
      where.agentId = agentId.trim();
    }

    const take = limit + 1;
    const sessions = await prisma.session.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
      ...(cursor
        ? { skip: 1, cursor: { id: cursor } }
        : {}),
      select: {
        id: true,
        agentId: true,
        title: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    const hasMore = sessions.length > limit;
    const list = hasMore ? sessions.slice(0, limit) : sessions;
    const nextCursor = hasMore && list.length > 0 ? list[list.length - 1].id : null;

    return new Response(
      JSON.stringify({
        sessions: list.map((s) => ({
          id: s.id,
          agentId: s.agentId,
          title: s.title ?? undefined,
          updatedAt: s.updatedAt.toISOString(),
          createdAt: s.createdAt.toISOString(),
        })),
        nextCursor,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sessions list error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
