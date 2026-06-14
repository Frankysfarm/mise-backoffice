/**
 * GET+POST /api/delivery/admin/driver-digest
 *
 * Fahrer Tagesabschluss-E-Mail — Admin-API
 *
 * GET  → { config, log }
 *   config: DriverDigestConfig | null
 *   log: DriverDigestLogEntry[] (letzte 50)
 *
 * POST { action: 'save_config', ...patch }
 *   → DriverDigestConfig (upsert)
 *
 * POST { action: 'send_now', date?: string }
 *   → DriverDigestSendResult (manueller Versand)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getDriverDigestConfig,
  getDriverDigestLog,
  upsertDriverDigestConfig,
  sendDriverDailyDigest,
} from '@/lib/delivery/driver-digest-mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(sb: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('id', user.id)
    .maybeSingle();
  return (emp?.tenant_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const locationId = await resolveLocationId(sb);
  if (!locationId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const [config, log] = await Promise.all([
    getDriverDigestConfig(locationId),
    getDriverDigestLog(locationId, 50),
  ]);

  return NextResponse.json({ config, log });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const locationId = await resolveLocationId(sb);
  if (!locationId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = body.action as string | undefined;

  if (action === 'save_config') {
    const cfg = await upsertDriverDigestConfig(locationId, {
      enabled:          body.enabled as boolean | undefined,
      sendHourUtc:      typeof body.sendHourUtc === 'number' ? body.sendHourUtc : undefined,
      includeRanking:   body.includeRanking as boolean | undefined,
      includeNextShift: body.includeNextShift as boolean | undefined,
    });
    return NextResponse.json({ ok: true, config: cfg });
  }

  if (action === 'send_now') {
    const date = typeof body.date === 'string' ? body.date : undefined;
    const result = await sendDriverDailyDigest(locationId, date);
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
