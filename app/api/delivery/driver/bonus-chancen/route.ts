/**
 * GET /api/delivery/driver/bonus-chancen?driver_id=<uuid>&location_id=<uuid>
 *
 * Phase 1587 — Fahrer-Bonus-Chancen-API
 * Aktuelle Bonus-Schwellen (Stopps/Umsatz/Bewertung) + Fortschritt je Fahrer +
 * Ablaufdatum; Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface BonusSchwelle {
  key: 'stopps' | 'umsatz' | 'bewertung';
  label: string;
  einheit: string;
  ziel: number;
  aktuell: number;
  pct: number;
  erreicht: boolean;
  bonus_eur: number;
}

export interface BonusChancenResponse {
  driver_id: string;
  name: string;
  schwellen: BonusSchwelle[];
  total_erreichbar_eur: number;
  total_erreicht_eur: number;
  ampel: 'nah' | 'mittel' | 'weit';
  ablauf_datum: string;
  location_id: string;
  generiert_am: string;
}

const STOPP_ZIEL = 25;
const UMSATZ_ZIEL_EUR = 500;
const BEWERTUNG_ZIEL = 4.7;
const STOPP_BONUS = 10;
const UMSATZ_BONUS = 15;
const BEWERTUNG_BONUS = 8;

function ampel(erreichtPct: number): 'nah' | 'mittel' | 'weit' {
  if (erreichtPct >= 0.75) return 'nah';
  if (erreichtPct >= 0.4) return 'mittel';
  return 'weit';
}

function buildMock(driverId: string, locationId: string): BonusChancenResponse {
  const stopps = 18;
  const umsatz = 310;
  const bewertung = 4.5;
  const ablauf = new Date();
  ablauf.setUTCDate(ablauf.getUTCDate() + (7 - ablauf.getUTCDay() || 7));
  ablauf.setUTCHours(23, 59, 59, 0);

  const schwellen: BonusSchwelle[] = [
    {
      key: 'stopps',
      label: 'Stopps diese Woche',
      einheit: 'Stopps',
      ziel: STOPP_ZIEL,
      aktuell: stopps,
      pct: Math.min(100, Math.round((stopps / STOPP_ZIEL) * 100)),
      erreicht: stopps >= STOPP_ZIEL,
      bonus_eur: STOPP_BONUS,
    },
    {
      key: 'umsatz',
      label: 'Umsatz diese Woche',
      einheit: '€',
      ziel: UMSATZ_ZIEL_EUR,
      aktuell: umsatz,
      pct: Math.min(100, Math.round((umsatz / UMSATZ_ZIEL_EUR) * 100)),
      erreicht: umsatz >= UMSATZ_ZIEL_EUR,
      bonus_eur: UMSATZ_BONUS,
    },
    {
      key: 'bewertung',
      label: 'Ø Bewertung (letzte 30)',
      einheit: '★',
      ziel: BEWERTUNG_ZIEL,
      aktuell: bewertung,
      pct: Math.min(100, Math.round((bewertung / BEWERTUNG_ZIEL) * 100)),
      erreicht: bewertung >= BEWERTUNG_ZIEL,
      bonus_eur: BEWERTUNG_BONUS,
    },
  ];

  const total_erreichbar_eur = schwellen.reduce((s, x) => s + x.bonus_eur, 0);
  const total_erreicht_eur = schwellen.filter((x) => x.erreicht).reduce((s, x) => s + x.bonus_eur, 0);
  const avgPct = schwellen.reduce((s, x) => s + x.pct, 0) / schwellen.length / 100;

  return {
    driver_id: driverId,
    name: 'Max M.',
    schwellen,
    total_erreichbar_eur,
    total_erreicht_eur,
    ampel: ampel(avgPct),
    ablauf_datum: ablauf.toISOString(),
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  const locationId = searchParams.get('location_id') ?? '';

  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // Week boundaries (Mon–Sun)
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const diffToMon = (dayOfWeek + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setUTCDate(weekStart.getUTCDate() - diffToMon);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const ablauf = new Date(weekEnd);
    ablauf.setUTCMilliseconds(ablauf.getUTCMilliseconds() - 1);

    // Fahrername
    const { data: profile } = await supabase
      .from('mise_employees')
      .select('vorname, nachname')
      .eq('id', driverId)
      .maybeSingle();

    const name = profile ? `${profile.vorname} ${profile.nachname[0]}.` : 'Fahrer';

    // Stopps diese Woche
    const { count: stoppCount } = await supabase
      .from('mise_delivery_stops')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .gte('geliefert_am', weekStart.toISOString())
      .lt('geliefert_am', weekEnd.toISOString());

    const stopps = stoppCount ?? 0;

    // Umsatz diese Woche (Summe order totals)
    const { data: orderData } = await supabase
      .from('mise_orders')
      .select('total_price_eur')
      .eq('driver_id', driverId)
      .gte('created_at', weekStart.toISOString())
      .lt('created_at', weekEnd.toISOString());

    const umsatz = (orderData ?? []).reduce((s, o) => s + (o.total_price_eur ?? 0), 0);

    // Ø Bewertung (letzte 30)
    const { data: reviews } = await supabase
      .from('mise_delivery_reviews')
      .select('rating')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(30);

    const bewertung =
      reviews && reviews.length > 0
        ? reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length
        : 4.0;

    const schwellen: BonusSchwelle[] = [
      {
        key: 'stopps',
        label: 'Stopps diese Woche',
        einheit: 'Stopps',
        ziel: STOPP_ZIEL,
        aktuell: stopps,
        pct: Math.min(100, Math.round((stopps / STOPP_ZIEL) * 100)),
        erreicht: stopps >= STOPP_ZIEL,
        bonus_eur: STOPP_BONUS,
      },
      {
        key: 'umsatz',
        label: 'Umsatz diese Woche',
        einheit: '€',
        ziel: UMSATZ_ZIEL_EUR,
        aktuell: Math.round(umsatz * 100) / 100,
        pct: Math.min(100, Math.round((umsatz / UMSATZ_ZIEL_EUR) * 100)),
        erreicht: umsatz >= UMSATZ_ZIEL_EUR,
        bonus_eur: UMSATZ_BONUS,
      },
      {
        key: 'bewertung',
        label: 'Ø Bewertung (letzte 30)',
        einheit: '★',
        ziel: BEWERTUNG_ZIEL,
        aktuell: Math.round(bewertung * 10) / 10,
        pct: Math.min(100, Math.round((bewertung / BEWERTUNG_ZIEL) * 100)),
        erreicht: bewertung >= BEWERTUNG_ZIEL,
        bonus_eur: BEWERTUNG_BONUS,
      },
    ];

    const total_erreichbar_eur = schwellen.reduce((s, x) => s + x.bonus_eur, 0);
    const total_erreicht_eur = schwellen.filter((x) => x.erreicht).reduce((s, x) => s + x.bonus_eur, 0);
    const avgPct = schwellen.reduce((s, x) => s + x.pct, 0) / schwellen.length / 100;

    const response: BonusChancenResponse = {
      driver_id: driverId,
      name,
      schwellen,
      total_erreichbar_eur,
      total_erreicht_eur,
      ampel: ampel(avgPct),
      ablauf_datum: ablauf.toISOString(),
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(buildMock(driverId, locationId));
  }
}
