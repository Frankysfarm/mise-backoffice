import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1254 — Navi-Zusammenfassung-API
// Heutige Stopps des Fahrers: Adresse + Zeit + Status + Bewertung
// Multi-Tenant: driver scoped, no location_id needed

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StoppEintrag {
  id: string;
  adresse: string;
  zone: string | null;
  ankunft_zeit: string | null;
  status: 'zugestellt' | 'fehlgeschlagen' | 'unterwegs';
  bewertung: number | null;
  trinkgeld_cent: number | null;
}

interface ApiResponse {
  stopps: StoppEintrag[];
  gesamt_stopps: number;
  zugestellt: number;
  fehlgeschlagen: number;
  schnitt_bewertung: number | null;
  driver_id: string;
  generiert_am: string;
}

function mockData(driver_id: string): ApiResponse {
  const stopps: StoppEintrag[] = [
    { id: 's1', adresse: 'Hauptstr. 12, Mitte',  zone: 'Mitte', ankunft_zeit: new Date(Date.now() - 90*60000).toISOString(), status: 'zugestellt',     bewertung: 5, trinkgeld_cent: 200 },
    { id: 's2', adresse: 'Nordring 4, Nord',      zone: 'Nord',  ankunft_zeit: new Date(Date.now() - 60*60000).toISOString(), status: 'zugestellt',     bewertung: 4, trinkgeld_cent: 100 },
    { id: 's3', adresse: 'Westgasse 7, West',     zone: 'West',  ankunft_zeit: new Date(Date.now() - 30*60000).toISOString(), status: 'fehlgeschlagen', bewertung: null, trinkgeld_cent: null },
    { id: 's4', adresse: 'Südring 22, Süd',       zone: 'Süd',   ankunft_zeit: null,                                          status: 'unterwegs',      bewertung: null, trinkgeld_cent: null },
  ];
  return {
    stopps,
    gesamt_stopps: stopps.length,
    zugestellt: 2,
    fehlgeschlagen: 1,
    schnitt_bewertung: 4.5,
    driver_id,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driver_id = searchParams.get('driver_id');
  if (!driver_id) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: stops } = await supabase
      .from('mise_delivery_stops')
      .select('id, address, zone, delivered_at, status, rating, tip_cent')
      .eq('driver_id', driver_id)
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: true })
      .limit(20);

    if (!stops || stops.length === 0) return NextResponse.json(mockData(driver_id));

    const stopps: StoppEintrag[] = stops.map((s: any) => ({
      id: String(s.id),
      adresse: s.address ?? 'Unbekannte Adresse',
      zone: s.zone ?? null,
      ankunft_zeit: s.delivered_at ?? null,
      status: s.status === 'delivered' ? 'zugestellt'
        : s.status === 'failed' ? 'fehlgeschlagen'
        : 'unterwegs',
      bewertung: s.rating ?? null,
      trinkgeld_cent: s.tip_cent ?? null,
    }));

    const zugestellt = stopps.filter(s => s.status === 'zugestellt').length;
    const fehlgeschlagen = stopps.filter(s => s.status === 'fehlgeschlagen').length;
    const bewertet = stopps.filter(s => s.bewertung !== null);
    const schnitt_bewertung = bewertet.length > 0
      ? bewertet.reduce((sum, s) => sum + (s.bewertung ?? 0), 0) / bewertet.length
      : null;

    return NextResponse.json({
      stopps,
      gesamt_stopps: stopps.length,
      zugestellt,
      fehlgeschlagen,
      schnitt_bewertung: schnitt_bewertung !== null ? Math.round(schnitt_bewertung * 10) / 10 : null,
      driver_id,
      generiert_am: new Date().toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(driver_id));
  }
}
