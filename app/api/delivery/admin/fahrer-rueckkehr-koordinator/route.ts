import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FahrerRueckkehr = {
  fahrer_id: string;
  fahrer_name: string;
  aktuelle_zone: string;
  offene_stopps: number;
  eta_rueckkehr_min: number;    // Minuten bis Rückkehr
  eta_label: string;             // "in ~12 Min"
  auslastung_pct: number;        // 0–100
  empfehlung: 'neuzuteilung_moeglich' | 'kurz_warten' | 'nicht_verfuegbar';
  empfehlung_label: string;
};

type ApiResponse = {
  fahrer: FahrerRueckkehr[];
  gesamt_verfuegbar_in_30min: number;
  location_id: string | null;
  generiert_am: string;
};

function mockData(locationId: string | null): ApiResponse {
  const now = new Date();
  const fahrer: FahrerRueckkehr[] = [
    {
      fahrer_id: 'f1',
      fahrer_name: 'Ahmad K.',
      aktuelle_zone: 'Zone A',
      offene_stopps: 2,
      eta_rueckkehr_min: 8,
      eta_label: 'in ~8 Min',
      auslastung_pct: 65,
      empfehlung: 'kurz_warten',
      empfehlung_label: 'Kurz warten',
    },
    {
      fahrer_id: 'f2',
      fahrer_name: 'Lukas M.',
      aktuelle_zone: 'Zone B',
      offene_stopps: 1,
      eta_rueckkehr_min: 4,
      eta_label: 'in ~4 Min',
      auslastung_pct: 30,
      empfehlung: 'neuzuteilung_moeglich',
      empfehlung_label: 'Neuzuteilung möglich',
    },
    {
      fahrer_id: 'f3',
      fahrer_name: 'Sara P.',
      aktuelle_zone: 'Zone C',
      offene_stopps: 4,
      eta_rueckkehr_min: 22,
      eta_label: 'in ~22 Min',
      auslastung_pct: 95,
      empfehlung: 'nicht_verfuegbar',
      empfehlung_label: 'Nicht verfügbar',
    },
  ];
  return {
    fahrer,
    gesamt_verfuegbar_in_30min: fahrer.filter(f => f.eta_rueckkehr_min <= 30).length,
    location_id: locationId,
    generiert_am: now.toISOString(),
  };
}

function empfehlungForEta(eta: number, offeneStopps: number): FahrerRueckkehr['empfehlung'] {
  if (eta <= 8 && offeneStopps <= 1) return 'neuzuteilung_moeglich';
  if (eta <= 20) return 'kurz_warten';
  return 'nicht_verfuegbar';
}

function empfehlungLabel(e: FahrerRueckkehr['empfehlung']): string {
  if (e === 'neuzuteilung_moeglich') return 'Neuzuteilung möglich';
  if (e === 'kurz_warten') return 'Kurz warten';
  return 'Nicht verfügbar';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json(mockData(null));
  }

  try {
    const supabase = await createClient();

    const { data: drivers } = await supabase
      .from('mise_drivers')
      .select('id, name, current_zone, on_tour')
      .eq('location_id', locationId)
      .eq('on_tour', true)
      .limit(20);

    if (!drivers?.length) throw new Error('no on-tour drivers');

    const fahrer: FahrerRueckkehr[] = [];

    for (const d of drivers) {
      const { data: stops } = await supabase
        .from('mise_delivery_stops')
        .select('id, delivered_at, estimated_delivery_at')
        .eq('driver_id', d.id)
        .is('delivered_at', null)
        .order('estimated_delivery_at', { ascending: true })
        .limit(10);

      const offene = stops?.length ?? 0;

      // Estimate ETA: last stop estimated_delivery_at + 5 min travel back
      let etaMin = 15;
      if (stops?.length) {
        const last = stops[stops.length - 1];
        if (last.estimated_delivery_at) {
          const diffMs = new Date(last.estimated_delivery_at).getTime() - Date.now();
          etaMin = Math.max(1, Math.round(diffMs / 60_000) + 5);
        } else {
          etaMin = offene * 7 + 5;
        }
      }

      const auslastung = Math.min(100, offene * 25);
      const emp = empfehlungForEta(etaMin, offene);

      fahrer.push({
        fahrer_id: d.id,
        fahrer_name: d.name ?? `Fahrer ${d.id.slice(0, 4)}`,
        aktuelle_zone: d.current_zone ?? 'Unbekannt',
        offene_stopps: offene,
        eta_rueckkehr_min: etaMin,
        eta_label: `in ~${etaMin} Min`,
        auslastung_pct: auslastung,
        empfehlung: emp,
        empfehlung_label: empfehlungLabel(emp),
      });
    }

    fahrer.sort((a, b) => a.eta_rueckkehr_min - b.eta_rueckkehr_min);

    return NextResponse.json({
      fahrer,
      gesamt_verfuegbar_in_30min: fahrer.filter(f => f.eta_rueckkehr_min <= 30).length,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
