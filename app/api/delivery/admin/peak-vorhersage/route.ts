/**
 * GET /api/delivery/admin/peak-vorhersage?location_id=<uuid>
 *
 * Phase 838 — Bestellungs-Peak-Vorhersage-API
 * Analysiert historische Wochentag-Stunden-Muster aus customer_orders (letzte 4 Wochen).
 * Gibt nächsten Peak-Slot + Countdown zurück.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentWeekday = now.getUTCDay();
  const seit4w = new Date(now.getTime() - 28 * 24 * 3_600_000).toISOString();

  const { data: orders } = await sb
    .from('customer_orders')
    .select('created_at')
    .eq('location_id', locationId)
    .gte('created_at', seit4w);

  const all = orders ?? [];

  // Aggregiere Bestellungen je Wochentag × Stunde
  const wdHourMap = new Map<string, number>();
  for (const o of all) {
    const d = new Date(o.created_at as string);
    const wd = d.getUTCDay();
    const h  = d.getUTCHours();
    const key = `${wd}_${h}`;
    wdHourMap.set(key, (wdHourMap.get(key) ?? 0) + 1);
  }

  // Gesamtvolumen je aktueller Wochentag (für Anteil-Berechnung)
  const todayOrders = Array.from(wdHourMap.entries())
    .filter(([k]) => k.startsWith(`${currentWeekday}_`))
    .map(([k, v]) => ({ h: parseInt(k.split('_')[1], 10), count: v }));

  const dayTotal = todayOrders.reduce((s, o) => s + o.count, 0) || 1;

  // Finde nächsten Peak (nächste 8 Stunden)
  const slots = [];
  for (let offset = 1; offset <= 8; offset++) {
    const h = (currentHour + offset) % 24;
    const count = wdHourMap.get(`${currentWeekday}_${h}`) ?? 0;
    const anteil = Math.round((count / dayTotal) * 100);
    slots.push({ stunde: h, label: `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00`, anteil, offset });
  }

  const peakSlot = slots.reduce((best, curr) => curr.anteil > best.anteil ? curr : best, slots[0]);

  const aktuelleStunde = wdHourMap.get(`${currentWeekday}_${currentHour}`) ?? 0;
  const aktuelleStundeAnteil = Math.round((aktuelleStunde / dayTotal) * 100);

  // Ampel basierend auf Zeit bis Peak
  const bisPeakMin = peakSlot.anteil > 5 ? (peakSlot.offset - 1) * 60 + (60 - now.getUTCMinutes()) : null;
  const ampel: 'gruen' | 'amber' | 'rot' =
    bisPeakMin == null ? 'gruen' :
    bisPeakMin <= 30 ? 'rot' :
    bisPeakMin <= 90 ? 'amber' : 'gruen';

  return NextResponse.json({
    naechster_peak: peakSlot.anteil > 5
      ? { stunde: peakSlot.stunde, label: peakSlot.label, anteil: peakSlot.anteil }
      : null,
    aktuelle_stunde_anteil: aktuelleStundeAnteil,
    bis_peak_min: bisPeakMin,
    ampel,
    generatedAt: now.toISOString(),
  });
}
