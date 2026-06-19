/**
 * GET /api/delivery/tracking/[bestellnummer]/stream
 *
 * Server-Sent Events (SSE) Endpoint — Phase 301
 *
 * Streamt Fahrer-Position + ETA-Daten live an den Browser des Kunden.
 * Kein Auth erforderlich — bestellnummer ist der Lookup-Key.
 *
 * Response: text/event-stream
 * Events:   tracking_update | heartbeat | closed
 *
 * Query-Parameter:
 *   ua  — optional, User-Agent-Hint ('mobile' | 'desktop') für Analytics
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createTrackingSseStream } from '@/lib/delivery/customer-tracking-sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ bestellnummer: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { bestellnummer } = await params;

  if (!bestellnummer || bestellnummer.length < 4) {
    return NextResponse.json({ error: 'Ungültige Bestellnummer' }, { status: 400 });
  }

  const ua    = req.nextUrl.searchParams.get('ua');
  const ip    = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ipHash = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 16) : null;
  const userAgentHint = ua === 'mobile' ? 'mobile' : ua === 'desktop' ? 'desktop' : null;

  const stream = createTrackingSseStream(bestellnummer, { ipHash, userAgentHint });

  return new Response(stream, {
    headers: {
      'Content-Type':                'text/event-stream',
      'Cache-Control':               'no-cache, no-transform',
      'Connection':                  'keep-alive',
      'X-Accel-Buffering':           'no',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
