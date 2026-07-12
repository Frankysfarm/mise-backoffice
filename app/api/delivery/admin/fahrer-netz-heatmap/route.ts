import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1125 — Fahrer-Netz-Heatmap API (Backend)
// Aktive Fahrer-Positionen je Zone A/B/C/D als Auslastungs-Punkte

type ZoneLoad = {
  zone: string;
  aktiv: number;
  on_tour: number;
  bereit: number;
  auslastung_pct: number;
  level: 'leer' | 'niedrig' | 'mittel' | 'hoch' | 'voll';
  fahrer: { id: string; name: string; status: 'on_tour' | 'bereit' | 'pause' }[];
};

type ApiResponse = {
  zonen: ZoneLoad[];
  gesamt_aktiv: number;
  gesamt_on_tour: number;
  location_id: string | null;
  generiert_am: string;
};

function level(pct: number): ZoneLoad['level'] {
  if (pct === 0) return 'leer';
  if (pct <= 25) return 'niedrig';
  if (pct <= 50) return 'mittel';
  if (pct <= 75) return 'hoch';
  return 'voll';
}

function mockData(locationId: string | null): ApiResponse {
  return {
    zonen: [
      { zone: 'A', aktiv: 3, on_tour: 2, bereit: 1, auslastung_pct: 67, level: 'hoch',
        fahrer: [{ id: 'f1', name: 'Ahmad K.', status: 'on_tour' }, { id: 'f2', name: 'Lukas M.', status: 'on_tour' }, { id: 'f3', name: 'Sara P.', status: 'bereit' }] },
      { zone: 'B', aktiv: 2, on_tour: 1, bereit: 1, auslastung_pct: 50, level: 'mittel',
        fahrer: [{ id: 'f4', name: 'Jonas H.', status: 'on_tour' }, { id: 'f5', name: 'Emma T.', status: 'bereit' }] },
      { zone: 'C', aktiv: 1, on_tour: 1, bereit: 0, auslastung_pct: 100, level: 'voll',
        fahrer: [{ id: 'f6', name: 'Mia R.', status: 'on_tour' }] },
      { zone: 'D', aktiv: 0, on_tour: 0, bereit: 0, auslastung_pct: 0, level: 'leer', fahrer: [] },
    ],
    gesamt_aktiv: 6,
    gesamt_on_tour: 4,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(mockData(null));

  try {
    const supabase = await createClient();

    const { data: drivers, error } = await supabase
      .from('mise_drivers')
      .select('id, name, delivery_zone, on_tour, online')
      .eq('location_id', locationId)
      .eq('online', true);

    if (error || !drivers) return NextResponse.json(mockData(locationId));

    const zoneMap = new Map<string, ZoneLoad>();
    for (const z of ['A', 'B', 'C', 'D']) {
      zoneMap.set(z, { zone: z, aktiv: 0, on_tour: 0, bereit: 0, auslastung_pct: 0, level: 'leer', fahrer: [] });
    }

    for (const d of drivers) {
      const zone = (d.delivery_zone as string | null) ?? 'A';
      const zl = zoneMap.get(zone) ?? zoneMap.get('A')!;
      zl.aktiv += 1;
      const status: 'on_tour' | 'bereit' | 'pause' = d.on_tour ? 'on_tour' : 'bereit';
      if (d.on_tour) zl.on_tour += 1; else zl.bereit += 1;
      zl.fahrer.push({ id: d.id as string, name: (d.name ?? 'Unbekannt') as string, status });
    }

    const CAPACITY = 3;
    const zonen: ZoneLoad[] = Array.from(zoneMap.values()).map(zl => {
      const pct = Math.round(Math.min(100, (zl.on_tour / CAPACITY) * 100));
      return { ...zl, auslastung_pct: pct, level: level(pct) };
    });

    const gesamt_aktiv = zonen.reduce((s, z) => s + z.aktiv, 0);
    const gesamt_on_tour = zonen.reduce((s, z) => s + z.on_tour, 0);

    return NextResponse.json({ zonen, gesamt_aktiv, gesamt_on_tour, location_id: locationId, generiert_am: new Date().toISOString() } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
