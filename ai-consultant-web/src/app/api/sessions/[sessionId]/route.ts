import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(
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
      select: { id: true, anonymousId: true },
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

    await prisma.message.deleteMany({ where: { sessionId } });
    await prisma.report.deleteMany({ where: { sessionId } });
    await prisma.session.delete({ where: { id: sessionId } });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Delete session error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
