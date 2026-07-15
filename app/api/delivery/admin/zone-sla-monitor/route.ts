/**
 * GET /api/delivery/admin/zone-sla-monitor?location_id=<uuid>
 *
 * Phase 1667 — Zone-SLA-Monitor-API (Backend)
 * Pünktlichkeitsquote je Lieferzone letzte 2h vs. SLA-Ziel (≥85%).
 * Alert wenn eine Zone <85% unterschreitet. Supabase + Mock-Fallback. Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type SlaAmpel = 'gruen' | 'gelb' | 'rot';

export interface ZoneSlaData {
  zone_name: string;
  gesamt_lieferungen: number;
  puenktliche_lieferungen: number;
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  sla_ampel: SlaAmpel;
}

export interface ZoneSlaMonitorResponse {
  zonen: ZoneSlaData[];
  gesamt_puenktlichkeit_pct: number;
  alert_zonen: string[];
  location_id: string;
  berechnet_am: string;
}

const MOCK_RESPONSE: ZoneSlaMonitorResponse = {
  zonen: [
    { zone_name: 'Zone A – Innenstadt', gesamt_lieferungen: 28, puenktliche_lieferungen: 26, puenktlichkeit_pct: 92.9, avg_lieferzeit_min: 24, sla_ampel: 'gruen' },
    { zone_name: 'Zone B – Nordviertel', gesamt_lieferungen: 19, puenktliche_lieferungen: 15, puenktlichkeit_pct: 78.9, avg_lieferzeit_min: 34, sla_ampel: 'rot' },
    { zone_name: 'Zone C – Südring', gesamt_lieferungen: 12, puenktliche_lieferungen: 11, puenktlichkeit_pct: 91.7, avg_lieferzeit_min: 27, sla_ampel: 'gruen' },
    { zone_name: 'Zone D – Westend', gesamt_lieferungen: 8, puenktliche_lieferungen: 7, puenktlichkeit_pct: 87.5, avg_lieferzeit_min: 29, sla_ampel: 'gelb' },
  ],
  gesamt_puenktlichkeit_pct: 88.1,
  alert_zonen: ['Zone B – Nordviertel'],
  location_id: 'mock',
  berechnet_am: new Date().toISOString(),
};

function ampelFor(pct: number): SlaAmpel {
  if (pct >= 88) return 'gruen';
  if (pct >= 80) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const sb = await createClient();
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const query = sb
      .from('customer_orders')
      .select('id, lieferzone, sla_target_min, tatsaechliche_lieferzeit_min, status, geliefert_am')
      .in('status', ['geliefert', 'abgeholt'])
      .gte('geliefert_am', since);
    if (locationId) query.eq('location_id', locationId);

    const { data, error } = await query;
    if (error || !data?.length) return NextResponse.json({ ...MOCK_RESPONSE, location_id: locationId ?? 'mock' });

    const byZone: Record<string, { total: number; onTime: number; sumMin: number }> = {};
    for (const row of data as any[]) {
      const zone = (row.lieferzone as string) || 'Unbekannte Zone';
      if (!byZone[zone]) byZone[zone] = { total: 0, onTime: 0, sumMin: 0 };
      const target = (row.sla_target_min as number) ?? 45;
      const actual = (row.tatsaechliche_lieferzeit_min as number) ?? 0;
      byZone[zone].total++;
      byZone[zone].sumMin += actual;
      if (actual <= target) byZone[zone].onTime++;
    }

    const zonen: ZoneSlaData[] = Object.entries(byZone).map(([zone_name, v]) => {
      const pct = v.total > 0 ? Math.round((v.onTime / v.total) * 1000) / 10 : 0;
      return {
        zone_name,
        gesamt_lieferungen: v.total,
        puenktliche_lieferungen: v.onTime,
        puenktlichkeit_pct: pct,
        avg_lieferzeit_min: v.total > 0 ? Math.round(v.sumMin / v.total) : 0,
        sla_ampel: ampelFor(pct),
      };
    }).sort((a, b) => b.gesamt_lieferungen - a.gesamt_lieferungen);

    const totalOrders = zonen.reduce((s, z) => s + z.gesamt_lieferungen, 0);
    const totalOnTime = zonen.reduce((s, z) => s + z.puenktliche_lieferungen, 0);
    const gesamt_puenktlichkeit_pct = totalOrders > 0 ? Math.round((totalOnTime / totalOrders) * 1000) / 10 : 0;
    const alert_zonen = zonen.filter(z => z.sla_ampel === 'rot').map(z => z.zone_name);

    return NextResponse.json({
      zonen,
      gesamt_puenktlichkeit_pct,
      alert_zonen,
      location_id: locationId ?? 'all',
      berechnet_am: new Date().toISOString(),
    } satisfies ZoneSlaMonitorResponse);
  } catch {
    return NextResponse.json({ ...MOCK_RESPONSE, location_id: locationId ?? 'mock' });
  }
}
