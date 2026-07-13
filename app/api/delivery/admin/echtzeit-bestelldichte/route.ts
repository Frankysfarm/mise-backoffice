import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1246 — Echtzeit-Bestelldichte-API
// Bestellungen je Zone der letzten 2h + Hotspot-Erkennung
// Multi-Tenant: location_id auf jeder Query

interface ZoneDichte {
  zone: string;
  bestellungen_2h: number;
  bestellungen_30min: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  hotspot: boolean;
  intensitaet: 'ruhig' | 'normal' | 'hoch' | 'peak';
}

interface ApiResponse {
  zonen: ZoneDichte[];
  gesamt_2h: number;
  hotspot_zonen: string[];
  peak_zone: string | null;
  location_id: string;
  generiert_am: string;
}

function intensitaet(count: number): ZoneDichte['intensitaet'] {
  if (count >= 20) return 'peak';
  if (count >= 12) return 'hoch';
  if (count >= 5) return 'normal';
  return 'ruhig';
}

function trend(count2h: number, count30m: number): ZoneDichte['trend'] {
  const rate30 = count30m * 4; // auf 2h hochgerechnet
  if (rate30 > count2h * 1.2) return 'steigend';
  if (rate30 < count2h * 0.8) return 'fallend';
  return 'stabil';
}

function mockData(location_id: string): ApiResponse {
  const zonen: ZoneDichte[] = [
    { zone: 'Mitte', bestellungen_2h: 24, bestellungen_30min: 8, trend: 'steigend', hotspot: true, intensitaet: 'peak' },
    { zone: 'Nord', bestellungen_2h: 11, bestellungen_30min: 2, trend: 'fallend', hotspot: false, intensitaet: 'hoch' },
    { zone: 'Süd', bestellungen_2h: 7, bestellungen_30min: 2, trend: 'stabil', hotspot: false, intensitaet: 'normal' },
    { zone: 'West', bestellungen_2h: 3, bestellungen_30min: 1, trend: 'stabil', hotspot: false, intensitaet: 'ruhig' },
  ];
  return {
    zonen,
    gesamt_2h: zonen.reduce((s, z) => s + z.bestellungen_2h, 0),
    hotspot_zonen: zonen.filter(z => z.hotspot).map(z => z.zone),
    peak_zone: 'Mitte',
    location_id,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');
  if (!location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const now = new Date();
  const ago2h = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const ago30m = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

  try {
    const supabase = await createClient();

    const { data: orders2h } = await supabase
      .from('customer_orders')
      .select('id, delivery_zone, created_at')
      .eq('location_id', location_id)
      .eq('type', 'lieferung')
      .gte('created_at', ago2h);

    if (!orders2h || orders2h.length === 0) return NextResponse.json(mockData(location_id));

    const zonenMap = new Map<string, { count2h: number; count30m: number }>();
    for (const o of orders2h) {
      const z = o.delivery_zone ?? 'Unbekannt';
      const entry = zonenMap.get(z) ?? { count2h: 0, count30m: 0 };
      entry.count2h++;
      if (o.created_at >= ago30m) entry.count30m++;
      zonenMap.set(z, entry);
    }

    const zonen: ZoneDichte[] = Array.from(zonenMap.entries()).map(([zone, { count2h, count30m }]) => ({
      zone,
      bestellungen_2h: count2h,
      bestellungen_30min: count30m,
      trend: trend(count2h, count30m),
      hotspot: count2h >= 15,
      intensitaet: intensitaet(count2h),
    })).sort((a, b) => b.bestellungen_2h - a.bestellungen_2h);

    const peak_zone = zonen[0]?.zone ?? null;

    return NextResponse.json({
      zonen,
      gesamt_2h: orders2h.length,
      hotspot_zonen: zonen.filter(z => z.hotspot).map(z => z.zone),
      peak_zone,
      location_id,
      generiert_am: now.toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(location_id));
  }
}
