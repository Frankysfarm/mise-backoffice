import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StundenSlot = {
  stunde: string;
  bestellungen_prognose: number;
  fahrer_verfuegbar: number;
  fahrer_empfohlen: number;
  status: 'ok' | 'unterbesetzt' | 'kritisch';
};

type ApiResponse = {
  slots: StundenSlot[];
  fahrer_total_verfuegbar: number;
  peak_stunde: string;
  peak_bestellungen: number;
  fehlende_fahrer: number;
  generiert_am: string;
};

const MOCK: ApiResponse = {
  slots: [
    { stunde: '18:00', bestellungen_prognose: 12, fahrer_verfuegbar: 4, fahrer_empfohlen: 3, status: 'ok' },
    { stunde: '19:00', bestellungen_prognose: 22, fahrer_verfuegbar: 4, fahrer_empfohlen: 5, status: 'unterbesetzt' },
    { stunde: '20:00', bestellungen_prognose: 28, fahrer_verfuegbar: 3, fahrer_empfohlen: 6, status: 'kritisch' },
    { stunde: '21:00', bestellungen_prognose: 24, fahrer_verfuegbar: 3, fahrer_empfohlen: 5, status: 'unterbesetzt' },
    { stunde: '22:00', bestellungen_prognose: 18, fahrer_verfuegbar: 2, fahrer_empfohlen: 4, status: 'unterbesetzt' },
    { stunde: '23:00', bestellungen_prognose: 10, fahrer_verfuegbar: 2, fahrer_empfohlen: 2, status: 'ok' },
    { stunde: '00:00', bestellungen_prognose: 5,  fahrer_verfuegbar: 1, fahrer_empfohlen: 1, status: 'ok' },
  ],
  fahrer_total_verfuegbar: 4,
  peak_stunde: '20:00',
  peak_bestellungen: 28,
  fehlende_fahrer: 3,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK);

  try {
    const supabase = createClient();

    // Active drivers tonight
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, shift_start, shift_end')
      .eq('location_id', locationId)
      .eq('is_active', true);

    const fahrerVerfuegbar = drivers?.length ?? 0;

    // Last week orders by hour for prognosis (same weekday)
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    lastWeek.setUTCHours(0, 0, 0, 0);
    const lastWeekEnd = new Date(lastWeek.getTime() + 86400_000);

    const { data: weekOrders } = await supabase
      .from('customer_orders')
      .select('created_at')
      .eq('location_id', locationId)
      .gte('created_at', lastWeek.toISOString())
      .lt('created_at', lastWeekEnd.toISOString());

    const hourCounts = new Map<number, number>();
    for (const o of weekOrders ?? []) {
      const h = new Date(o.created_at as string).getUTCHours();
      hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
    }

    const now = new Date();
    const startHour = now.getUTCHours();
    const slots: StundenSlot[] = [];

    for (let i = 0; i < 7; i++) {
      const h = (startHour + i) % 24;
      const prognose = hourCounts.get(h) ?? (h >= 18 && h <= 22 ? 15 : 5);
      const empfohlen = Math.ceil(prognose / 5);
      const verfuegbar = fahrerVerfuegbar;
      const status: StundenSlot['status'] =
        verfuegbar < empfohlen - 1 ? 'kritisch'
        : verfuegbar < empfohlen   ? 'unterbesetzt'
        : 'ok';
      const hStr = `${String(h).padStart(2, '0')}:00`;
      slots.push({ stunde: hStr, bestellungen_prognose: prognose, fahrer_verfuegbar: verfuegbar, fahrer_empfohlen: empfohlen, status });
    }

    const peakSlot = slots.reduce((max, s) => s.bestellungen_prognose > max.bestellungen_prognose ? s : max, slots[0]);
    const maxFehlend = slots.reduce((max, s) => Math.max(max, s.fahrer_empfohlen - s.fahrer_verfuegbar), 0);

    return NextResponse.json({
      slots,
      fahrer_total_verfuegbar: fahrerVerfuegbar,
      peak_stunde: peakSlot?.stunde ?? '20:00',
      peak_bestellungen: peakSlot?.bestellungen_prognose ?? 0,
      fehlende_fahrer: Math.max(0, maxFehlend),
      generiert_am: new Date().toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
