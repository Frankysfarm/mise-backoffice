/**
 * POST /api/delivery/admin/ai-assist
 * Body: { location_id: string }
 *
 * Streams Claude-Dispatch-Empfehlungen für den aktuellen Zustand einer Location.
 * Nutzt Server-Sent Events (text/event-stream) für Live-Streaming.
 *
 * Auth: eingeloggter Supabase-User erforderlich.
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamDispatchAdvice } from '@/lib/delivery/ai-dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Nicht eingeloggt' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  let locationId: string;
  try {
    const body = await req.json() as { location_id?: string };
    if (!body.location_id) throw new Error('location_id fehlt');
    locationId = body.location_id;
  } catch {
    return new Response(JSON.stringify({ error: 'location_id fehlt' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const textStream = await streamDispatchAdvice(locationId);

    // Pipe the raw text chunks as SSE
    const encoder = new TextEncoder();
    const sseStream = new ReadableStream({
      async start(controller) {
        const reader = textStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              break;
            }
            const escaped = value.replace(/\n/g, '\\n');
            controller.enqueue(encoder.encode(`data: ${escaped}\n\n`));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(sseStream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'x-accel-buffering': 'no',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
