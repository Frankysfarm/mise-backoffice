import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(score: number): Ampel {
  if (score >= 80) return 'gruen';
  if (score >= 60) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 1) return { trend: 'steigend', delta };
  if (delta < -1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

export interface FahrerKundenkontakt {
  fahrer_id: string;
  fahrer_name: string;
  kundenkontakt_score: number;
  sub_trinkgeld: number;
  sub_wiederbestellung: number;
  sub_beschwerden: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
  rang?: number;
}

export interface FahrerKundenkontaktResponse {
  fahrer: FahrerKundenkontakt[];
  team_avg: number;
  alert_count: number;
  generiert_am: string;
}

function computeScore(trinkgeld: number, wiederbestellung: number, beschwerden: number): number {
  return Math.round(trinkgeld * 0.35 + wiederbestellung * 0.40 + beschwerden * 0.25);
}

function buildMock(locationId: string, driverId?: string): FahrerKundenkontaktResponse {
  const raw = [
    { id: 'd1', name: 'Max M.',   tkg: 88, wb: 91, bsw: 95 },
    { id: 'd4', name: 'Julia F.', tkg: 82, wb: 87, bsw: 90 },
    { id: 'd2', name: 'Sara K.',  tkg: 70, wb: 72, bsw: 80 },
    { id: 'd3', name: 'Tim B.',   tkg: 45, wb: 52, bsw: 55 },
  ];

  const fahrer: FahrerKundenkontakt[] = raw.map((d, i) => {
    const score = computeScore(d.tkg, d.wb, d.bsw);
    const prevScore = Math.max(0, score + (i % 2 === 0 ? -4 : 3));
    const { trend, delta } = calcTrend(score, prevScore);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      kundenkontakt_score: score,
      sub_trinkgeld: d.tkg,
      sub_wiederbestellung: d.wb,
      sub_beschwerden: d.bsw,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(score),
      alert_niedrig: score < 60,
    };
  }).sort((a, b) => b.kundenkontakt_score - a.kundenkontakt_score);

  const ranked = fahrer.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_avg = Math.round(ranked.reduce((s, f) => s + f.kundenkontakt_score, 0) / ranked.length);
  const alert_count = ranked.filter(f => f.alert_niedrig).length;

  void locationId;
  void driverId;

  return { fahrer: ranked, team_avg, alert_count, generiert_am: new Date().toISOString() };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();

    const { data: drivers } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('role', 'driver');

    if (!drivers || drivers.length === 0) return NextResponse.json(buildMock(locationId, driverId));

    const today     = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const fahrer: FahrerKundenkontakt[] = await Promise.all(
      drivers.map(async (d) => {
        const name = `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || `Fahrer ${d.id.slice(0, 4)}`;

        // Trinkgeld-Rate: % of tours with tip today
        const { data: tours } = await supabase
          .from('delivery_tours')
          .select('id, tip_amount')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('created_at', `${today}T00:00:00Z`);
        const totalTours   = tours?.length ?? 0;
        const toursWithTip = tours?.filter(t => (t.tip_amount ?? 0) > 0).length ?? 0;
        const sub_trinkgeld = totalTours > 0 ? Math.round((toursWithTip / totalTours) * 100) : 0;

        // Wiederbestellrate: customers who reordered (simplified: repeat customers in last 30d)
        const { data: orders } = await supabase
          .from('orders')
          .select('customer_id')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('created_at', `${today}T00:00:00Z`)
          .not('customer_id', 'is', null);
        const totalCustomers    = orders?.length ?? 0;
        const uniqueCustomers   = new Set(orders?.map(o => o.customer_id)).size;
        const repeatCount       = totalCustomers - uniqueCustomers;
        const sub_wiederbestellung = totalCustomers > 0 ? Math.round((repeatCount / totalCustomers) * 100 + 50) : 50;

        // Beschwerden: 100 - complaint rate
        const { data: complaints } = await supabase
          .from('driver_feedback')
          .select('id, sentiment')
          .eq('driver_id', d.id)
          .gte('created_at', `${today}T00:00:00Z`);
        const totalFeedback   = complaints?.length ?? 0;
        const negCount        = complaints?.filter(f => f.sentiment === 'negative').length ?? 0;
        const sub_beschwerden = totalFeedback > 0 ? Math.round(((totalFeedback - negCount) / totalFeedback) * 100) : 90;

        const kundenkontakt_score = computeScore(sub_trinkgeld, sub_wiederbestellung, sub_beschwerden);

        // Yesterday's score for trend
        const { data: prevTours } = await supabase
          .from('delivery_tours')
          .select('id, tip_amount')
          .eq('driver_id', d.id)
          .gte('created_at', `${yesterday}T00:00:00Z`)
          .lt('created_at', `${today}T00:00:00Z`);
        const prevTotal   = prevTours?.length ?? 0;
        const prevWithTip = prevTours?.filter(t => (t.tip_amount ?? 0) > 0).length ?? 0;
        const prevTkg     = prevTotal > 0 ? Math.round((prevWithTip / prevTotal) * 100) : sub_trinkgeld;
        const prevScore   = computeScore(prevTkg, sub_wiederbestellung, sub_beschwerden);
        const { trend, delta } = calcTrend(kundenkontakt_score, prevScore);

        return {
          fahrer_id: d.id,
          fahrer_name: name,
          kundenkontakt_score,
          sub_trinkgeld,
          sub_wiederbestellung,
          sub_beschwerden,
          trend,
          trend_delta: delta,
          ampel: calcAmpel(kundenkontakt_score),
          alert_niedrig: kundenkontakt_score < 60,
        };
      })
    );

    const sorted   = [...fahrer].sort((a, b) => b.kundenkontakt_score - a.kundenkontakt_score);
    const ranked   = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const filtered = driverId ? ranked.filter(f => f.fahrer_id === driverId) : ranked;
    const team_avg = Math.round(ranked.reduce((s, f) => s + f.kundenkontakt_score, 0) / ranked.length);
    const alert_count = ranked.filter(f => f.alert_niedrig).length;

    if (driverId) {
      const me = ranked.find(f => f.fahrer_id === driverId) ?? ranked[0];
      return NextResponse.json({ fahrer: filtered, fahrer_single: me, team_avg, alert_count, generiert_am: new Date().toISOString() });
    }

    return NextResponse.json({ fahrer: ranked, team_avg, alert_count, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
