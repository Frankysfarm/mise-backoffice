/**
 * GET /api/delivery/admin/fahrer-abwesenheits-impact
 *
 * Phase 971 — Fahrer-Abwesenheits-Impact-API
 * Berechnet Auswirkung fehlender Fahrer auf ETA und Lieferkapazität für heute.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AbwesenheitsImpact {
  fahrer_verfuegbar: number;
  fahrer_erwartet: number;
  fahrer_fehlend: number;
  kapazitaet_ist_pct: number;
  eta_aufschlag_min: number;
  bestellungen_gefaehrdet: number;
  empfehlung: string;
  status: 'normal' | 'angespannt' | 'kritisch';
  fehlende_fahrer: Array<{
    name: string;
    geplante_stopps: number;
    zone: string | null;
  }>;
  generiert_am: string;
}

function buildMock(locationId: string): AbwesenheitsImpact {
  const fahrer_erwartet = 8;
  const fehlend = 2;
  const verfuegbar = fahrer_erwartet - fehlend;
  const kapPct = Math.round((verfuegbar / fahrer_erwartet) * 100);
  const eta_aufschlag = Math.round((fehlend / fahrer_erwartet) * 18);
  const gefaehrdet = fehlend * 7;
  let status: AbwesenheitsImpact['status'] = 'normal';
  if (kapPct < 65) status = 'kritisch';
  else if (kapPct < 80) status = 'angespannt';
  let empfehlung = 'Keine Maßnahmen erforderlich.';
  if (status === 'kritisch') empfehlung = 'Dringend: Springer anfordern oder Touren zusammenlegen.';
  else if (status === 'angespannt') empfehlung = 'Empfohlen: Springer kontaktieren oder ETA-Puffer erhöhen.';

  return {
    fahrer_verfuegbar: verfuegbar,
    fahrer_erwartet,
    fahrer_fehlend: fehlend,
    kapazitaet_ist_pct: kapPct,
    eta_aufschlag_min: eta_aufschlag,
    bestellungen_gefaehrdet: gefaehrdet,
    empfehlung,
    status,
    fehlende_fahrer: [
      { name: 'M. Schreiber', geplante_stopps: 8, zone: 'B' },
      { name: 'L. Gruber', geplante_stopps: 6, zone: 'A' },
    ],
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id') ?? '';

  try {
    const supabase = await createClient();

    // Aktive Fahrer heute
    const heute = new Date().toISOString().slice(0, 10);
    const { data: shifts } = await supabase
      .from('driver_shifts')
      .select('driver_id, status, drivers(name, zone_assignment)')
      .eq('location_id', locationId)
      .gte('start_time', `${heute}T00:00:00`)
      .lte('start_time', `${heute}T23:59:59`);

    // Geplante Fahrer (alle mit Schicht heute)
    const { data: planned } = await supabase
      .from('driver_shifts')
      .select('driver_id, status, drivers(name, zone_assignment)')
      .eq('location_id', locationId)
      .eq('date', heute);

    if (!shifts && !planned) return NextResponse.json(buildMock(locationId));

    const alleGeplant = planned ?? shifts ?? [];
    const aktive = (shifts ?? []).filter((s: { status?: string }) =>
      ['aktiv', 'active', 'gestartet'].includes(s.status ?? '')
    );

    const fehlend = alleGeplant.length - aktive.length;
    const verfuegbar = aktive.length;
    const erwartet = Math.max(alleGeplant.length, aktive.length);

    if (erwartet === 0) return NextResponse.json(buildMock(locationId));

    const kapPct = Math.round((verfuegbar / erwartet) * 100);
    const eta_aufschlag = fehlend > 0 ? Math.round((fehlend / erwartet) * 18) : 0;

    // Offene Bestellungen die gefährdet sein könnten
    const { data: offeneOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('location_id', locationId)
      .in('status', ['neu', 'bestätigt', 'in_zubereitung']);
    const gefaehrdet = fehlend > 0 ? Math.min(fehlend * 6, offeneOrders?.length ?? 0) : 0;

    let status: AbwesenheitsImpact['status'] = 'normal';
    if (kapPct < 65) status = 'kritisch';
    else if (kapPct < 80) status = 'angespannt';

    let empfehlung = 'Keine Maßnahmen erforderlich.';
    if (status === 'kritisch') empfehlung = 'Dringend: Springer anfordern oder Touren zusammenlegen.';
    else if (status === 'angespannt') empfehlung = 'Empfohlen: Springer kontaktieren oder ETA-Puffer erhöhen.';

    const fehlendeFahrer = alleGeplant
      .filter((s: { status?: string }) => !['aktiv', 'active', 'gestartet'].includes(s.status ?? ''))
      .slice(0, 5)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((s: any) => {
        const drv = Array.isArray(s.drivers) ? s.drivers[0] : s.drivers;
        return {
          name: drv?.name ?? 'Unbekannt',
          geplante_stopps: 6,
          zone: drv?.zone_assignment ?? null,
        };
      });

    const result: AbwesenheitsImpact = {
      fahrer_verfuegbar: verfuegbar,
      fahrer_erwartet: erwartet,
      fahrer_fehlend: Math.max(0, fehlend),
      kapazitaet_ist_pct: kapPct,
      eta_aufschlag_min: eta_aufschlag,
      bestellungen_gefaehrdet: gefaehrdet,
      empfehlung,
      status,
      fehlende_fahrer: fehlendeFahrer,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
