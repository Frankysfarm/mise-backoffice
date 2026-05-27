/**
 * POST /api/driver/v1/internal/dispatch-tick
 *
 * Cron-Endpoint: läuft jede Minute aus dem mise_cron Container.
 * Scannt unzugewiesene Lieferungs-Bestellungen und ruft Frank.dispatchOrder
 * für jede einzelne auf.
 *
 * Schutz: x-internal-token Header muss mit BISS_INTERNAL_TOKEN matchen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { dispatchTick } from '@/lib/frank';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const expected = process.env.BISS_INTERNAL_TOKEN;
  const got = req.headers.get('x-internal-token');
  if (!expected || got !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const result = await dispatchTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
