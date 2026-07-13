import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1214 — Bonus-Status API (Fahrer-App)
// Heutiger Bonus-Status: Stopps-Ziel + Bewertung + Pünktlichkeit → Bronze/Silber/Gold

type BonusStufe = 'kein' | 'bronze' | 'silber' | 'gold';

interface BonusZiel {
  label: string;
  ziel: number;
  aktuell: number;
  einheit: string;
  erreicht: boolean;
  pct: number;
}

const STOPP_ZIEL = 20;
const BEWERTUNG_ZIEL = 4.5;
const PUENKTLICHKEIT_ZIEL = 85;

const BONUS_BETRAEGE: Record<BonusStufe, number> = { kein: 0, bronze: 3, silber: 8, gold: 15 };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  try {
    const supabase = await createClient();

    // Stopps heute
    const { count: stoppCount } = await supabase
      .from('mise_delivery_stops')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .gte('geliefert_am', todayStart.toISOString());

    const stoppsHeute = stoppCount ?? 0;

    // Bewertung (letzte 50 Einträge)
    const { data: reviews } = await supabase
      .from('mise_delivery_reviews')
      .select('rating')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(50);

    const avgRating = reviews && reviews.length > 0
      ? reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length
      : 4.2;

    // Pünktlichkeit: % der Stopps heute die innerhalb SLA geliefert wurden
    const { data: todayStops } = await supabase
      .from('mise_delivery_stops')
      .select('geliefert_am, estimated_delivery_at')
      .eq('driver_id', driverId)
      .gte('geliefert_am', todayStart.toISOString())
      .not('geliefert_am', 'is', null);

    let puenktlichkeitPct = 80;
    if (todayStops && todayStops.length > 0) {
      const puenktlich = todayStops.filter(s => {
        if (!s.estimated_delivery_at || !s.geliefert_am) return true;
        return new Date(s.geliefert_am) <= new Date(s.estimated_delivery_at);
      });
      puenktlichkeitPct = Math.round((puenktlich.length / todayStops.length) * 100);
    }

    const ziele: BonusZiel[] = [
      {
        label: 'Stopps heute',
        ziel: STOPP_ZIEL,
        aktuell: stoppsHeute,
        einheit: ' Stopps',
        erreicht: stoppsHeute >= STOPP_ZIEL,
        pct: Math.min(100, Math.round((stoppsHeute / STOPP_ZIEL) * 100)),
      },
      {
        label: 'Ø Bewertung',
        ziel: BEWERTUNG_ZIEL,
        aktuell: Math.round(avgRating * 10) / 10,
        einheit: '★',
        erreicht: avgRating >= BEWERTUNG_ZIEL,
        pct: Math.min(100, Math.round((avgRating / BEWERTUNG_ZIEL) * 100)),
      },
      {
        label: 'Pünktlichkeit',
        ziel: PUENKTLICHKEIT_ZIEL,
        aktuell: puenktlichkeitPct,
        einheit: '%',
        erreicht: puenktlichkeitPct >= PUENKTLICHKEIT_ZIEL,
        pct: Math.min(100, Math.round((puenktlichkeitPct / PUENKTLICHKEIT_ZIEL) * 100)),
      },
    ];

    const erreichtCount = ziele.filter(z => z.erreicht).length;
    const stufe: BonusStufe = erreichtCount === 3 ? 'gold' : erreichtCount === 2 ? 'silber' : erreichtCount === 1 ? 'bronze' : 'kein';

    return NextResponse.json({
      fahrer_id: driverId,
      bonus_stufe: stufe,
      bonus_betrag_eur: BONUS_BETRAEGE[stufe],
      ziele,
      erreichbar: erreichtCount >= 2,
      fehlende_ziele: ziele.filter(z => !z.erreicht).length,
      generiert_am: now.toISOString(),
    });
  } catch {
    return NextResponse.json({
      fahrer_id: driverId,
      bonus_stufe: 'kein' as BonusStufe,
      bonus_betrag_eur: 0,
      ziele: [],
      erreichbar: false,
      fehlende_ziele: 3,
      generiert_am: now.toISOString(),
    });
  }
}
