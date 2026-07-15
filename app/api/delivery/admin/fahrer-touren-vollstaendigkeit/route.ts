/**
 * GET /api/delivery/admin/fahrer-touren-vollstaendigkeit?location_id=<uuid>
 *
 * Phase 1757 — Fahrer-Touren-Vollständigkeits-API (Backend)
 * Anteil abgeschlossener vs. abgebrochener Touren je Fahrer heute;
 * Ranking nach Abschlussquote; Trend vs. gestern; Multi-Tenant; Supabase + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerTourenVollstaendigkeit {
  fahrer_id: string;
  fahrer_name: string;
  touren_gesamt: number;
  abgeschlossen: number;
  abgebrochen: number;
  quote_pct: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
}

export interface TourenVollstaendigkeitAntwort {
  fahrer: FahrerTourenVollstaendigkeit[];
  location_id: string;
  datum: string;
  generiert_am: string;
}

function buildMock(locationId: string): TourenVollstaendigkeitAntwort {
  const datum = new Date().toISOString().split('T')[0];
  const fahrer: FahrerTourenVollstaendigkeit[] = [
    { fahrer_id: 'drv-1', fahrer_name: 'Mehmet A.', touren_gesamt: 8, abgeschlossen: 8, abgebrochen: 0, quote_pct: 100,  trend: 'besser',     trend_delta:  5 },
    { fahrer_id: 'drv-2', fahrer_name: 'Julia S.',  touren_gesamt: 7, abgeschlossen: 6, abgebrochen: 1, quote_pct:  85.7, trend: 'gleich',     trend_delta:  0 },
    { fahrer_id: 'drv-3', fahrer_name: 'Kevin R.',  touren_gesamt: 6, abgeschlossen: 4, abgebrochen: 2, quote_pct:  66.7, trend: 'schlechter', trend_delta: -8 },
    { fahrer_id: 'drv-4', fahrer_name: 'Lena T.',   touren_gesamt: 5, abgeschlossen: 5, abgebrochen: 0, quote_pct: 100,  trend: 'besser',     trend_delta:  3 },
  ];
  return { fahrer, location_id: locationId, datum, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? '';

  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];

    const { data: touren } = await supabase
      .from('delivery_batches')
      .select('id, fahrer_id, status, startzeit, employees(vorname, nachname)')
      .gte('startzeit', `${yesterday}T00:00:00`)
      .lte('startzeit', `${today}T23:59:59`)
      .eq('location_id', locationId);

    if (!touren || touren.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    const byDriver: Record<string, { name: string; todayDone: number; todayAborted: number; yesterdayDone: number; yesterdayAborted: number }> = {};

    for (const t of touren) {
      const id = (t.fahrer_id as string) ?? 'unknown';
      const emp = Array.isArray(t.employees) ? t.employees[0] : t.employees;
      const name = emp ? `${(emp as any).vorname} ${(emp as any).nachname[0]}.` : 'Fahrer';
      if (!byDriver[id]) byDriver[id] = { name, todayDone: 0, todayAborted: 0, yesterdayDone: 0, yesterdayAborted: 0 };
      const datum = (t.startzeit as string).split('T')[0];
      const done = (t.status as string) === 'abgeschlossen';
      const aborted = (t.status as string) === 'abgebrochen';
      if (datum === today) {
        if (done) byDriver[id].todayDone++;
        if (aborted) byDriver[id].todayAborted++;
      } else {
        if (done) byDriver[id].yesterdayDone++;
        if (aborted) byDriver[id].yesterdayAborted++;
      }
    }

    const fahrer: FahrerTourenVollstaendigkeit[] = Object.entries(byDriver).map(([fahrer_id, d]) => {
      const touren_gesamt = d.todayDone + d.todayAborted;
      const abgeschlossen = d.todayDone;
      const abgebrochen = d.todayAborted;
      const quote_pct = touren_gesamt > 0 ? Math.round((abgeschlossen / touren_gesamt) * 1000) / 10 : 0;

      const yd_total = d.yesterdayDone + d.yesterdayAborted;
      const yd_pct = yd_total > 0 ? (d.yesterdayDone / yd_total) * 100 : 0;
      const delta = Math.round((quote_pct - yd_pct) * 10) / 10;
      const trend: FahrerTourenVollstaendigkeit['trend'] = delta > 2 ? 'besser' : delta < -2 ? 'schlechter' : 'gleich';

      return { fahrer_id, fahrer_name: d.name, touren_gesamt, abgeschlossen, abgebrochen, quote_pct, trend, trend_delta: delta };
    }).sort((a, b) => b.quote_pct - a.quote_pct);

    return NextResponse.json({ fahrer, location_id: locationId, datum: today, generiert_am: new Date().toISOString() } as TourenVollstaendigkeitAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
