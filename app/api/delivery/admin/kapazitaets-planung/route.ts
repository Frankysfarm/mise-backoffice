import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type EmpfehlungsLevel = 'kritisch' | 'warnung' | 'ok';

type StundenEmpfehlung = {
  stunde_label: string;     // "14:00–15:00 Uhr"
  empfohlene_fahrer: number;
  aktuelle_fahrer: number;
  delta: number;            // empfohlen - aktuell (positiv = mehr nötig)
  level: EmpfehlungsLevel;
  prognose_bestellungen: number;
};

type ApiResponse = {
  naechste_stunde: StundenEmpfehlung;
  uebernachste_stunde: StundenEmpfehlung;
  aktuelle_fahrer_online: number;
  location_id: string | null;
  generiert_am: string;
};

function buildHourLabel(offsetHours: number): string {
  const now = new Date();
  const start = new Date(now.getTime() + offsetHours * 3600_000);
  const end = new Date(start.getTime() + 3600_000);
  const fmt = (d: Date) =>
    `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  return `${fmt(start)}–${fmt(end)} Uhr`;
}

function mockData(locationId: string | null): ApiResponse {
  return {
    naechste_stunde: {
      stunde_label: buildHourLabel(1),
      empfohlene_fahrer: 4,
      aktuelle_fahrer: 3,
      delta: 1,
      level: 'warnung',
      prognose_bestellungen: 18,
    },
    uebernachste_stunde: {
      stunde_label: buildHourLabel(2),
      empfohlene_fahrer: 5,
      aktuelle_fahrer: 3,
      delta: 2,
      level: 'kritisch',
      prognose_bestellungen: 24,
    },
    aktuelle_fahrer_online: 3,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

function orderRateToDriverCount(bestellungen: number): number {
  // Rule of thumb: 1 driver handles ~4–5 deliveries per hour in normal conditions
  return Math.ceil(bestellungen / 4.5);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();
    const now = new Date();

    // Historical average for same weekday + hour over last 4 weeks
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 3600_000).toISOString();
    const oQ = supabase
      .from('customer_orders')
      .select('created_at')
      .gte('created_at', fourWeeksAgo);
    if (locationId) oQ.eq('location_id', locationId);
    const { data: orders, error: oErr } = await oQ;
    if (oErr || !orders || orders.length === 0) throw new Error('no orders');

    const nextHour = now.getUTCHours() + 1;
    const overNextHour = now.getUTCHours() + 2;
    const weekday = now.getUTCDay();

    type HourBuckets = Record<number, number[]>;
    const byHour: HourBuckets = {};
    for (const o of orders) {
      const d = new Date(o.created_at);
      if (d.getUTCDay() !== weekday) continue;
      const h = d.getUTCHours();
      if (!byHour[h]) byHour[h] = [];
      byHour[h].push(1);
    }

    const avgForHour = (h: number) => {
      const arr = byHour[h % 24];
      if (!arr || arr.length === 0) return 0;
      // avg per week (4 weeks of data)
      return parseFloat((arr.length / 4).toFixed(1));
    };

    const progN = avgForHour(nextHour);
    const progO = avgForHour(overNextHour);

    // Current active drivers
    const dQ = supabase.from('mise_drivers').select('id').eq('online', true);
    if (locationId) dQ.eq('location_id', locationId);
    const { data: activeDrv } = await dQ;
    const aktuelleOnline = activeDrv?.length ?? 3;

    const buildEmp = (prognose: number, offsetH: number): StundenEmpfehlung => {
      const empf = orderRateToDriverCount(prognose);
      const delta = empf - aktuelleOnline;
      const level: EmpfehlungsLevel = delta >= 3 ? 'kritisch' : delta >= 1 ? 'warnung' : 'ok';
      return {
        stunde_label: buildHourLabel(offsetH),
        empfohlene_fahrer: empf,
        aktuelle_fahrer: aktuelleOnline,
        delta,
        level,
        prognose_bestellungen: Math.round(prognose),
      };
    };

    return NextResponse.json({
      naechste_stunde: buildEmp(progN, 1),
      uebernachste_stunde: buildEmp(progO, 2),
      aktuelle_fahrer_online: aktuelleOnline,
      location_id: locationId,
      generiert_am: now.toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
