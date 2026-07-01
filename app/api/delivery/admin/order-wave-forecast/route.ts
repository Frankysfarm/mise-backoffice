/**
 * GET /api/delivery/admin/order-wave-forecast?location_id=...
 *
 * Phase 529 — Bestellungs-Wellen-Prognose
 * Berechnet basierend auf Wochentag + Uhrzeit-Mustern (letzte 4 Wochen)
 * die erwarteten Bestellvolumen in den nächsten 4 Stunden (30-Min-Slots).
 *
 * Response: { ok, slots: WaveSlot[], summary: WaveSummary, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type WaveIntensity = 'low' | 'medium' | 'high' | 'peak';

export interface WaveSlot {
  slotStart: string;        // ISO UTC
  slotEnd: string;          // ISO UTC
  hourLabel: string;        // "14:00–14:30"
  expectedOrders: number;
  historicAvg: number;
  confidence: number;       // 0–100
  intensity: WaveIntensity;
}

export interface WaveSummary {
  peakSlot: string | null;
  peakExpected: number;
  totalExpected4h: number;
  highSlots: number;
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

function waveIntensity(avg: number): WaveIntensity {
  if (avg >= 15) return 'peak';
  if (avg >= 8)  return 'high';
  if (avg >= 3)  return 'medium';
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

  const ssb = createServiceClient();
  const now = new Date();

  // Nächste 4 Stunden in 30-Min-Slots (8 Slots)
  const SLOTS = 8;
  const SLOT_MS = 30 * 60_000;

  // Runde auf nächsten 30-Min-Start
  const slotBase = new Date(Math.ceil(now.getTime() / SLOT_MS) * SLOT_MS);

  // Gleicher Wochentag der letzten 4 Wochen für historischen Ø
  const weekday = now.getUTCDay();
  const historicDayStarts: Date[] = [];
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  for (let w = 1; w <= 4; w++) {
    historicDayStarts.push(new Date(todayStart.getTime() - w * 7 * 86_400_000));
  }

  // Historische Bestellungen der letzten 4 gleichen Wochentage laden
  type OrderRow = { bestellt_am: string };
  const histStart = historicDayStarts[historicDayStarts.length - 1];
  const histEnd   = new Date(historicDayStarts[0].getTime() + 86_400_000);

  const { data: histRows } = await ssb
    .from('customer_orders')
    .select('bestellt_am')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .not('status', 'in', '("storniert","cancelled")')
    .gte('bestellt_am', histStart.toISOString())
    .lt('bestellt_am', histEnd.toISOString());

  const histOrders = (histRows ?? []) as OrderRow[];

  // Für jeden Slot: historischen Ø berechnen
  const slots: WaveSlot[] = [];

  for (let i = 0; i < SLOTS; i++) {
    const slotStart = new Date(slotBase.getTime() + i * SLOT_MS);
    const slotEnd   = new Date(slotBase.getTime() + (i + 1) * SLOT_MS);

    // Für jeden historischen Tag: Bestellungen im gleichen Stunden/Minuten-Fenster zählen
    const slotHourStart = slotStart.getUTCHours();
    const slotMinStart  = slotStart.getUTCMinutes();
    const slotHourEnd   = slotEnd.getUTCHours();
    const slotMinEnd    = slotEnd.getUTCMinutes();

    let totalHistoric = 0;
    let daysWithData = 0;

    for (const dayStart of historicDayStarts) {
      const windowStart = new Date(dayStart);
      windowStart.setUTCHours(slotHourStart, slotMinStart, 0, 0);
      const windowEnd = new Date(dayStart);
      windowEnd.setUTCHours(slotHourEnd, slotMinEnd, 0, 0);

      const count = histOrders.filter((o) => {
        const t = new Date(o.bestellt_am).getTime();
        return t >= windowStart.getTime() && t < windowEnd.getTime();
      }).length;

      totalHistoric += count;
      if (count > 0) daysWithData++;
    }

    const historicAvg = Math.round((totalHistoric / 4) * 10) / 10;
    const expectedOrders = Math.round(historicAvg);

    // Konfidenz: je mehr Tage Daten haben, desto höher
    const confidence = Math.round((daysWithData / 4) * 100);

    const startH = slotStart.getUTCHours().toString().padStart(2, '0');
    const startM = slotStart.getUTCMinutes().toString().padStart(2, '0');
    const endH   = slotEnd.getUTCHours().toString().padStart(2, '0');
    const endM   = slotEnd.getUTCMinutes().toString().padStart(2, '0');

    slots.push({
      slotStart: slotStart.toISOString(),
      slotEnd:   slotEnd.toISOString(),
      hourLabel: `${startH}:${startM}–${endH}:${endM}`,
      expectedOrders,
      historicAvg,
      confidence,
      intensity: waveIntensity(historicAvg),
    });
  }

  const peakSlot = slots.reduce<WaveSlot | null>(
    (best, s) => (best === null || s.expectedOrders > best.expectedOrders ? s : best),
    null,
  );
  const totalExpected4h = slots.reduce((s, slot) => s + slot.expectedOrders, 0);
  const highSlots = slots.filter((s) => s.intensity === 'high' || s.intensity === 'peak').length;

  return NextResponse.json({
    ok: true,
    slots,
    summary: {
      peakSlot: peakSlot?.hourLabel ?? null,
      peakExpected: peakSlot?.expectedOrders ?? 0,
      totalExpected4h,
      highSlots,
    },
    generatedAt: now.toISOString(),
  });
}
