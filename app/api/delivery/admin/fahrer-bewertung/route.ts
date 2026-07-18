import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(avg: number): Ampel {
  if (avg >= 4.5) return 'gruen';
  if (avg >= 3.5) return 'gelb';
  return 'rot';
}

export interface FahrerBewertung {
  fahrer_id: string;
  fahrer_name: string;
  avg_sterne: number;
  avg_sterne_vw: number;
  anzahl_bewertungen: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
}

export interface FahrerBewertungResponse {
  fahrer: FahrerBewertung[];
  team_avg_sterne: number;
  team_avg_sterne_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.', avg: 4.8, avg_vw: 4.6, anzahl: 12 },
    { id: 'd2', name: 'Sara K.', avg: 4.2, avg_vw: 4.4, anzahl: 9 },
    { id: 'd3', name: 'Tim B.', avg: 3.1, avg_vw: 3.6, anzahl: 7 },
    { id: 'd4', name: 'Julia F.', avg: 4.6, avg_vw: 4.5, anzahl: 11 },
  ];

  const fahrer: FahrerBewertung[] = drivers.map(d => ({
    fahrer_id: d.id,
    fahrer_name: d.name,
    avg_sterne: d.avg,
    avg_sterne_vw: d.avg_vw,
    anzahl_bewertungen: d.anzahl,
    trend: d.avg > d.avg_vw ? 'steigend' : d.avg < d.avg_vw ? 'fallend' : 'stabil',
    trend_delta: Math.round((d.avg - d.avg_vw) * 10) / 10,
    ampel: calcAmpel(d.avg),
    alert_niedrig: d.avg < 3.5,
  })).sort((a, b) => b.avg_sterne - a.avg_sterne);

  const team_avg_sterne = Math.round((fahrer.reduce((s, f) => s + f.avg_sterne, 0) / fahrer.length) * 10) / 10;
  const team_avg_sterne_vw = Math.round((fahrer.reduce((s, f) => s + f.avg_sterne_vw, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_niedrig).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_sterne };
  }

  return { fahrer, team_avg_sterne, team_avg_sterne_vw, alert_count, generiert_am: new Date().toISOString() };
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

    if (!drivers?.length) return NextResponse.json(buildMock(locationId, driverId));

    async function getBewertungDaten(dId: string, date: string): Promise<{ avg: number; anzahl: number }> {
      const { data } = await supabase
        .from('delivery_tours')
        .select('customer_rating')
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59')
        .not('customer_rating', 'is', null);
      const rows = data ?? [];
      if (!rows.length) return { avg: 0, anzahl: 0 };
      const avg = Math.round((rows.reduce((s, r) => s + (r.customer_rating ?? 0), 0) / rows.length) * 10) / 10;
      return { avg, anzahl: rows.length };
    }

    const results = await Promise.all(
      drivers.map(async d => {
        const [today_daten, vw_daten] = await Promise.all([
          getBewertungDaten(d.id, today),
          getBewertungDaten(d.id, lastWeek),
        ]);
        const avg = today_daten.avg;
        const avg_vw = vw_daten.avg;
        return {
          fahrer_id: d.id,
          fahrer_name: d.name,
          avg_sterne: avg,
          avg_sterne_vw: avg_vw,
          anzahl_bewertungen: today_daten.anzahl,
          trend: avg > avg_vw ? 'steigend' : avg < avg_vw ? 'fallend' : 'stabil',
          trend_delta: Math.round((avg - avg_vw) * 10) / 10,
          ampel: calcAmpel(avg),
          alert_niedrig: avg < 3.5 && today_daten.anzahl > 0,
        } as FahrerBewertung;
      }),
    );

    const fahrer = results.sort((a, b) => b.avg_sterne - a.avg_sterne);
    const withData = fahrer.filter(f => f.anzahl_bewertungen > 0);
    const team_avg_sterne = withData.length
      ? Math.round((withData.reduce((s, f) => s + f.avg_sterne, 0) / withData.length) * 10) / 10
      : 0;
    const team_avg_sterne_vw = withData.length
      ? Math.round((withData.reduce((s, f) => s + f.avg_sterne_vw, 0) / withData.length) * 10) / 10
      : 0;
    const alert_count = fahrer.filter(f => f.alert_niedrig).length;

    if (driverId) {
      const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: f, team_avg_sterne });
    }

    return NextResponse.json({ fahrer, team_avg_sterne, team_avg_sterne_vw, alert_count, generiert_am: new Date().toISOString() });
  } catch (err) {
    console.error('fahrer-bewertung error', err);
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
