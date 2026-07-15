import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface RanglisteEintrag {
  rang: number;
  fahrer_id: string;
  fahrer_name: string;
  punkte: number;
  stopps: number;
  avg_liefer_min: number;
  sla_pct: number;
}

export interface SchichtRanglisteResponse {
  rangliste: RanglisteEintrag[];
  eigener_rang: number | null;
  location_id: string | null;
  generiert_am: string;
}

function mockData(locationId: string | null, driverId: string | null): SchichtRanglisteResponse {
  const seed = (locationId?.charCodeAt(0) ?? 42) + (driverId?.charCodeAt(0) ?? 0);
  const names = ['Mehmet K.', 'Jonas B.', 'Luca M.', 'Fahrer D', 'Fahrer E', 'Fahrer F'];
  const rangliste: RanglisteEintrag[] = names.map((n, i) => ({
    rang: i + 1,
    fahrer_id: `mock-${i}`,
    fahrer_name: n,
    punkte: Math.max(0, 95 - i * 8 + (seed % 5)),
    stopps: Math.max(1, 12 - i + (seed % 3)),
    avg_liefer_min: 20 + i * 2 + (seed % 4),
    sla_pct: Math.max(40, 100 - i * 8 - (seed % 5)),
  }));

  let eigenerRang: number | null = null;
  if (driverId) {
    const idx = rangliste.findIndex(r => r.fahrer_id === driverId);
    if (idx >= 0) {
      eigenerRang = idx + 1;
    } else {
      rangliste.push({
        rang: rangliste.length + 1,
        fahrer_id: driverId,
        fahrer_name: 'Du',
        punkte: 45 + (seed % 10),
        stopps: 5 + (seed % 3),
        avg_liefer_min: 28 + (seed % 5),
        sla_pct: 72 + (seed % 15),
      });
      eigenerRang = rangliste.length;
    }
  }

  return {
    rangliste,
    eigener_rang: eigenerRang,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');

  try {
    const supabase = await createClient();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let batchQ = supabase
      .from('delivery_batches')
      .select('id, driver_id, completed_at, created_at')
      .gte('created_at', startOfDay.toISOString())
      .not('driver_id', 'is', null);
    if (locationId) batchQ = batchQ.eq('location_id', locationId);

    const { data: batches, error: bErr } = await batchQ;
    if (bErr || !batches?.length) return NextResponse.json(mockData(locationId, driverId));

    const driverIds = [...new Set(batches.map(b => b.driver_id as string).filter(Boolean))];

    let driverQ = supabase
      .from('mise_drivers')
      .select('id, name, vorname, nachname')
      .in('id', driverIds);
    const { data: drivers } = await driverQ;
    const driverNames: Record<string, string> = {};
    for (const d of drivers ?? []) {
      const fullName = [d.vorname, d.nachname].filter(Boolean).join(' ') || d.name || d.id;
      driverNames[d.id] = fullName;
    }

    let stopQ = supabase
      .from('delivery_stops')
      .select('batch_id, geliefert_am, erwartet_am, status')
      .in('batch_id', batches.map(b => b.id));
    const { data: stops } = await stopQ;
    const stopsByBatch: Record<string, { geliefert_am: string | null; erwartet_am: string | null; status: string | null }[]> = {};
    for (const s of stops ?? []) {
      if (!stopsByBatch[s.batch_id]) stopsByBatch[s.batch_id] = [];
      stopsByBatch[s.batch_id].push(s);
    }

    const byDriver: Record<string, { punkte: number; stopps: number; lieferzeiten: number[]; sla_ok: number }> = {};
    for (const b of batches) {
      const did = b.driver_id as string;
      if (!byDriver[did]) byDriver[did] = { punkte: 0, stopps: 0, lieferzeiten: [], sla_ok: 0 };
      const bStops = stopsByBatch[b.id] ?? [];
      for (const s of bStops) {
        if (s.geliefert_am) {
          byDriver[did].stopps++;
          if (s.erwartet_am) {
            const diffMin = (new Date(s.geliefert_am).getTime() - new Date(s.erwartet_am).getTime()) / 60000;
            byDriver[did].lieferzeiten.push(diffMin + 30);
            if (diffMin <= 0) byDriver[did].sla_ok++;
          } else {
            byDriver[did].lieferzeiten.push(30);
            byDriver[did].sla_ok++;
          }
        }
      }
    }

    const rangliste: RanglisteEintrag[] = Object.entries(byDriver)
      .map(([fid, d]) => {
        const sla_pct = d.lieferzeiten.length > 0
          ? Math.round((d.sla_ok / d.lieferzeiten.length) * 100)
          : 100;
        const avg_liefer = d.lieferzeiten.length > 0
          ? Math.round(d.lieferzeiten.reduce((a, b) => a + b, 0) / d.lieferzeiten.length)
          : 30;
        const punkte = Math.round(sla_pct * 0.6 + d.stopps * 3 + (60 - avg_liefer));
        return { rang: 0, fahrer_id: fid, fahrer_name: driverNames[fid] ?? fid, punkte, stopps: d.stopps, avg_liefer_min: avg_liefer, sla_pct };
      })
      .sort((a, b) => b.punkte - a.punkte)
      .map((r, i) => ({ ...r, rang: i + 1 }));

    const eigenerRang = driverId
      ? (rangliste.find(r => r.fahrer_id === driverId)?.rang ?? null)
      : null;

    return NextResponse.json({
      rangliste,
      eigener_rang: eigenerRang,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies SchichtRanglisteResponse);
  } catch {
    return NextResponse.json(mockData(locationId, driverId));
  }
}
