/**
 * GET /api/delivery/driver/tages-rangliste
 *   ?driver_id=<uuid>&location_id=<uuid>
 *
 * Phase 1259 — Tages-Rangliste-API
 * Fahrer sieht eigene Platzierung (Stopps/h) vs. anonymisierte Kollegen.
 *
 * Multi-Tenant: location_id on every Supabase query.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RanglistenEintrag {
  rang: number;
  name: string; // anonymisiert außer für eigenen Fahrer
  stopps_heute: number;
  stopps_pro_stunde: number;
  ist_eigener_fahrer: boolean;
}

interface RanglisteResponse {
  eintraege: RanglistenEintrag[];
  eigener_rang: number | null;
  gesamt_fahrer: number;
  driver_id: string;
  location_id: string;
  generiert_am: string;
}

function buildMock(driverId: string, locationId: string): RanglisteResponse {
  const eintraege: RanglistenEintrag[] = [
    { rang: 1, name: 'K. Müller',   stopps_heute: 14, stopps_pro_stunde: 3.5, ist_eigener_fahrer: false },
    { rang: 2, name: 'T. Schmidt',  stopps_heute: 12, stopps_pro_stunde: 3.2, ist_eigener_fahrer: false },
    { rang: 3, name: 'Du',          stopps_heute: 11, stopps_pro_stunde: 2.9, ist_eigener_fahrer: true },
    { rang: 4, name: 'Fahrer #4',   stopps_heute: 9,  stopps_pro_stunde: 2.6, ist_eigener_fahrer: false },
    { rang: 5, name: 'Fahrer #5',   stopps_heute: 7,  stopps_pro_stunde: 2.1, ist_eigener_fahrer: false },
  ];
  return {
    eintraege,
    eigener_rang: 3,
    gesamt_fahrer: 5,
    driver_id: driverId,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

function anonymisiere(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]!.toUpperCase()}. ${parts[parts.length - 1]}`;
  }
  return parts[0] ?? 'Fahrer';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id') ?? '';
  const locationId = searchParams.get('location_id') ?? '';

  if (!driverId || !locationId) {
    return NextResponse.json(buildMock(driverId, locationId));
  }

  try {
    const supabase = await createClient();

    const heute = new Date();
    const heuteStart = `${heute.toISOString().slice(0, 10)}T00:00:00`;

    // Alle online Fahrer dieser Location
    const { data: fahrerRaw } = await supabase
      .from('mise_drivers')
      .select('id, name, shift_started_at')
      .eq('location_id', locationId)
      .eq('online', true);

    if (!fahrerRaw || fahrerRaw.length === 0) {
      return NextResponse.json(buildMock(driverId, locationId));
    }

    const fahrer = fahrerRaw as Array<{ id: string; name: string; shift_started_at: string | null }>;
    const fahrerIds = fahrer.map(f => f.id);

    // Stopps heute je Fahrer
    const { data: stopsRaw } = await supabase
      .from('mise_delivery_stops')
      .select('driver_id, delivered_at')
      .eq('location_id', locationId)
      .in('driver_id', fahrerIds)
      .gte('created_at', heuteStart)
      .not('delivered_at', 'is', null);

    const stopsByFahrer: Record<string, number> = {};
    for (const s of stopsRaw ?? []) {
      const did = (s as { driver_id: string }).driver_id;
      stopsByFahrer[did] = (stopsByFahrer[did] ?? 0) + 1;
    }

    // Stopps/h je Fahrer
    const now = Date.now();
    const eintraege: RanglistenEintrag[] = fahrer.map(f => {
      const stopps = stopsByFahrer[f.id] ?? 0;
      const schichtStart = f.shift_started_at ? new Date(f.shift_started_at).getTime() : (now - 4 * 60 * 60 * 1_000);
      const aktivStunden = Math.max(0.5, (now - schichtStart) / 3_600_000);
      const stoppsProStunde = Math.round((stopps / aktivStunden) * 10) / 10;
      return {
        rang: 0,
        name: f.id === driverId ? 'Du' : anonymisiere(f.name),
        stopps_heute: stopps,
        stopps_pro_stunde: stoppsProStunde,
        ist_eigener_fahrer: f.id === driverId,
      };
    });

    // Sortieren nach Stopps/h desc
    eintraege.sort((a, b) => b.stopps_pro_stunde - a.stopps_pro_stunde);
    eintraege.forEach((e, i) => { e.rang = i + 1; });

    const eigenerEintrag = eintraege.find(e => e.ist_eigener_fahrer);
    const eigener_rang = eigenerEintrag?.rang ?? null;

    if (eintraege.length === 0) {
      return NextResponse.json(buildMock(driverId, locationId));
    }

    return NextResponse.json({
      eintraege,
      eigener_rang,
      gesamt_fahrer: eintraege.length,
      driver_id: driverId,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies RanglisteResponse);
  } catch {
    return NextResponse.json(buildMock(driverId, locationId));
  }
}
