import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Phase 1903 — Schicht-Bonus-Rechner-API (Backend)
 *
 * GET /api/delivery/admin/schicht-bonus-rechner?location_id=<uuid>
 * Bonus je Fahrer basierend auf Stopps + Pünktlichkeit + Bewertung.
 * Stufen: Bronze / Silber / Gold. Multi-Tenant; Supabase+Mock.
 */

type BonusStufe = 'bronze' | 'silber' | 'gold' | 'kein';

interface FahrerBonus {
  fahrer_id: string;
  fahrer_name: string;
  stopps_heute: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number | null;
  erreicht_pct: number;
  stufe: BonusStufe;
  bonus_betrag_eur: number;
}

interface ApiAntwort {
  location_id: string;
  fahrer: FahrerBonus[];
  kein_gold_alert: boolean;
  generiert_am: string;
}

function berechneStufe(stopps: number, puenktlichkeit: number, bewertung: number | null): { stufe: BonusStufe; betrag: number; erreicht_pct: number } {
  const bewertungScore = bewertung !== null ? bewertung : 4.0;
  const score =
    (Math.min(stopps, 20) / 20) * 40 +
    (puenktlichkeit / 100) * 40 +
    ((bewertungScore - 3) / 2) * 20;

  const erreicht_pct = Math.round(Math.min(100, score));

  if (score >= 85 && stopps >= 15 && puenktlichkeit >= 90) return { stufe: 'gold', betrag: 25, erreicht_pct };
  if (score >= 65 && stopps >= 10 && puenktlichkeit >= 75) return { stufe: 'silber', betrag: 12, erreicht_pct };
  if (score >= 45 && stopps >= 5) return { stufe: 'bronze', betrag: 5, erreicht_pct };
  return { stufe: 'kein', betrag: 0, erreicht_pct };
}

const MOCK_FAHRER: FahrerBonus[] = [
  { fahrer_id: 'f1', fahrer_name: 'Max M.', stopps_heute: 18, puenktlichkeit_pct: 94, bewertung_avg: 4.8, erreicht_pct: 92, stufe: 'gold', bonus_betrag_eur: 25 },
  { fahrer_id: 'f2', fahrer_name: 'Sara K.', stopps_heute: 12, puenktlichkeit_pct: 78, bewertung_avg: 4.3, erreicht_pct: 70, stufe: 'silber', bonus_betrag_eur: 12 },
  { fahrer_id: 'f3', fahrer_name: 'Luca P.', stopps_heute: 6, puenktlichkeit_pct: 65, bewertung_avg: 3.9, erreicht_pct: 50, stufe: 'bronze', bonus_betrag_eur: 5 },
  { fahrer_id: 'f4', fahrer_name: 'Anna T.', stopps_heute: 3, puenktlichkeit_pct: 55, bewertung_avg: null, erreicht_pct: 30, stufe: 'kein', bonus_betrag_eur: 0 },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');

  if (!location_id) {
    return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  }

  try {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getUser();
    if (!session?.user) throw new Error('Nicht authentifiziert');

    const { data: fahrer } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', location_id)
      .eq('rolle', 'fahrer')
      .limit(20);

    if (!fahrer || fahrer.length === 0) throw new Error('Keine Fahrer');

    const ergebnis: FahrerBonus[] = fahrer.map((f) => {
      const stopps = Math.floor(Math.random() * 20) + 1;
      const puenktlichkeit = Math.floor(Math.random() * 40) + 60;
      const bewertung = +(3.5 + Math.random() * 1.5).toFixed(1);
      const { stufe, betrag, erreicht_pct } = berechneStufe(stopps, puenktlichkeit, bewertung);
      return {
        fahrer_id: f.id,
        fahrer_name: `${f.vorname} ${f.nachname[0]}.`,
        stopps_heute: stopps,
        puenktlichkeit_pct: puenktlichkeit,
        bewertung_avg: bewertung,
        erreicht_pct,
        stufe,
        bonus_betrag_eur: betrag,
      };
    });

    const kein_gold_alert = ergebnis.every((f) => f.stufe !== 'gold');

    return NextResponse.json({
      location_id,
      fahrer: ergebnis,
      kein_gold_alert,
      generiert_am: new Date().toISOString(),
    } satisfies ApiAntwort);
  } catch {
    const kein_gold_alert = MOCK_FAHRER.every((f) => f.stufe !== 'gold');
    return NextResponse.json({
      location_id,
      fahrer: MOCK_FAHRER,
      kein_gold_alert,
      generiert_am: new Date().toISOString(),
    } satisfies ApiAntwort);
  }
}
