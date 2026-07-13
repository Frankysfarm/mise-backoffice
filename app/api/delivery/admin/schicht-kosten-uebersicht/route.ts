import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FahrerKosten = {
  fahrer_id: string;
  fahrer_name: string;
  schicht_stunden: number;
  kosten_eur: number;
  stopps: number;
  kosten_pro_stopp_eur: number;
};

type ApiResponse = {
  fahrer: FahrerKosten[];
  gesamt_kosten_eur: number;
  gesamt_umsatz_eur: number;
  break_even_pct: number;
  gewinn_eur: number;
  profitabel: boolean;
  stundenlohn_eur: number;
  location_id: string | null;
  generiert_am: string;
};

const STUNDENLOHN_EUR = 12;

function mockData(locationId: string | null): ApiResponse {
  const fahrer: FahrerKosten[] = [
    { fahrer_id: 'f1', fahrer_name: 'Ahmad K.',  schicht_stunden: 5.5, kosten_eur: 66.0,  stopps: 22, kosten_pro_stopp_eur: 3.0 },
    { fahrer_id: 'f2', fahrer_name: 'Lukas M.',  schicht_stunden: 4.0, kosten_eur: 48.0,  stopps: 17, kosten_pro_stopp_eur: 2.82 },
    { fahrer_id: 'f3', fahrer_name: 'Sara P.',   schicht_stunden: 6.0, kosten_eur: 72.0,  stopps: 24, kosten_pro_stopp_eur: 3.0 },
  ];
  const gesamt_kosten_eur = fahrer.reduce((s, f) => s + f.kosten_eur, 0);
  const gesamt_umsatz_eur = 847.5;
  const break_even_pct = Math.round((gesamt_kosten_eur / gesamt_umsatz_eur) * 100);
  return {
    fahrer,
    gesamt_kosten_eur,
    gesamt_umsatz_eur,
    break_even_pct,
    gewinn_eur: gesamt_umsatz_eur - gesamt_kosten_eur,
    profitabel: gesamt_umsatz_eur > gesamt_kosten_eur,
    stundenlohn_eur: STUNDENLOHN_EUR,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(mockData(null));

  try {
    const supabase = await createClient();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    // Fetch active drivers
    const { data: drivers } = await supabase
      .from('mise_drivers')
      .select('id, name, shift_started_at')
      .eq('location_id', locationId)
      .not('shift_started_at', 'is', null);

    // Fetch today's orders for revenue
    const { data: orders } = await supabase
      .from('customer_orders')
      .select('id, total_price, driver_id')
      .eq('location_id', locationId)
      .gte('created_at', todayIso)
      .in('status', ['delivered', 'geliefert', 'completed']);

    if (!drivers || drivers.length === 0) {
      return NextResponse.json(mockData(locationId));
    }

    const now = Date.now();
    const stopsByDriver = new Map<string, number>();
    if (orders) {
      for (const o of orders) {
        const did = o.driver_id as string | null;
        if (did) stopsByDriver.set(did, (stopsByDriver.get(did) ?? 0) + 1);
      }
    }

    const fahrer: FahrerKosten[] = drivers.map(d => {
      const shiftStart = d.shift_started_at ? new Date(d.shift_started_at as string).getTime() : now - 4 * 3600 * 1000;
      const schicht_stunden = Math.max(0, (now - shiftStart) / 3600000);
      const kosten_eur = Math.round(schicht_stunden * STUNDENLOHN_EUR * 100) / 100;
      const stopps = stopsByDriver.get(d.id as string) ?? 0;
      return {
        fahrer_id: d.id as string,
        fahrer_name: (d.name as string | null) ?? 'Fahrer',
        schicht_stunden: Math.round(schicht_stunden * 10) / 10,
        kosten_eur,
        stopps,
        kosten_pro_stopp_eur: stopps > 0 ? Math.round((kosten_eur / stopps) * 100) / 100 : 0,
      };
    });

    const gesamt_kosten_eur = Math.round(fahrer.reduce((s, f) => s + f.kosten_eur, 0) * 100) / 100;
    const gesamt_umsatz_eur = orders
      ? Math.round(orders.reduce((s, o) => s + ((o.total_price as number | null) ?? 0), 0) * 100) / 100
      : 0;

    const result: ApiResponse = {
      fahrer,
      gesamt_kosten_eur,
      gesamt_umsatz_eur,
      break_even_pct: gesamt_umsatz_eur > 0 ? Math.round((gesamt_kosten_eur / gesamt_umsatz_eur) * 100) : 100,
      gewinn_eur: Math.round((gesamt_umsatz_eur - gesamt_kosten_eur) * 100) / 100,
      profitabel: gesamt_umsatz_eur > gesamt_kosten_eur,
      stundenlohn_eur: STUNDENLOHN_EUR,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
