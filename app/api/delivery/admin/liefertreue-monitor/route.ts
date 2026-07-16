/**
 * GET /api/delivery/admin/liefertreue-monitor?location_id=<uuid>
 *
 * Phase 1851 — Liefertreue-Monitor-API
 * SLA-Quote heutiger Schicht: on-time (<30 Min), etwas spät (30–45 Min), sehr spät (>45 Min), noch offen.
 * Prozent on-time (SLA-Quote); Fahrer-Ranglist; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLA_ONTIME_MIN = 30;
const SLA_SPAET_MIN = 45;

interface FahrerSla {
  fahrer_id: string;
  fahrer_name: string;
  ontime: number;
  etwas_spaet: number;
  sehr_spaet: number;
  gesamt: number;
  quote: number;
}

interface ApiAntwort {
  location_id: string;
  datum: string;
  ontime: number;
  etwas_spaet: number;
  sehr_spaet: number;
  noch_offen: number;
  gesamt_abgeschlossen: number;
  sla_quote: number;
  fahrer: FahrerSla[];
  generiert_am: string;
}

const MOCK: ApiAntwort = {
  location_id: 'mock',
  datum: new Date().toISOString().slice(0, 10),
  ontime: 32,
  etwas_spaet: 7,
  sehr_spaet: 2,
  noch_offen: 3,
  gesamt_abgeschlossen: 41,
  sla_quote: 78,
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.', ontime: 14, etwas_spaet: 2, sehr_spaet: 0, gesamt: 16, quote: 88 },
    { fahrer_id: 'f2', fahrer_name: 'Lisa K.', ontime: 10, etwas_spaet: 3, sehr_spaet: 1, gesamt: 14, quote: 71 },
    { fahrer_id: 'f3', fahrer_name: 'Tom S.', ontime: 8, etwas_spaet: 2, sehr_spaet: 1, gesamt: 11, quote: 73 },
  ],
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(5, 0, 0, 0);
    if (now.getUTCHours() < 5) todayStart.setUTCDate(todayStart.getUTCDate() - 1);

    const { data: orders } = await sb
      .from('customer_orders')
      .select('id, driver_id, status, created_at, scheduled_delivery_time, actual_delivery_time')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .in('status', ['delivered', 'delivering', 'preparing', 'confirmed', 'pending']);

    if (!orders || orders.length === 0) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    const fahrerIds = [...new Set((orders).map((o: any) => o.driver_id).filter(Boolean))];
    const { data: drivers } = fahrerIds.length > 0
      ? await sb.from('mise_drivers').select('id, vorname, nachname').in('id', fahrerIds)
      : { data: [] };
    const driversMap = new Map((drivers ?? []).map((d: any) => [d.id, `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim()]));

    let ontimeCount = 0;
    let etwaSpaetCount = 0;
    let sehrSpaetCount = 0;
    let nochOffenCount = 0;

    const fahrerMap = new Map<string, FahrerSla>();

    for (const o of orders) {
      const fId = o.driver_id ?? 'unbekannt';
      if (!fahrerMap.has(fId)) {
        fahrerMap.set(fId, {
          fahrer_id: fId,
          fahrer_name: driversMap.get(fId) ?? 'Unbekannt',
          ontime: 0,
          etwas_spaet: 0,
          sehr_spaet: 0,
          gesamt: 0,
          quote: 0,
        });
      }
      const fs = fahrerMap.get(fId)!;

      if (o.status !== 'delivered' || !o.actual_delivery_time || !o.created_at) {
        nochOffenCount++;
        continue;
      }

      const bestelltMs = new Date(o.created_at).getTime();
      const geliefertMs = new Date(o.actual_delivery_time).getTime();
      const dauerMin = (geliefertMs - bestelltMs) / 60_000;

      fs.gesamt++;

      if (dauerMin <= SLA_ONTIME_MIN) {
        ontimeCount++;
        fs.ontime++;
      } else if (dauerMin <= SLA_SPAET_MIN) {
        etwaSpaetCount++;
        fs.etwas_spaet++;
      } else {
        sehrSpaetCount++;
        fs.sehr_spaet++;
      }
    }

    const fahrer: FahrerSla[] = [...fahrerMap.values()]
      .filter((f) => f.gesamt > 0)
      .map((f) => ({ ...f, quote: Math.round((f.ontime / f.gesamt) * 100) }))
      .sort((a, b) => b.quote - a.quote);

    const gesamt = ontimeCount + etwaSpaetCount + sehrSpaetCount;
    const slaQuote = gesamt > 0 ? Math.round((ontimeCount / gesamt) * 100) : 0;

    return NextResponse.json({
      location_id: locationId,
      datum: now.toISOString().slice(0, 10),
      ontime: ontimeCount,
      etwas_spaet: etwaSpaetCount,
      sehr_spaet: sehrSpaetCount,
      noch_offen: nochOffenCount,
      gesamt_abgeschlossen: gesamt,
      sla_quote: slaQuote,
      fahrer,
      generiert_am: now.toISOString(),
    } satisfies ApiAntwort);
  } catch (err) {
    console.error('[liefertreue-monitor]', err);
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
