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
  // Smart dispatch is the sole production writer.  This opt-in gate exists only
  // for a controlled rollback while the host cron entry is being removed.
  if (process.env.DELIVERY_LEGACY_DISPATCH_ENABLED !== 'true') {
    // Keep the legacy host cron healthy during rollout while making it a no-op.
    return NextResponse.json({ ok: true, disabled: true, writer: 'smart-dispatch' });
  }
  try {
    const result = await dispatchTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
