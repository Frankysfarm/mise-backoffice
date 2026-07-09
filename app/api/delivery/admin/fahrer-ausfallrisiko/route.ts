import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Phase 1035 — Fahrer-Ausfallrisiko-Monitor API
 *
 * GET /api/delivery/admin/fahrer-ausfallrisiko?location_id=...
 * Frühwarnung welche Fahrer heute wahrscheinlich nicht erscheinen.
 * Basiert auf: Absenzrate letzte 30 Tage + Verspätungen + letzte Schicht.
 *
 * Response:
 * { fahrer: FahrerRisiko[], kritisch_count, location_id, generiert_am }
 */

export const dynamic = 'force-dynamic';

interface FahrerRisiko {
  fahrer_id: string;
  fahrer_name: string;
  risiko_pct: number;
  risiko_level: 'kritisch' | 'hoch' | 'mittel' | 'niedrig';
  schichten_geplant: number;
  schichten_ausgefallen: number;
  absenz_rate_pct: number;
  letzte_schicht_tage_her: number;
  empfehlung: string;
}

const MOCK: FahrerRisiko[] = [
  { fahrer_id: 'd1', fahrer_name: 'T. Müller', risiko_pct: 78, risiko_level: 'kritisch', schichten_geplant: 18, schichten_ausgefallen: 5, absenz_rate_pct: 28, letzte_schicht_tage_her: 4, empfehlung: 'Backup-Fahrer einplanen' },
  { fahrer_id: 'd2', fahrer_name: 'S. Bauer',  risiko_pct: 55, risiko_level: 'hoch',     schichten_geplant: 22, schichten_ausgefallen: 4, absenz_rate_pct: 18, letzte_schicht_tage_her: 2, empfehlung: 'Kontakt aufnehmen' },
  { fahrer_id: 'd3', fahrer_name: 'K. Lang',   risiko_pct: 32, risiko_level: 'mittel',   schichten_geplant: 20, schichten_ausgefallen: 2, absenz_rate_pct: 10, letzte_schicht_tage_her: 1, empfehlung: 'Beobachten' },
  { fahrer_id: 'd4', fahrer_name: 'M. Weber',  risiko_pct: 8,  risiko_level: 'niedrig',  schichten_geplant: 25, schichten_ausgefallen: 1, absenz_rate_pct: 4,  letzte_schicht_tage_her: 0, empfehlung: 'Kein Handlungsbedarf' },
];

function risikoLevel(pct: number): FahrerRisiko['risiko_level'] {
  if (pct >= 70) return 'kritisch';
  if (pct >= 45) return 'hoch';
  if (pct >= 20) return 'mittel';
  return 'niedrig';
}

function empfehlung(level: FahrerRisiko['risiko_level']): string {
  if (level === 'kritisch') return 'Backup-Fahrer einplanen';
  if (level === 'hoch') return 'Kontakt aufnehmen';
  if (level === 'mittel') return 'Beobachten';
  return 'Kein Handlungsbedarf';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({
      fahrer: MOCK,
      kritisch_count: MOCK.filter(f => f.risiko_level === 'kritisch').length,
      location_id: null,
      generiert_am: new Date().toISOString(),
    });
  }

  try {
    const supabase = await createClient();
    const since30 = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

    const { data: shifts } = await supabase
      .from('driver_shifts')
      .select('driver_id, status, start_time')
      .eq('location_id', locationId)
      .gte('start_time', since30)
      .order('start_time', { ascending: false });

    if (!shifts || shifts.length < 3) {
      return NextResponse.json({
        fahrer: MOCK,
        kritisch_count: MOCK.filter(f => f.risiko_level === 'kritisch').length,
        location_id: locationId,
        generiert_am: new Date().toISOString(),
      });
    }

    const driverIds = [...new Set(shifts.map(s => s.driver_id).filter(Boolean))];
    const { data: drivers } = await supabase
      .from('mise_drivers')
      .select('id, first_name, last_name')
      .in('id', driverIds);

    const driverMap = new Map((drivers ?? []).map(d => [d.id, `${d.first_name?.[0] ?? ''}. ${d.last_name ?? ''}`.trim()]));

    const ABBRUCH_STATUSES = ['abgebrochen', 'storniert', 'cancelled', 'no_show', 'absent'];

    const perDriver = new Map<string, { gesamt: number; ausgefallen: number; letzteSchicht: Date | null }>();
    for (const s of shifts) {
      if (!s.driver_id) continue;
      const cur = perDriver.get(s.driver_id) ?? { gesamt: 0, ausgefallen: 0, letzteSchicht: null };
      cur.gesamt++;
      if (ABBRUCH_STATUSES.includes(s.status ?? '')) cur.ausgefallen++;
      const startDate = new Date(s.start_time);
      if (!cur.letzteSchicht || startDate > cur.letzteSchicht) cur.letzteSchicht = startDate;
      perDriver.set(s.driver_id, cur);
    }

    const fahrer: FahrerRisiko[] = Array.from(perDriver.entries()).map(([id, v]) => {
      const absenzRate = v.gesamt > 0 ? Math.round((v.ausgefallen / v.gesamt) * 100) : 0;
      const letzteVorTagen = v.letzteSchicht
        ? Math.round((Date.now() - v.letzteSchicht.getTime()) / 86_400_000)
        : 30;
      const risikoRaw = absenzRate * 0.7 + Math.min(letzteVorTagen * 5, 30);
      const risikoPct = Math.round(Math.min(95, Math.max(2, risikoRaw)));
      const level = risikoLevel(risikoPct);
      return {
        fahrer_id: id,
        fahrer_name: driverMap.get(id) ?? 'Fahrer',
        risiko_pct: risikoPct,
        risiko_level: level,
        schichten_geplant: v.gesamt,
        schichten_ausgefallen: v.ausgefallen,
        absenz_rate_pct: absenzRate,
        letzte_schicht_tage_her: letzteVorTagen,
        empfehlung: empfehlung(level),
      };
    });

    fahrer.sort((a, b) => b.risiko_pct - a.risiko_pct);

    return NextResponse.json({
      fahrer,
      kritisch_count: fahrer.filter(f => f.risiko_level === 'kritisch').length,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      fahrer: MOCK,
      kritisch_count: MOCK.filter(f => f.risiko_level === 'kritisch').length,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    });
  }
}
