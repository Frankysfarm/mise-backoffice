import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface ZoneEfzizienz {
  zone: string;
  avg_fahrzeit_min: number;
  lieferungen: number;
  status: 'optimal' | 'normal' | 'ungünstig';
}

interface FahrerEfzizienz {
  driver_id: string;
  driver_name: string;
  beste_zone: string;
  schlechteste_zone: string;
  zonen: ZoneEfzizienz[];
  hotspot_vorschlag: string;
  gesamt_status: 'optimal' | 'normal' | 'ungünstig';
}

const MOCK_DATA: FahrerEfzizienz[] = [
  {
    driver_id: 'd1',
    driver_name: 'Max M.',
    beste_zone: 'Innenstadt',
    schlechteste_zone: 'Maxvorstadt',
    zonen: [
      { zone: 'Innenstadt', avg_fahrzeit_min: 8, lieferungen: 18, status: 'optimal' },
      { zone: 'Schwabing', avg_fahrzeit_min: 13, lieferungen: 11, status: 'normal' },
      { zone: 'Maxvorstadt', avg_fahrzeit_min: 21, lieferungen: 5, status: 'ungünstig' },
    ],
    hotspot_vorschlag: 'Innenstadt',
    gesamt_status: 'optimal',
  },
  {
    driver_id: 'd2',
    driver_name: 'Anna S.',
    beste_zone: 'Schwabing',
    schlechteste_zone: 'Innenstadt',
    zonen: [
      { zone: 'Schwabing', avg_fahrzeit_min: 9, lieferungen: 15, status: 'optimal' },
      { zone: 'Innenstadt', avg_fahrzeit_min: 17, lieferungen: 8, status: 'normal' },
      { zone: 'Bogenhausen', avg_fahrzeit_min: 24, lieferungen: 3, status: 'ungünstig' },
    ],
    hotspot_vorschlag: 'Schwabing',
    gesamt_status: 'normal',
  },
  {
    driver_id: 'd3',
    driver_name: 'Tom K.',
    beste_zone: 'Bogenhausen',
    schlechteste_zone: 'Schwabing',
    zonen: [
      { zone: 'Bogenhausen', avg_fahrzeit_min: 10, lieferungen: 12, status: 'optimal' },
      { zone: 'Innenstadt', avg_fahrzeit_min: 16, lieferungen: 9, status: 'normal' },
      { zone: 'Schwabing', avg_fahrzeit_min: 26, lieferungen: 4, status: 'ungünstig' },
    ],
    hotspot_vorschlag: 'Bogenhausen',
    gesamt_status: 'normal',
  },
];

function statusFor(avg: number): 'optimal' | 'normal' | 'ungünstig' {
  if (avg <= 12) return 'optimal';
  if (avg <= 20) return 'normal';
  return 'ungünstig';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient();
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const query = supabase
      .from('delivery_tours')
      .select('driver_id, driver_name, delivery_zone, fahrzeit_min, completed_at')
      .gte('completed_at', since.toISOString())
      .not('fahrzeit_min', 'is', null);

    if (locationId) {
      query.eq('location_id', locationId);
    }

    const { data: tours } = await query;

    if (!tours || tours.length === 0) {
      return NextResponse.json(MOCK_DATA);
    }

    const byDriver: Record<string, { name: string; byZone: Record<string, number[]> }> = {};
    for (const t of tours as { driver_id?: string; driver_name?: string; delivery_zone?: string; fahrzeit_min?: number }[]) {
      if (!t.driver_id || !t.delivery_zone || t.fahrzeit_min == null) continue;
      if (!byDriver[t.driver_id]) byDriver[t.driver_id] = { name: t.driver_name ?? t.driver_id, byZone: {} };
      if (!byDriver[t.driver_id].byZone[t.delivery_zone]) byDriver[t.driver_id].byZone[t.delivery_zone] = [];
      byDriver[t.driver_id].byZone[t.delivery_zone].push(t.fahrzeit_min);
    }

    const result: FahrerEfzizienz[] = Object.entries(byDriver).map(([id, { name, byZone }]) => {
      const zonen: ZoneEfzizienz[] = Object.entries(byZone).map(([zone, times]) => {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        return { zone, avg_fahrzeit_min: Math.round(avg * 10) / 10, lieferungen: times.length, status: statusFor(avg) };
      });
      zonen.sort((a, b) => a.avg_fahrzeit_min - b.avg_fahrzeit_min);
      const beste = zonen[0]?.zone ?? '–';
      const schlechteste = zonen[zonen.length - 1]?.zone ?? '–';
      const avgAll = zonen.reduce((a, z) => a + z.avg_fahrzeit_min * z.lieferungen, 0) / (zonen.reduce((a, z) => a + z.lieferungen, 0) || 1);
      return { driver_id: id, driver_name: name, beste_zone: beste, schlechteste_zone: schlechteste, zonen, hotspot_vorschlag: beste, gesamt_status: statusFor(avgAll) };
    });

    return NextResponse.json(result.length > 0 ? result : MOCK_DATA);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
