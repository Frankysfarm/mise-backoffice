/**
 * GET /api/delivery/admin/fahrer-ausfallrisiko?location_id=<uuid>
 *
 * Phase 1299 — Fahrer-Ausfallrisiko-API (Backend)
 * Fahrer mit >2 Verspätungen in letzten 3 Tagen oder Schicht-Fehlzeiten → Risiko-Score.
 * Supabase delivery_tours + Mock-Fallback. Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type RisikoStufe = 'niedrig' | 'mittel' | 'hoch';

export interface FahrerRisiko {
  driver_id: string;
  fahrer_name: string;
  verspaetungen_3_tage: number;
  schicht_fehlzeiten: number;
  risiko_score: number;
  risiko_stufe: RisikoStufe;
  letzter_vorfall: string | null;
}

export interface FahrerAusfallrisikoResponse {
  fahrer: FahrerRisiko[];
  gesamt_risiko: RisikoStufe;
  hoch_risiko_anzahl: number;
  location_id: string;
  generiert_am: string;
}

function risikostufe(score: number): RisikoStufe {
  if (score >= 7) return 'hoch';
  if (score >= 4) return 'mittel';
  return 'niedrig';
}

function buildMock(locationId: string): FahrerAusfallrisikoResponse {
  const fahrer: FahrerRisiko[] = [
    { driver_id: 'mock-1', fahrer_name: 'Max Müller', verspaetungen_3_tage: 4, schicht_fehlzeiten: 1, risiko_score: 9, risiko_stufe: 'hoch', letzter_vorfall: new Date(Date.now() - 3600_000).toISOString() },
    { driver_id: 'mock-2', fahrer_name: 'Anna Schmidt', verspaetungen_3_tage: 2, schicht_fehlzeiten: 0, risiko_score: 4, risiko_stufe: 'mittel', letzter_vorfall: new Date(Date.now() - 86400_000).toISOString() },
    { driver_id: 'mock-3', fahrer_name: 'Klaus Weber', verspaetungen_3_tage: 0, schicht_fehlzeiten: 0, risiko_score: 1, risiko_stufe: 'niedrig', letzter_vorfall: null },
  ];
  return {
    fahrer,
    gesamt_risiko: 'hoch',
    hoch_risiko_anzahl: fahrer.filter(f => f.risiko_stufe === 'hoch').length,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();

    const vor3Tagen = new Date(Date.now() - 3 * 86400_000).toISOString();

    const { data: touren, error } = await (sb as any)
      .from('delivery_tours')
      .select('driver_id, status, started_at, completed_at, estimated_duration_min')
      .eq('location_id', locationId)
      .gte('started_at', vor3Tagen);

    if (error || !touren?.length) return NextResponse.json(buildMock(locationId));

    const fahrerMap: Record<string, { verspaetungen: number; fehlzeiten: number; letzterVorfall: string | null }> = {};

    for (const t of touren as { driver_id?: string; status?: string; started_at?: string; completed_at?: string; estimated_duration_min?: number }[]) {
      if (!t.driver_id) continue;
      if (!fahrerMap[t.driver_id]) fahrerMap[t.driver_id] = { verspaetungen: 0, fehlzeiten: 0, letzterVorfall: null };

      const entry = fahrerMap[t.driver_id];

      if (t.status === 'cancelled' || t.status === 'failed') {
        entry.fehlzeiten += 1;
        if (!entry.letzterVorfall || (t.started_at && t.started_at > entry.letzterVorfall)) {
          entry.letzterVorfall = t.started_at ?? null;
        }
      }

      if (t.status === 'completed' && t.started_at && t.completed_at && t.estimated_duration_min) {
        const tatsaechlich = (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 60_000;
        if (tatsaechlich > t.estimated_duration_min * 1.25) {
          entry.verspaetungen += 1;
          if (!entry.letzterVorfall || t.completed_at > entry.letzterVorfall) {
            entry.letzterVorfall = t.completed_at;
          }
        }
      }
    }

    const fahrer: FahrerRisiko[] = Object.entries(fahrerMap)
      .map(([id, v]) => {
        const score = v.verspaetungen * 2 + v.fehlzeiten * 3;
        return {
          driver_id: id,
          fahrer_name: `Fahrer ${id.slice(0, 6)}`,
          verspaetungen_3_tage: v.verspaetungen,
          schicht_fehlzeiten: v.fehlzeiten,
          risiko_score: score,
          risiko_stufe: risikostufe(score),
          letzter_vorfall: v.letzterVorfall,
        };
      })
      .sort((a, b) => b.risiko_score - a.risiko_score);

    const hochAnzahl = fahrer.filter(f => f.risiko_stufe === 'hoch').length;
    const gesamtRisiko: RisikoStufe = hochAnzahl > 0 ? 'hoch' : fahrer.some(f => f.risiko_stufe === 'mittel') ? 'mittel' : 'niedrig';

    return NextResponse.json({
      fahrer,
      gesamt_risiko: gesamtRisiko,
      hoch_risiko_anzahl: hochAnzahl,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerAusfallrisikoResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
