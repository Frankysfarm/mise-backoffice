/**
 * GET /api/delivery/admin/utilization-heatmap
 *   ?location_id=...&weeks=8
 *   → Liefervolumen-Heatmap: Stunden (0–23) × Wochentage (0=Mo, 6=So)
 *   Aggregiert aus customer_orders der letzten N Wochen.
 *   Rückgabe: { cells: { hour, weekday, avg_orders, max_orders, total_orders, weeks_with_data }[] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HeatmapCell {
  hour: number;       // 0–23
  weekday: number;    // 0=Mo, 1=Di, … 6=So
  avg_orders: number;
  max_orders: number;
  total_orders: number;
  weeks_with_data: number;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const weeks = Math.min(26, Math.max(1, Number(searchParams.get('weeks') ?? '8')));

  if (!locationId) {
    return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });
  }

  // Auth: employee muss zur location gehören
  const { data: emp } = await sb
    .from('employees')
    .select('location_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!emp) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 403 });
  if (emp.role !== 'superadmin' && emp.location_id !== locationId) {
    return NextResponse.json({ error: 'Kein Zugriff auf diese Location' }, { status: 403 });
  }

  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);

  // Bestellungen der letzten N Wochen laden (nur geliefert/abgeschlossen)
  const { data: orders, error } = await sb
    .from('customer_orders')
    .select('bestellt_am')
    .eq('location_id', locationId)
    .in('status', ['geliefert', 'abgeschlossen', 'abgeholt'])
    .gte('bestellt_am', since.toISOString())
    .not('bestellt_am', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregation: hour × weekday → Zähler pro Woche (für avg)
  // weekday: 0=Mo … 6=So (ISO: Sonntag=0 → remapping)
  type WeekKey = string; // "YYYY-Www"
  const counter = new Map<string, Map<WeekKey, number>>();

  for (const o of (orders ?? [])) {
    const d = new Date(o.bestellt_am as string);
    const hour = d.getHours();
    // JS getDay(): 0=So,1=Mo,…,6=Sa → convert to 0=Mo,…,6=So
    const jsDay = d.getDay();
    const weekday = jsDay === 0 ? 6 : jsDay - 1;
    const key = `${hour}:${weekday}`;
    // ISO week key
    const yearNum = d.getFullYear();
    const weekNum = getISOWeek(d);
    const weekKey: WeekKey = `${yearNum}-W${weekNum}`;

    if (!counter.has(key)) counter.set(key, new Map());
    const wMap = counter.get(key)!;
    wMap.set(weekKey, (wMap.get(weekKey) ?? 0) + 1);
  }

  const cells: HeatmapCell[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let weekday = 0; weekday < 7; weekday++) {
      const key = `${hour}:${weekday}`;
      const wMap = counter.get(key);
      if (!wMap) {
        cells.push({ hour, weekday, avg_orders: 0, max_orders: 0, total_orders: 0, weeks_with_data: 0 });
        continue;
      }
      const values = Array.from(wMap.values());
      const total = values.reduce((a, b) => a + b, 0);
      const weeksData = values.length;
      const avg = Math.round((total / Math.max(1, weeks)) * 10) / 10;
      const max = Math.max(...values);
      cells.push({ hour, weekday, avg_orders: avg, max_orders: max, total_orders: total, weeks_with_data: weeksData });
    }
  }

  return NextResponse.json({ cells, weeks, since: since.toISOString() }, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
  });
}

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
