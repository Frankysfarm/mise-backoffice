// Phase 2492 — Fahrer-Pausen-Compliance
// GET /api/delivery/admin/fahrer-pausen-compliance?location_id=<uuid>[&driver_id=<uuid>]
// Compliance = Pausen genommen / Pflichtpausen je Schicht (%)
// Ampel: grün ≥100%, gelb 80–99%, rot <80%. Alert <80%. Trend vs. VW.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALERT_THRESHOLD = 80;

function ampel(pct: number): 'gruen' | 'gelb' | 'rot' {
  if (pct >= 100) return 'gruen';
  if (pct >= ALERT_THRESHOLD) return 'gelb';
  return 'rot';
}

function mockData(locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   pct: 100, pct_vw: 100, genommen: 2, pflicht: 2 },
    { id: 'd2', name: 'Sara K.',  pct: 75,  pct_vw: 90,  genommen: 3, pflicht: 4 },
    { id: 'd3', name: 'Tim B.',   pct: 85,  pct_vw: 80,  genommen: 1, pflicht: 2 },
    { id: 'd4', name: 'Julia F.', pct: 100, pct_vw: 100, genommen: 2, pflicht: 2 },
  ];

  const fahrer = drivers
    .map((d, i) => ({
      fahrer_id: d.id,
      fahrer_name: d.name,
      compliance_heute: d.pct,
      compliance_vw: d.pct_vw,
      pausen_genommen: d.genommen,
      pausen_pflicht: d.pflicht,
      trend: d.pct > d.pct_vw ? 'steigend' : d.pct < d.pct_vw ? 'fallend' : 'stabil',
      trend_delta: d.pct - d.pct_vw,
      ampel: ampel(d.pct),
      alert: d.pct < ALERT_THRESHOLD,
      rang: i + 1,
    }))
    .sort((a, b) => a.compliance_heute - b.compliance_heute)
    .map((d, i) => ({ ...d, rang: i + 1 }));

  const team_avg = fahrer.reduce((s, f) => s + f.compliance_heute, 0) / (fahrer.length || 1);
  const team_avg_vw = fahrer.reduce((s, f) => s + f.compliance_vw, 0) / (fahrer.length || 1);
  const alert_count = fahrer.filter(f => f.alert).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_compliance: Math.round(team_avg * 10) / 10 };
  }

  return {
    fahrer,
    team_avg_compliance: Math.round(team_avg * 10) / 10,
    team_avg_compliance_vw: Math.round(team_avg_vw * 10) / 10,
    alert_count,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const lastWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (!drivers?.length) return NextResponse.json(mockData(locationId, driverId));

    async function getBreaks(dId: string, date: string) {
      const { data: tours } = await supabase
        .from('delivery_tours')
        .select('break_count, required_breaks')
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59');

      if (!tours?.length) return { genommen: 0, pflicht: 0 };
      const genommen = tours.reduce((s: number, t: { break_count?: number }) => s + (t.break_count ?? 0), 0);
      const pflicht = tours.reduce((s: number, t: { required_breaks?: number }) => s + (t.required_breaks ?? 1), 0);
      return { genommen, pflicht };
    }

    const fahrerData = await Promise.all(
      drivers.map(async (d) => {
        const [heute, vw] = await Promise.all([
          getBreaks(d.id, today),
          getBreaks(d.id, lastWeek),
        ]);
        const compliance_heute = heute.pflicht > 0
          ? Math.min(120, Math.round((heute.genommen / heute.pflicht) * 100))
          : 100;
        const compliance_vw = vw.pflicht > 0
          ? Math.min(120, Math.round((vw.genommen / vw.pflicht) * 100))
          : 100;
        return {
          fahrer_id: d.id,
          fahrer_name: d.name ?? 'Fahrer',
          compliance_heute,
          compliance_vw,
          pausen_genommen: heute.genommen,
          pausen_pflicht: heute.pflicht,
          trend: compliance_heute > compliance_vw ? 'steigend' : compliance_heute < compliance_vw ? 'fallend' : 'stabil',
          trend_delta: compliance_heute - compliance_vw,
          ampel: ampel(compliance_heute),
          alert: compliance_heute < ALERT_THRESHOLD,
        };
      })
    );

    const sorted = fahrerData
      .sort((a, b) => a.compliance_heute - b.compliance_heute)
      .map((d, i) => ({ ...d, rang: i + 1 }));

    const team_avg = sorted.reduce((s, f) => s + f.compliance_heute, 0) / (sorted.length || 1);
    const team_avg_vw = sorted.reduce((s, f) => s + f.compliance_vw, 0) / (sorted.length || 1);
    const alert_count = sorted.filter(f => f.alert).length;

    if (driverId) {
      const f = sorted.find(d => d.fahrer_id === driverId) ?? sorted[0];
      return NextResponse.json({ fahrer_single: f, team_avg_compliance: Math.round(team_avg * 10) / 10 });
    }

    return NextResponse.json({
      fahrer: sorted,
      team_avg_compliance: Math.round(team_avg * 10) / 10,
      team_avg_compliance_vw: Math.round(team_avg_vw * 10) / 10,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData(locationId, driverId));
  }
}
