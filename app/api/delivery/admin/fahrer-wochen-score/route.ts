/**
 * GET /api/delivery/admin/fahrer-wochen-score
 *   ?location_id=<uuid>
 *
 * 7-Tage Score-Matrix je Fahrer: Composite-Score, Lieferungen, Pünktlichkeit.
 * Daten: driver_score_daily_snapshots + schicht_abschluss_berichte + mise_drivers.
 * Response: DriverRow[]
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DayScore {
  date: string;
  label: string;
  score: number | null;
  deliveries: number;
  onTimePct: number | null;
}

interface DriverRow {
  driverId: string;
  name: string;
  days: DayScore[];
  avgScore: number;
  totalDeliveries: number;
  trend: 'up' | 'down' | 'flat';
}

function dayLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit' });
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });

  const svc = createServiceClient();

  // Build last-7-days date strings (YYYY-MM-DD, oldest first)
  const today = new Date();
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  const since = dates[0];

  // Fetch daily score snapshots for last 7 days
  const { data: snapRows } = await svc
    .from('driver_score_daily_snapshots')
    .select('driver_id, snapshot_date, composite_score, f_punctuality, mise_drivers(name)')
    .eq('location_id', locationId)
    .gte('snapshot_date', since)
    .lte('snapshot_date', dates[6])
    .order('snapshot_date', { ascending: true });

  type SnapRow = {
    driver_id: string;
    snapshot_date: string;
    composite_score: number;
    f_punctuality: number;
    mise_drivers: { name: string | null } | null;
  };

  const snaps = (snapRows ?? []) as SnapRow[];

  // Fetch schicht_abschluss_berichte for deliveries per driver per day
  const { data: berichtRows } = await svc
    .from('schicht_abschluss_berichte')
    .select('driver_id, schicht_datum, lieferungen_gesamt, puenktlichkeits_pct')
    .eq('location_id', locationId)
    .gte('schicht_datum', since)
    .lte('schicht_datum', dates[6]);

  type BerichtRow = {
    driver_id: string;
    schicht_datum: string;
    lieferungen_gesamt: number;
    puenktlichkeits_pct: number | null;
  };

  const berichte = (berichtRows ?? []) as BerichtRow[];

  // Group snaps by driver
  const byDriver = new Map<string, { name: string; snaps: SnapRow[] }>();
  for (const snap of snaps) {
    const drvName = (snap.mise_drivers as { name: string | null } | null)?.name ?? 'Unbekannt';
    if (!byDriver.has(snap.driver_id)) {
      byDriver.set(snap.driver_id, { name: drvName, snaps: [] });
    }
    byDriver.get(snap.driver_id)!.snaps.push(snap);
  }

  // Also collect drivers from berichte who may have no snaps
  for (const b of berichte) {
    if (!byDriver.has(b.driver_id)) {
      byDriver.set(b.driver_id, { name: 'Unbekannt', snaps: [] });
    }
  }

  // Build berichtMap: driver_id → date → row
  const berichtMap = new Map<string, Map<string, BerichtRow>>();
  for (const b of berichte) {
    if (!berichtMap.has(b.driver_id)) berichtMap.set(b.driver_id, new Map());
    berichtMap.get(b.driver_id)!.set(b.schicht_datum, b);
  }

  const rows: DriverRow[] = [];

  for (const [driverId, { name, snaps: driverSnaps }] of byDriver) {
    const snapByDate = new Map(driverSnaps.map(s => [s.snapshot_date, s]));
    const berichtByDate = berichtMap.get(driverId) ?? new Map<string, BerichtRow>();

    const days: DayScore[] = dates.map(date => {
      const snap = snapByDate.get(date);
      const bericht = berichtByDate.get(date);

      const score = snap ? Math.round(Number(snap.composite_score) * 10) / 10 : null;

      // f_punctuality is 0–30; scale to 0–100 for display
      const onTimePct = snap
        ? Math.min(100, Math.round((Number(snap.f_punctuality) / 30) * 100))
        : (bericht?.puenktlichkeits_pct != null ? Number(bericht.puenktlichkeits_pct) : null);

      const deliveries = bericht ? Number(bericht.lieferungen_gesamt) : 0;

      return { date, label: dayLabel(date), score, deliveries, onTimePct };
    });

    const workedDays = days.filter(d => d.score !== null);
    const avgScore = workedDays.length > 0
      ? Math.round(workedDays.reduce((s, d) => s + (d.score ?? 0), 0) / workedDays.length * 10) / 10
      : 0;
    const totalDeliveries = days.reduce((s, d) => s + d.deliveries, 0);

    // Trend: last 3 days vs first 3 days
    const recent = days.slice(-3).filter(d => d.score !== null).map(d => d.score ?? 0);
    const older  = days.slice(0, 4).filter(d => d.score !== null).map(d => d.score ?? 0);
    const avgRecent = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : avgScore;
    const avgOlder  = older.length  > 0 ? older.reduce((a, b) => a + b, 0) / older.length  : avgScore;
    const trend: DriverRow['trend'] =
      avgRecent - avgOlder > 4 ? 'up' : avgOlder - avgRecent > 4 ? 'down' : 'flat';

    rows.push({ driverId, name, days, avgScore, totalDeliveries, trend });
  }

  // Sort by avgScore descending
  rows.sort((a, b) => b.avgScore - a.avgScore);

  return NextResponse.json(rows);
}
