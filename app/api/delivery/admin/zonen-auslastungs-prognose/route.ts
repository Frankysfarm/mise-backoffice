import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ZonenSlot = {
  zone: string;
  stunde: number;
  prognose_bestellungen: number;
  aktuell_bestellungen: number;
  kapazitaet: number;
  auslastung_prozent: number;
  trend: 'steigend' | 'stabil' | 'fallend';
};

type Response = {
  slots: ZonenSlot[];
  spitzen_zone: string;
  spitzen_stunde: number;
  generiert_am: string;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();
    const now = new Date();
    const aktuelleStunde = now.getHours();
    const zweiStundenSpaeter = new Date(now.getTime() + 2 * 3600 * 1000);

    // Aktuelle Bestellungen je Zone
    const aktuelleQuery = supabase
      .from('customer_orders')
      .select('delivery_zone, created_at')
      .gte('created_at', new Date(now.getTime() - 3600 * 1000).toISOString())
      .lte('created_at', now.toISOString());
    if (locationId) aktuelleQuery.eq('location_id', locationId);

    // Historische Bestellungen selber Wochentag/Stunden letzter 4 Wochen
    const historischQuery = supabase
      .from('customer_orders')
      .select('delivery_zone, created_at')
      .gte('created_at', new Date(now.getTime() - 28 * 24 * 3600 * 1000).toISOString())
      .lte('created_at', now.toISOString());
    if (locationId) historischQuery.eq('location_id', locationId);

    const [{ data: aktuelle }, { data: historisch }] = await Promise.all([aktuelleQuery, historischQuery]);

    if (!historisch?.length) throw new Error('no data');

    const wochentag = now.getDay();
    const zoneAktuell: Record<string, number> = {};
    for (const o of aktuelle ?? []) {
      const z = o.delivery_zone ?? 'Unbekannt';
      zoneAktuell[z] = (zoneAktuell[z] ?? 0) + 1;
    }

    type ZoneStundeCount = Record<string, Record<number, number[]>>;
    const historischMap: ZoneStundeCount = {};
    for (const o of historisch) {
      const d = new Date(o.created_at);
      if (d.getDay() !== wochentag) continue;
      const h = d.getHours();
      if (h < aktuelleStunde || h > aktuelleStunde + 1) continue;
      const z = o.delivery_zone ?? 'Unbekannt';
      if (!historischMap[z]) historischMap[z] = {};
      if (!historischMap[z][h]) historischMap[z][h] = [];
      historischMap[z][h].push(1);
    }

    const zonen = [...new Set([...Object.keys(zoneAktuell), ...Object.keys(historischMap)])].filter(
      (z) => z !== 'Unbekannt'
    );
    const slots: ZonenSlot[] = [];

    for (const zone of zonen) {
      for (let h = aktuelleStunde; h <= aktuelleStunde + 1; h++) {
        const historischeWerte = historischMap[zone]?.[h] ?? [];
        const prognose = historischeWerte.length ? Math.round(historischeWerte.length / 4) : 5;
        const aktuell = h === aktuelleStunde ? (zoneAktuell[zone] ?? 0) : 0;
        const kapazitaet = 25;
        const auslastung = Math.round((prognose / kapazitaet) * 100);
        const prognoseVorstunde = historischMap[zone]?.[h - 1]?.length
          ? Math.round((historischMap[zone][h - 1].length ?? 0) / 4)
          : prognose;
        slots.push({
          zone,
          stunde: h,
          prognose_bestellungen: prognose,
          aktuell_bestellungen: aktuell,
          kapazitaet,
          auslastung_prozent: auslastung,
          trend: prognose > prognoseVorstunde * 1.1 ? 'steigend' : prognose < prognoseVorstunde * 0.9 ? 'fallend' : 'stabil',
        });
      }
    }

    const spitzen = slots.reduce((a, b) => (a.auslastung_prozent > b.auslastung_prozent ? a : b), slots[0]);

    return NextResponse.json({
      slots,
      spitzen_zone: spitzen?.zone ?? '',
      spitzen_stunde: spitzen?.stunde ?? aktuelleStunde,
      generiert_am: now.toISOString(),
    } satisfies Response);
  } catch {
    return NextResponse.json({ slots: [], spitzen_zone: '', spitzen_stunde: 0, generiert_am: new Date().toISOString() });
  }
}
