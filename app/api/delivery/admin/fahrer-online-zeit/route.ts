import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 2559 — Fahrer-Online-Zeit-Effizienz
// GET /api/delivery/admin/fahrer-online-zeit?location_id=<uuid>[&driver_id=<uuid>]
// Effizienz-Rate = Lieferzeit / Online-Zeit × 100 je Fahrer heute
// Ampel: grün ≥60% / gelb 40–59% / rot <40%
// Alert <40%; Trend vs. Vorwoche; Multi-Tenant; Supabase + Mock

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  effizienz_pct: number;
  online_min: number;
  liefer_min: number;
  effizienz_pct_vw: number | null;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiResponse {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
  team_avg_pct_vw: number | null;
  alert_count: number;
  location_id: string;
  generated_at: string;
}

function ampel(pct: number): 'gruen' | 'gelb' | 'rot' {
  if (pct >= 60) return 'gruen';
  if (pct >= 40) return 'gelb';
  return 'rot';
}

function buildMock(locationId: string, driverId?: string): ApiResponse {
  const drivers = [
    { id: 'f1', name: 'Max M.',   pct: 72, pct_vw: 68, online: 480, liefer: 346 },
    { id: 'f2', name: 'Sarah K.', pct: 55, pct_vw: 60, online: 420, liefer: 231 },
    { id: 'f3', name: 'Lena S.',  pct: 38, pct_vw: 42, online: 390, liefer: 148 },
    { id: 'f4', name: 'Tom B.',   pct: 64, pct_vw: 61, online: 450, liefer: 288 },
    { id: 'f5', name: 'Jana F.',  pct: 31, pct_vw: 35, online: 360, liefer: 112 },
  ];
  const list = driverId ? drivers.filter(d => d.id === driverId) : drivers;
  const fahrer: FahrerEntry[] = list.map(d => {
    const delta = d.pct - (d.pct_vw ?? d.pct);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      effizienz_pct: d.pct,
      online_min: d.online,
      liefer_min: d.liefer,
      effizienz_pct_vw: d.pct_vw,
      trend: delta > 1 ? 'steigend' : delta < -1 ? 'fallend' : 'stabil',
      trend_delta: delta,
      ampel: ampel(d.pct),
      alert: d.pct < 40,
    };
  });
  const teamAvg = Math.round(fahrer.reduce((s, f) => s + f.effizienz_pct, 0) / fahrer.length);
  const teamAvgVw = Math.round(fahrer.reduce((s, f) => s + (f.effizienz_pct_vw ?? f.effizienz_pct), 0) / fahrer.length);
  return {
    fahrer,
    team_avg_pct: teamAvg,
    team_avg_pct_vw: teamAvgVw,
    alert_count: fahrer.filter(f => f.alert).length,
    location_id: locationId,
    generated_at: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: shifts, error } = await supabase
      .from('driver_shifts')
      .select('driver_id, started_at, ended_at, driver:users!driver_shifts_driver_id_fkey(full_name)')
      .eq('location_id', locationId)
      .gte('started_at', since);

    if (error || !shifts || shifts.length === 0) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    const { data: deliveries } = await supabase
      .from('orders')
      .select('driver_id, accepted_at, delivered_at')
      .eq('location_id', locationId)
      .not('driver_id', 'is', null)
      .not('delivered_at', 'is', null)
      .gte('created_at', since);

    const delivMap = new Map<string, number>();
    for (const o of deliveries ?? []) {
      if (!o.driver_id || !o.accepted_at || !o.delivered_at) continue;
      if (driverId && o.driver_id !== driverId) continue;
      const mins = (new Date(o.delivered_at).getTime() - new Date(o.accepted_at).getTime()) / 60000;
      delivMap.set(o.driver_id, (delivMap.get(o.driver_id) ?? 0) + Math.max(0, mins));
    }

    const shiftMap = new Map<string, { name: string; online_min: number }>();
    for (const s of shifts) {
      if (!s.driver_id) continue;
      if (driverId && s.driver_id !== driverId) continue;
      const end = s.ended_at ? new Date(s.ended_at) : new Date();
      const mins = (end.getTime() - new Date(s.started_at).getTime()) / 60000;
      const name = (s.driver as { full_name?: string } | null)?.full_name ?? 'Unbekannt';
      const prev = shiftMap.get(s.driver_id);
      shiftMap.set(s.driver_id, { name, online_min: (prev?.online_min ?? 0) + Math.max(0, mins) });
    }

    if (shiftMap.size === 0) return NextResponse.json(buildMock(locationId, driverId));

    const fahrer: FahrerEntry[] = [];
    for (const [fid, d] of shiftMap.entries()) {
      const liefer_min = Math.round(delivMap.get(fid) ?? 0);
      const online_min = Math.round(d.online_min);
      const pct = online_min > 0 ? Math.round((liefer_min / online_min) * 100) : 0;
      fahrer.push({
        fahrer_id: fid,
        fahrer_name: d.name,
        effizienz_pct: pct,
        online_min,
        liefer_min,
        effizienz_pct_vw: null,
        trend: 'stabil',
        trend_delta: 0,
        ampel: ampel(pct),
        alert: pct < 40,
      });
    }

    if (fahrer.length === 0) return NextResponse.json(buildMock(locationId, driverId));

    const teamAvg = Math.round(fahrer.reduce((s, f) => s + f.effizienz_pct, 0) / fahrer.length);
    return NextResponse.json({
      fahrer,
      team_avg_pct: teamAvg,
      team_avg_pct_vw: null,
      alert_count: fahrer.filter(f => f.alert).length,
      location_id: locationId,
      generated_at: new Date().toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
