import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 48 slots = 24h × 2 (je 30 Min)
const SLOT_COUNT = 48;
const VERSTAERKUNG_SCHWELLE = 0.75; // >75% des Peak-Werts → Empfehlung

type Slot = {
  slot_index: number;
  uhrzeit: string; // "08:00", "08:30", …
  bestellungen: number;
  intensitaet: 'peak' | 'hoch' | 'mittel' | 'niedrig';
  empfehlung_verstaerkung: boolean;
  pct_of_peak: number;
};

function slotLabel(idx: number): string {
  const h = Math.floor(idx / 2).toString().padStart(2, '0');
  const m = idx % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
}

function mockData(locationId: string | null): { slots: Slot[]; peak_slot: string; peak_bestellungen: number; location_id: string | null; generiert_am: string } {
  const peak = Math.floor(Math.random() * 10) + 30;
  const slots: Slot[] = Array.from({ length: SLOT_COUNT }, (_, i) => {
    // Simulate lunch (24–28) and dinner (36–42) peaks
    const lunchDist = Math.abs(i - 26);
    const dinnerDist = Math.abs(i - 39);
    const raw = Math.max(0, peak - lunchDist * 3, peak * 0.9 - dinnerDist * 2.5);
    const noise = Math.floor(Math.random() * 4) - 2;
    const bestellungen = Math.max(0, Math.round(raw + noise));
    return { slot_index: i, uhrzeit: slotLabel(i), bestellungen, intensitaet: 'niedrig', empfehlung_verstaerkung: false, pct_of_peak: 0 };
  });
  const peakVal = Math.max(...slots.map(s => s.bestellungen));
  for (const s of slots) {
    const pct = peakVal > 0 ? s.bestellungen / peakVal : 0;
    s.pct_of_peak = parseFloat((pct * 100).toFixed(1));
    s.intensitaet = pct >= 0.9 ? 'peak' : pct >= 0.6 ? 'hoch' : pct >= 0.3 ? 'mittel' : 'niedrig';
    s.empfehlung_verstaerkung = pct >= VERSTAERKUNG_SCHWELLE;
  }
  const peakSlot = slots.find(s => s.bestellungen === peakVal);
  return { slots, peak_slot: peakSlot?.uhrzeit ?? '12:00', peak_bestellungen: peakVal, location_id: locationId, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();
    const since28d = new Date(Date.now() - 28 * 24 * 3600_000).toISOString();

    const q = supabase
      .from('customer_orders')
      .select('created_at')
      .gte('created_at', since28d)
      .not('created_at', 'is', null);
    if (locationId) q.eq('location_id', locationId);

    const { data: orders, error } = await q;
    if (error || !orders || orders.length === 0) throw new Error('no data');

    // Aggregate into 30-min slots by time-of-day (weekday-normalised)
    const counts = new Array<number>(SLOT_COUNT).fill(0);
    for (const o of orders) {
      const d = new Date(o.created_at as string);
      const slotIdx = d.getUTCHours() * 2 + (d.getUTCMinutes() >= 30 ? 1 : 0);
      counts[slotIdx]++;
    }
    // Normalize by number of weeks (4 weeks)
    const weekCount = 4;
    const peakVal = Math.max(...counts);

    const slots: Slot[] = counts.map((raw, i) => {
      const bestellungen = Math.round(raw / weekCount);
      const pct = peakVal > 0 ? raw / peakVal : 0;
      return {
        slot_index: i,
        uhrzeit: slotLabel(i),
        bestellungen,
        intensitaet: pct >= 0.9 ? 'peak' : pct >= 0.6 ? 'hoch' : pct >= 0.3 ? 'mittel' : 'niedrig',
        empfehlung_verstaerkung: pct >= VERSTAERKUNG_SCHWELLE,
        pct_of_peak: parseFloat((pct * 100).toFixed(1)),
      };
    });

    const peakSlot = slots[counts.indexOf(peakVal)];
    return NextResponse.json({
      slots,
      peak_slot: peakSlot?.uhrzeit ?? '12:00',
      peak_bestellungen: Math.round(peakVal / weekCount),
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
