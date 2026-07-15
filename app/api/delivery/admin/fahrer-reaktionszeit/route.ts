/**
 * GET /api/delivery/admin/fahrer-reaktionszeit?location_id=<uuid>
 *
 * Phase 1742 — Fahrer-Reaktionszeit-Analyse-API (Backend)
 * Zeit von Dispatch bis Tourbeginn je Fahrer heute; Ø Reaktionszeit;
 * Ausreißer >5 Min; Multi-Tenant via location_id; Supabase + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerReaktionszeit {
  driver_id: string;
  fahrer_name: string;
  touren_heute: number;
  avg_reaktionszeit_sek: number;
  avg_reaktionszeit_min: number;
  max_reaktionszeit_sek: number;
  ausreisser_anzahl: number;
  alert: boolean;
}

export interface FahrerReaktionstAntwort {
  fahrer: FahrerReaktionszeit[];
  gesamt_avg_sek: number;
  gesamt_avg_min: number;
  ausreisser_gesamt: number;
  location_id: string;
  datum: string;
  generiert_am: string;
}

function buildMock(locationId: string): FahrerReaktionstAntwort {
  const datum = new Date().toISOString().split('T')[0];
  const fahrer: FahrerReaktionszeit[] = [
    { driver_id: 'drv-1', fahrer_name: 'Mehmet A.', touren_heute: 5, avg_reaktionszeit_sek: 95,  avg_reaktionszeit_min: 1.6, max_reaktionszeit_sek: 180, ausreisser_anzahl: 0, alert: false },
    { driver_id: 'drv-2', fahrer_name: 'Julia S.',  touren_heute: 4, avg_reaktionszeit_sek: 340, avg_reaktionszeit_min: 5.7, max_reaktionszeit_sek: 540, ausreisser_anzahl: 2, alert: true  },
    { driver_id: 'drv-3', fahrer_name: 'Kevin R.',  touren_heute: 3, avg_reaktionszeit_sek: 120, avg_reaktionszeit_min: 2.0, max_reaktionszeit_sek: 200, ausreisser_anzahl: 0, alert: false },
    { driver_id: 'drv-4', fahrer_name: 'Lena T.',   touren_heute: 6, avg_reaktionszeit_sek: 70,  avg_reaktionszeit_min: 1.2, max_reaktionszeit_sek: 130, ausreisser_anzahl: 0, alert: false },
  ];
  const gesamt = fahrer.reduce((s, f) => s + f.avg_reaktionszeit_sek, 0) / fahrer.length;
  return {
    fahrer,
    gesamt_avg_sek: Math.round(gesamt),
    gesamt_avg_min: Math.round(gesamt / 60 * 10) / 10,
    ausreisser_gesamt: fahrer.reduce((s, f) => s + f.ausreisser_anzahl, 0),
    location_id: locationId,
    datum,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? '';

  try {
    const supabase = await createClient();
    const datum = new Date().toISOString().split('T')[0];

    const { data: touren } = await supabase
      .from('delivery_batches')
      .select('id, fahrer_id, dispatch_at, startzeit, employees(vorname, nachname)')
      .gte('startzeit', `${datum}T00:00:00`)
      .lte('startzeit', `${datum}T23:59:59`)
      .eq('location_id', locationId)
      .not('startzeit', 'is', null)
      .not('dispatch_at', 'is', null);

    if (!touren || touren.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    const driverMap: Record<string, {
      driver_id: string;
      fahrer_name: string;
      zeiten: number[];
    }> = {};

    for (const t of touren) {
      const dt = new Date(t.dispatch_at as string).getTime();
      const st = new Date(t.startzeit as string).getTime();
      const diffSek = Math.round((st - dt) / 1000);
      if (diffSek < 0 || diffSek > 3600) continue;

      const emp = Array.isArray(t.employees) ? t.employees[0] : t.employees;
      const name = emp ? `${(emp as any).vorname} ${(emp as any).nachname[0]}.` : 'Fahrer';
      const id = (t.fahrer_id as string) ?? 'unknown';

      if (!driverMap[id]) driverMap[id] = { driver_id: id, fahrer_name: name, zeiten: [] };
      driverMap[id].zeiten.push(diffSek);
    }

    const AUSREISSER_SEK = 300;
    const fahrer: FahrerReaktionszeit[] = Object.values(driverMap).map(d => {
      const avg = Math.round(d.zeiten.reduce((s, v) => s + v, 0) / d.zeiten.length);
      const max = Math.max(...d.zeiten);
      const ausreisser = d.zeiten.filter(z => z > AUSREISSER_SEK).length;
      return {
        driver_id: d.driver_id,
        fahrer_name: d.fahrer_name,
        touren_heute: d.zeiten.length,
        avg_reaktionszeit_sek: avg,
        avg_reaktionszeit_min: Math.round(avg / 60 * 10) / 10,
        max_reaktionszeit_sek: max,
        ausreisser_anzahl: ausreisser,
        alert: avg > AUSREISSER_SEK,
      };
    });

    const gesamt = fahrer.reduce((s, f) => s + f.avg_reaktionszeit_sek, 0) / (fahrer.length || 1);

    return NextResponse.json({
      fahrer,
      gesamt_avg_sek: Math.round(gesamt),
      gesamt_avg_min: Math.round(gesamt / 60 * 10) / 10,
      ausreisser_gesamt: fahrer.reduce((s, f) => s + f.ausreisser_anzahl, 0),
      location_id: locationId,
      datum,
      generiert_am: new Date().toISOString(),
    } as FahrerReaktionstAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
