/**
 * GET /api/delivery/driver/komfort-score?driver_id=...&location_id=...
 *
 * Phase 530 — Fahrer-Komfort-Score
 * Aggregiert Selbstbewertungen + Kundenbewertungen + Schichtlänge zu einem
 * täglichen Komfort-Score 0–100.
 *
 * Response: {
 *   ok, driverId, driverName, komfortScore, scoreLabel,
 *   factors: { selfRating, customerRating, shiftLengthMin, deliveries, fatiguePenalty },
 *   recommendation, generatedAt
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type ScoreLabel = 'sehr_gut' | 'gut' | 'mittel' | 'schlecht';

export interface KomfortFactors {
  selfRating: number | null;        // 1–5, aus driver_feedback
  selfRatingScore: number;          // 0–30
  customerRating: number | null;    // Ø aus customer_order.rating heute
  customerRatingScore: number;      // 0–40
  shiftLengthMin: number;           // Minuten online heute
  shiftPenalty: number;             // 0–30, Abzug für lange Schicht
  deliveries: number;
  komfortScore: number;             // 0–100
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

function scoreLabel(score: number): ScoreLabel {
  if (score >= 80) return 'sehr_gut';
  if (score >= 60) return 'gut';
  if (score >= 40) return 'mittel';
  return 'schlecht';
}

function recommendation(label: ScoreLabel, shiftMin: number): string {
  if (label === 'sehr_gut') return 'Sehr gute Schicht! Weiter so.';
  if (label === 'gut') return 'Gute Performance — kleine Verbesserungen möglich.';
  if (label === 'mittel') {
    if (shiftMin > 360) return 'Lange Schicht erkannt — Pause empfohlen für bessere Bewertungen.';
    return 'Mittlerer Komfort — Kundenkontakt und Pünktlichkeit verbessern.';
  }
  return 'Niedriger Score — bitte mit Teamleitung besprechen.';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!driverId)   return NextResponse.json({ error: 'driver_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // Fahrer-Basis-Daten + Schicht-Start
  const { data: driverRow } = await ssb
    .from('delivery_drivers')
    .select('id, name, is_online, online_seit')
    .eq('id', driverId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!driverRow) {
    return NextResponse.json({ error: 'Fahrer nicht gefunden' }, { status: 404 });
  }

  type DriverRow = { id: string; name: string | null; is_online: boolean | null; online_seit: string | null };
  const driver = driverRow as unknown as DriverRow;

  // Schichtlänge heute (Minuten)
  const onlineSeit = driver.online_seit ? new Date(driver.online_seit) : null;
  const shiftLengthMin =
    onlineSeit && onlineSeit >= todayStart
      ? Math.round((now.getTime() - onlineSeit.getTime()) / 60_000)
      : 0;

  // Fahrer-Selbstbewertung (aktuellste heute)
  const { data: selfRows } = await ssb
    .from('driver_feedback')
    .select('rating')
    .eq('driver_id', driverId)
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  type RatingRow = { rating: number | null };
  const selfRatings = (selfRows ?? []) as RatingRow[];
  const selfRating = selfRatings[0]?.rating ?? null;

  // Kundenbewertungen für Lieferungen heute (aus customer_orders.driver_rating)
  const { data: deliveryRows } = await ssb
    .from('customer_orders')
    .select('driver_rating')
    .eq('location_id', locationId)
    .in('status', ['geliefert', 'delivered'])
    .gte('geliefert_am', todayStart.toISOString())
    .lt('geliefert_am', now.toISOString());

  type DeliveryRow = { driver_rating: number | null };
  const deliveries = (deliveryRows ?? []) as DeliveryRow[];
  const deliveriesCount = deliveries.length;

  const ratedDeliveries = deliveries.filter((d) => d.driver_rating != null);
  const customerRating =
    ratedDeliveries.length > 0
      ? Math.round((ratedDeliveries.reduce((s, d) => s + (d.driver_rating ?? 0), 0) / ratedDeliveries.length) * 10) / 10
      : null;

  // Score-Berechnung
  // Selbstbewertung: 1–5 → 0–30 Punkte
  const selfRatingScore = selfRating != null ? Math.round(((selfRating - 1) / 4) * 30) : 15; // Default 15 wenn keine Selbstbewertung

  // Kundenbewertung: 1–5 → 0–40 Punkte
  const customerRatingScore =
    customerRating != null ? Math.round(((customerRating - 1) / 4) * 40) : 20; // Default 20

  // Schicht-Abzug: ab 4h linear bis -30 bei 8h+
  const shiftH = shiftLengthMin / 60;
  const shiftPenalty = shiftH <= 4 ? 0 : Math.min(30, Math.round(((shiftH - 4) / 4) * 30));

  // Basis = 100, abzüglich Schicht-Malus + Scoring-Punkte
  const rawScore = selfRatingScore + customerRatingScore + (30 - shiftPenalty);
  const komfortScore = Math.max(0, Math.min(100, rawScore));

  const label = scoreLabel(komfortScore);

  const factors: KomfortFactors = {
    selfRating,
    selfRatingScore,
    customerRating,
    customerRatingScore,
    shiftLengthMin,
    shiftPenalty,
    deliveries: deliveriesCount,
    komfortScore,
  };

  return NextResponse.json({
    ok: true,
    driverId,
    driverName: driver.name,
    komfortScore,
    scoreLabel: label,
    factors,
    recommendation: recommendation(label, shiftLengthMin),
    generatedAt: now.toISOString(),
  });
}
