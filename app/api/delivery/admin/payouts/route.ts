/**
 * GET  /api/delivery/admin/payouts?location_id=...&view=records|periods|summary
 * POST /api/delivery/admin/payouts  — Perioden generieren oder Periode freigeben/bezahlen
 *
 * GET-Parameter:
 *   location_id  — Pflicht
 *   view         — "records" | "periods" | "summary" (default: "summary")
 *   driver_id    — Optional: Filterung nach Fahrer
 *   status       — Optional (periods): draft|approved|paid
 *   since        — Optional: ISO-Datum (default: 7 Tage)
 *   paid_out     — Optional (records): true|false
 *   limit        — Optional: max. Ergebnisse (default: 100)
 *
 * POST-Body (Aktion wählen):
 *   { action: "generate_daily", location_id, date: "YYYY-MM-DD" }
 *   { action: "approve_period", period_id }
 *   { action: "mark_paid",      period_id }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getDriverPayouts,
  getPeriodPayouts,
  getPayoutSummary,
  generateAllPeriodsForDate,
  approvePeriod,
  markPeriodPaid,
} from '@/lib/delivery/payout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const view = searchParams.get('view') ?? 'summary';
  const driverId = searchParams.get('driver_id') ?? undefined;
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 100;

  const sinceParam = searchParams.get('since');
  const since = sinceParam
    ? new Date(sinceParam)
    : new Date(Date.now() - 7 * 86_400_000);

  try {
    if (view === 'records') {
      const paidOutParam = searchParams.get('paid_out');
      const paidOut = paidOutParam === 'true' ? true : paidOutParam === 'false' ? false : undefined;
      const records = await getDriverPayouts(locationId, { driverId, since, paidOut, limit });
      return NextResponse.json({ records, count: records.length });
    }

    if (view === 'periods') {
      const statusParam = searchParams.get('status') as 'draft' | 'approved' | 'paid' | null;
      const periods = await getPeriodPayouts(locationId, {
        driverId,
        status: statusParam ?? undefined,
        since,
        limit,
      });
      const totalPayout = periods.reduce((s, p) => s + p.totalPayout, 0);
      return NextResponse.json({ periods, count: periods.length, total_payout_eur: Math.round(totalPayout * 100) / 100 });
    }

    // Default: summary
    const summary = await getPayoutSummary(locationId);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const action = body.action as string | undefined;

  try {
    // Tages-Perioden für alle Fahrer generieren
    if (action === 'generate_daily') {
      const locationId = body.location_id as string | undefined;
      if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

      const dateStr = (body.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
      const date = new Date(dateStr + 'T00:00:00');

      const result = await generateAllPeriodsForDate(locationId, date, 'daily');
      return NextResponse.json({
        ok: true,
        date: dateStr,
        driver_count: result.driverCount,
        period_ids: result.periodIds,
        total_payout_eur: Math.round(result.totalPayout * 100) / 100,
      });
    }

    // Periode freigeben
    if (action === 'approve_period') {
      const periodId = body.period_id as string | undefined;
      if (!periodId) return NextResponse.json({ error: 'period_id fehlt' }, { status: 400 });
      await approvePeriod(periodId, user.id);
      return NextResponse.json({ ok: true, period_id: periodId, status: 'approved' });
    }

    // Periode als bezahlt markieren
    if (action === 'mark_paid') {
      const periodId = body.period_id as string | undefined;
      if (!periodId) return NextResponse.json({ error: 'period_id fehlt' }, { status: 400 });
      await markPeriodPaid(periodId);
      return NextResponse.json({ ok: true, period_id: periodId, status: 'paid' });
    }

    return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
