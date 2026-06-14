/**
 * GET/POST/PUT /api/delivery/admin/sla-compensation
 *
 * SLA Auto-Kompensation Engine — Phase 157
 *
 * GET  ?since=ISO-Date
 *   → Kompensations-Events + Zusammenfassung (letzte 30 Tage)
 *
 * POST { action: 'process' }
 *   → Sofortige Verarbeitung auslösen (manueller Trigger)
 *
 * PUT { enabled, threshold_min, amount_eur, max_per_customer_month }
 *   → Konfiguration aktualisieren
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getCompensationEvents,
  getCompensationSummary,
  processAutoCompensations,
  upsertCompConfig,
} from '@/lib/delivery/sla-compensation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveAuth(): Promise<{ locationId: string; userId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return null;
  return { locationId: emp.location_id as string, userId: user.id };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await resolveAuth();
  if (!auth) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const since = searchParams.get('since') ?? undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

  const [events, summary] = await Promise.all([
    getCompensationEvents(auth.locationId, { limit, since }),
    getCompensationSummary(auth.locationId),
  ]);

  return NextResponse.json({ events, summary, generatedAt: new Date().toISOString() });
}

// ── POST — manuelle Verarbeitung ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await resolveAuth();
  if (!auth) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* action=process */ }

  const action = (body.action as string | undefined) ?? 'process';

  if (action === 'process') {
    const result = await processAutoCompensations(auth.locationId);
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
}

// ── PUT — Konfiguration ───────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const auth = await resolveAuth();
  if (!auth) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 }); }

  const config = await upsertCompConfig(auth.locationId, {
    enabled:             body.enabled as boolean | undefined,
    thresholdMin:        body.threshold_min as number | undefined,
    amountEur:           body.amount_eur as number | undefined,
    maxPerCustomerMonth: body.max_per_customer_month as number | undefined,
  });

  return NextResponse.json({ ok: true, config });
}
