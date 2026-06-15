/**
 * GET /api/delivery/admin/reporting
 *
 * Business Intelligence Reporting API — Phase 26
 *
 * Query-Typen via ?type=...:
 *
 *   type=daily
 *     ?location_id=...&date=YYYY-MM-DD
 *     → DailyKpis für einen Kalender-Tag
 *
 *   type=period
 *     ?location_id=...&period_type=daily|weekly|monthly|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
 *     → PeriodReport mit dailyBreakdown + topDrivers + Summary
 *
 *   type=multi
 *     ?location_ids=id1,id2,...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *     → MultiLocationSummary (max 20 Locations, nur eigene Locations)
 *
 *   type=cached
 *     ?location_id=...&report_type=daily|weekly|monthly&limit=N
 *     → Liste der letzten gecachten Snapshots (schnell, kein Re-Compute)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getDailyKpis,
  getPeriodReport,
  getMultiLocationSummary,
} from '@/lib/delivery/reporting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  // ── action=hourly_revenue ─────────────────────────────────────
  if (action === 'hourly_revenue') {
    const locationId = searchParams.get('location_id');
    if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

    const now = new Date();
    const currentHourStart  = new Date(now); currentHourStart.setMinutes(0, 0, 0);
    const lastHourStart     = new Date(currentHourStart); lastHourStart.setHours(lastHourStart.getHours() - 1);
    const yesterdayHourStart = new Date(currentHourStart); yesterdayHourStart.setDate(yesterdayHourStart.getDate() - 1);
    const yesterdayHourEnd  = new Date(yesterdayHourStart); yesterdayHourEnd.setHours(yesterdayHourEnd.getHours() + 1);

    const sumRevenue = (rows: { gesamtpreis?: number | null }[] | null) =>
      (rows ?? []).reduce((acc, r) => acc + (Number(r.gesamtpreis) || 0), 0);

    const [cur, last, yest] = await Promise.all([
      sb.from('orders')
        .select('gesamtpreis')
        .eq('location_id', locationId)
        .eq('status', 'geliefert')
        .gte('bestellt_am', currentHourStart.toISOString())
        .lte('bestellt_am', now.toISOString()),
      sb.from('orders')
        .select('gesamtpreis')
        .eq('location_id', locationId)
        .eq('status', 'geliefert')
        .gte('bestellt_am', lastHourStart.toISOString())
        .lt('bestellt_am', currentHourStart.toISOString()),
      sb.from('orders')
        .select('gesamtpreis')
        .eq('location_id', locationId)
        .eq('status', 'geliefert')
        .gte('bestellt_am', yesterdayHourStart.toISOString())
        .lt('bestellt_am', yesterdayHourEnd.toISOString()),
    ]);

    return NextResponse.json({
      currentHourEur:       sumRevenue(cur.data),
      lastHourEur:          sumRevenue(last.data),
      yesterdaySameHourEur: sumRevenue(yest.data),
    });
  }

  const type = searchParams.get('type') ?? 'daily';

  // ── type=daily ──────────────────────────────────────────────
  if (type === 'daily') {
    const locationId = searchParams.get('location_id');
    if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

    const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

    const kpis = await getDailyKpis(locationId, date);
    if (!kpis) {
      return NextResponse.json({
        date,
        locationId,
        _empty: true,
        _hint: 'Keine Daten für diesen Tag oder Migration 026 noch nicht ausgeführt.',
      });
    }
    return NextResponse.json(kpis);
  }

  // ── type=period ─────────────────────────────────────────────
  if (type === 'period') {
    const locationId  = searchParams.get('location_id');
    if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

    const periodType = (searchParams.get('period_type') ?? 'custom') as 'daily' | 'weekly' | 'monthly' | 'custom';
    const now        = new Date();
    const todayIso   = now.toISOString().slice(0, 10);

    let from = searchParams.get('from');
    let to   = searchParams.get('to') ?? todayIso;

    if (!from) {
      // Standardzeiträume aus period_type ableiten
      if (periodType === 'weekly') {
        const mon = new Date(now);
        mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
        from = mon.toISOString().slice(0, 10);
      } else if (periodType === 'monthly') {
        from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      } else {
        from = todayIso; // daily: heute
      }
    }

    // Sicherheitsgrenze: max 366 Tage
    const daysDiff = Math.ceil(
      (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000,
    );
    if (daysDiff > 366) {
      return NextResponse.json({ error: 'Zeitraum zu groß (max. 366 Tage)' }, { status: 400 });
    }

    try {
      const report = await getPeriodReport(locationId, periodType, from, to);
      return NextResponse.json(report);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Fehler beim Report' },
        { status: 500 },
      );
    }
  }

  // ── type=multi ──────────────────────────────────────────────
  if (type === 'multi') {
    const idsParam = searchParams.get('location_ids');
    if (!idsParam) return NextResponse.json({ error: 'location_ids fehlt' }, { status: 400 });

    const requestedIds = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
    if (requestedIds.length === 0) {
      return NextResponse.json({ error: 'Keine gültigen location_ids' }, { status: 400 });
    }

    // Sicherheit: nur Locations erlauben, die dem angemeldeten User gehören
    const { data: ownedLocs } = await sb
      .from('locations')
      .select('id')
      .in('id', requestedIds);

    const ownedIds = (ownedLocs ?? []).map((l) => l.id as string);
    if (ownedIds.length === 0) {
      return NextResponse.json({ error: 'Keine dieser Locations sind zugänglich' }, { status: 403 });
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const from = searchParams.get('from') ?? new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
    const to   = searchParams.get('to')   ?? todayIso;

    try {
      const summary = await getMultiLocationSummary(ownedIds, from, to);
      return NextResponse.json(summary);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Fehler beim Multi-Location-Report' },
        { status: 500 },
      );
    }
  }

  // ── type=cached ─────────────────────────────────────────────
  if (type === 'cached') {
    const locationId  = searchParams.get('location_id');
    if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

    const reportType = searchParams.get('report_type') ?? 'daily';
    const limit      = Math.min(Math.max(Number(searchParams.get('limit') ?? 30), 1), 90);

    const { data, error } = await sb
      .from('delivery_report_snapshots')
      .select('id, report_type, period_start, orders_count, delivered_count, revenue_eur, on_time_pct, generated_at')
      .eq('location_id', locationId)
      .eq('report_type', reportType)
      .order('period_start', { ascending: false })
      .limit(limit);

    if (error) {
      // Graceful: Migration noch nicht ausgeführt
      return NextResponse.json({
        snapshots: [],
        _fallback: true,
        _hint: 'delivery_report_snapshots noch nicht vorhanden (Migration 026 ausführen).',
      });
    }

    return NextResponse.json({ snapshots: data ?? [], count: (data ?? []).length });
  }

  return NextResponse.json({ error: `Unbekannter type: ${type}. Erlaubt: daily, period, multi, cached` }, { status: 400 });
}
