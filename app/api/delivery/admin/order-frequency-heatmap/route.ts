/**
 * GET /api/delivery/admin/order-frequency-heatmap?location_id=...&weeks=8
 *
 * Phase 520 — Bestellfrequenz-Heatmap
 * 7×24-Matrix der durchschnittlichen Bestellanzahl je Wochentag × Stunde
 * Basis: letzte N Wochen historischer Daten.
 *
 * Response: { ok, data: FrequencyData, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FrequencyCell {
  dow: number;     // 0=So, 1=Mo, …, 6=Sa
  hour: number;    // 0–23 UTC
  avgOrders: number;
  peakClass: 'low' | 'normal' | 'peak' | 'high';
}

export interface FrequencyData {
  cells: FrequencyCell[];
  peakCell: { dow: number; hour: number; avgOrders: number } | null;
  weekdayTotals: { dow: number; label: string; avgDailyOrders: number }[];
  hourTotals: { hour: number; avgHourlyOrders: number }[];
  basisWeeks: number;
}

const DOW_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

function peakClass(avg: number, maxAvg: number): FrequencyCell['peakClass'] {
  if (avg === 0) return 'low';
  const ratio = avg / Math.max(1, maxAvg);
  if (ratio >= 0.75) return 'high';
  if (ratio >= 0.45) return 'peak';
  if (ratio >= 0.2) return 'normal';
  return 'low';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const weeks = Math.min(16, Math.max(2, parseInt(searchParams.get('weeks') ?? '8', 10)));

  const ssb = createServiceClient();
  const now = new Date();
  const since = new Date(now.getTime() - weeks * 7 * 24 * 3_600_000);

  const { data: rows } = await ssb
    .from('customer_orders')
    .select('bestellt_am')
    .eq('location_id', locationId)
    .neq('status', 'storniert')
    .gte('bestellt_am', since.toISOString());

  const orders = (rows ?? []) as { bestellt_am: string }[];

  // Aggregiere: Summe je DOW×Stunde über alle Wochen
  const sum: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  // Zähle wie viele Wochen tatsächlich existieren je DOW (für Ø-Berechnung)
  const weekCount: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(weeks));

  for (const o of orders) {
    if (!o.bestellt_am) continue;
    const d = new Date(o.bestellt_am);
    const dow = d.getUTCDay();
    const hour = d.getUTCHours();
    sum[dow][hour]++;
  }

  // Ø pro Woche
  const avg: number[][] = sum.map((row, dow) =>
    row.map((s, h) => Math.round((s / weekCount[dow][h]) * 10) / 10)
  );

  // Max für Peak-Klassifizierung
  const maxAvg = Math.max(...avg.flat());

  const cells: FrequencyCell[] = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      const avgOrders = avg[dow][hour];
      cells.push({ dow, hour, avgOrders, peakClass: peakClass(avgOrders, maxAvg) });
    }
  }

  // Peak-Zelle
  let peakCell: FrequencyData['peakCell'] = null;
  let peakVal = 0;
  for (const c of cells) {
    if (c.avgOrders > peakVal) {
      peakVal = c.avgOrders;
      peakCell = { dow: c.dow, hour: c.hour, avgOrders: c.avgOrders };
    }
  }

  // Wochentag-Summen
  const weekdayTotals = Array.from({ length: 7 }, (_, dow) => ({
    dow,
    label: DOW_LABELS[dow],
    avgDailyOrders: Math.round(avg[dow].reduce((s, v) => s + v, 0) * 10) / 10,
  }));

  // Stunden-Summen
  const hourTotals = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    avgHourlyOrders: Math.round(avg.reduce((s, row) => s + row[h], 0) * 10) / 10,
  }));

  const data: FrequencyData = {
    cells,
    peakCell,
    weekdayTotals,
    hourTotals,
    basisWeeks: weeks,
  };

  return NextResponse.json({ ok: true, data, generatedAt: now.toISOString() });
}
