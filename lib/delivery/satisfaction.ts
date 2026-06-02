/**
 * lib/delivery/satisfaction.ts
 *
 * Customer Satisfaction Tracking — Phase 22.
 * Generiert Rating-Tokens nach Lieferung, verarbeitet Kunden-Bewertungen
 * und stellt Aggregationen für Admin-Dashboard + Dispatch-Scoring bereit.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { randomBytes, createHash } from 'crypto';

// ─── Typen ───────────────────────────────────────────────────────────────────

export interface CustomerRating {
  id: string;
  orderId: string;
  batchId: string | null;
  driverId: string | null;
  locationId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  createdAt: string;
}

export interface DriverSatisfaction {
  driverId: string;
  driverName: string;
  totalRatings: number;
  avgRating: number;
  positiveRatings: number;
  negativeRatings: number;
  fiveStarCount: number;
  oneStarCount: number;
  lastRatingAt: string | null;
}

export interface SatisfactionSummary {
  totalRatings: number;
  avgRating: number;
  positiveRate: number;
  negativeRate: number;
  withComment: number;
  byDay: Array<{ date: string; avgRating: number; count: number }>;
  byDriver: DriverSatisfaction[];
  recentComments: Array<{ rating: number; comment: string; createdAt: string }>;
}

export interface RatingTokenResult {
  orderId: string;
  token: string;
  ratingUrl: string;
}

// ─── Token-Generierung ───────────────────────────────────────────────────────

/**
 * Generiert einen einmaligen Rating-Token für eine Bestellung und speichert ihn.
 * Wird nach erfolgreicher Lieferung aufgerufen (fire-and-forget).
 */
export async function generateRatingToken(
  orderId: string,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL ?? '',
): Promise<RatingTokenResult | null> {
  const sb = createServiceClient();

  // Prüfen ob bereits ein Token existiert
  const { data: existing } = await sb
    .from('customer_orders')
    .select('rating_token')
    .eq('id', orderId)
    .maybeSingle();

  if (existing?.rating_token) {
    return {
      orderId,
      token: existing.rating_token,
      ratingUrl: `${baseUrl}/rate/${existing.rating_token}`,
    };
  }

  // Neuen Token generieren (12 Bytes = 24 Hex-Zeichen, URL-safe)
  const token = randomBytes(12).toString('hex');
  const hashToken = createHash('sha256').update(`${orderId}:${token}`).digest('hex').slice(0, 24);

  const { error } = await sb
    .from('customer_orders')
    .update({ rating_token: hashToken })
    .eq('id', orderId);

  if (error) {
    console.warn('[satisfaction] generateRatingToken failed:', error.message);
    return null;
  }

  return {
    orderId,
    token: hashToken,
    ratingUrl: `${baseUrl}/rate/${hashToken}`,
  };
}

/**
 * Generiert Rating-Tokens für alle abgeschlossenen Lieferungen ohne Token.
 * Cron-Helfer — fire-and-forget.
 */
export async function generateMissingRatingTokens(locationId: string): Promise<number> {
  const sb = createServiceClient();

  const { data: orders } = await sb
    .from('customer_orders')
    .select('id')
    .eq('location_id', locationId)
    .in('status', ['geliefert', 'abgeschlossen'])
    .is('rating_token', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!orders?.length) return 0;

  let generated = 0;
  for (const order of orders) {
    const result = await generateRatingToken(order.id);
    if (result) generated++;
  }

  return generated;
}

// ─── Rating einreichen ───────────────────────────────────────────────────────

export interface SubmitRatingInput {
  token: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
}

export interface SubmitRatingResult {
  success: boolean;
  error?: string;
  alreadyRated?: boolean;
}

/**
 * Verarbeitet eine Kunden-Bewertung via Rating-Token.
 * Idempotent: zweiter Aufruf mit gleichem Token gibt alreadyRated=true zurück.
 */
export async function submitCustomerRating(input: SubmitRatingInput): Promise<SubmitRatingResult> {
  const sb = createServiceClient();

  // Token auf customer_orders auflösen
  const { data: order } = await sb
    .from('customer_orders')
    .select('id, location_id, mise_batch_id, mise_driver_id, rating_token')
    .eq('rating_token', input.token)
    .maybeSingle();

  if (!order) {
    return { success: false, error: 'Ungültiger oder abgelaufener Bewertungs-Link.' };
  }

  // Prüfen ob bereits bewertet
  const { data: existing } = await sb
    .from('customer_delivery_ratings')
    .select('id')
    .eq('order_id', order.id)
    .maybeSingle();

  if (existing) {
    return { success: true, alreadyRated: true };
  }

  // Fahrer-ID aus Batch laden falls nicht direkt auf Order
  let driverId: string | null = order.mise_driver_id ?? null;
  if (!driverId && order.mise_batch_id) {
    const { data: batch } = await sb
      .from('mise_delivery_batches')
      .select('driver_id')
      .eq('id', order.mise_batch_id)
      .maybeSingle();
    driverId = batch?.driver_id ?? null;
  }

  const { error } = await sb.from('customer_delivery_ratings').insert({
    order_id:    order.id,
    batch_id:    order.mise_batch_id ?? null,
    driver_id:   driverId,
    location_id: order.location_id,
    rating:      input.rating,
    comment:     input.comment?.trim() ?? null,
    rating_token: input.token,
    token_used_at: new Date().toISOString(),
  });

  if (error) {
    // UNIQUE-Conflict = bereits bewertet (Race Condition)
    if (error.code === '23505') return { success: true, alreadyRated: true };
    console.warn('[satisfaction] submitRating failed:', error.message);
    return { success: false, error: 'Bewertung konnte nicht gespeichert werden.' };
  }

  return { success: true };
}

// ─── Admin-Aggregationen ─────────────────────────────────────────────────────

/**
 * Zufriedenheits-Zusammenfassung für eine Location.
 * Gibt Gesamt-KPIs + per-Fahrer + Tages-Trend + aktuelle Kommentare zurück.
 */
export async function getSatisfactionSummary(
  locationId: string,
  days: number = 14,
): Promise<SatisfactionSummary> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  // Gesamt-KPIs
  const { data: totals } = await sb
    .from('customer_delivery_ratings')
    .select('rating, comment')
    .eq('location_id', locationId)
    .gte('created_at', since);

  const ratings = totals ?? [];
  const totalRatings = ratings.length;
  const avgRating = totalRatings > 0
    ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / totalRatings) * 100) / 100
    : 0;
  const positiveCount = ratings.filter(r => r.rating >= 4).length;
  const negativeCount = ratings.filter(r => r.rating <= 2).length;
  const withComment   = ratings.filter(r => r.comment).length;

  // Tages-Trend aus View
  const { data: dayRows } = await sb
    .from('v_location_satisfaction')
    .select('rating_day, avg_rating, total_ratings')
    .eq('location_id', locationId)
    .gte('rating_day', since)
    .order('rating_day', { ascending: true });

  const byDay = (dayRows ?? []).map(r => ({
    date: (r.rating_day as string).slice(0, 10),
    avgRating: Number(r.avg_rating),
    count: Number(r.total_ratings),
  }));

  // Fahrer-Aufschlüsselung aus View
  const { data: driverRows } = await sb
    .from('v_driver_satisfaction')
    .select('driver_id, driver_name, total_ratings, avg_rating, positive_ratings, negative_ratings, five_star_count, one_star_count, last_rating_at');

  const byDriver: DriverSatisfaction[] = (driverRows ?? [])
    .filter(d => Number(d.total_ratings) > 0)
    .map(d => ({
      driverId:        d.driver_id as string,
      driverName:      (d.driver_name as string | null) ?? 'Unbekannt',
      totalRatings:    Number(d.total_ratings),
      avgRating:       Number(d.avg_rating),
      positiveRatings: Number(d.positive_ratings),
      negativeRatings: Number(d.negative_ratings),
      fiveStarCount:   Number(d.five_star_count),
      oneStarCount:    Number(d.one_star_count),
      lastRatingAt:    (d.last_rating_at as string | null),
    }))
    .sort((a, b) => b.totalRatings - a.totalRatings);

  // Neueste Kommentare (max. 10)
  const { data: comments } = await sb
    .from('customer_delivery_ratings')
    .select('rating, comment, created_at')
    .eq('location_id', locationId)
    .not('comment', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  const recentComments = (comments ?? []).map(c => ({
    rating:    c.rating as number,
    comment:   (c.comment as string)!,
    createdAt: c.created_at as string,
  }));

  return {
    totalRatings,
    avgRating,
    positiveRate: totalRatings > 0 ? Math.round((positiveCount / totalRatings) * 100) : 0,
    negativeRate: totalRatings > 0 ? Math.round((negativeCount / totalRatings) * 100) : 0,
    withComment,
    byDay,
    byDriver,
    recentComments,
  };
}

/**
 * Liest die Bestelldetails zu einem Rating-Token (für die öffentliche Rating-Seite).
 * Gibt nur Mindest-Infos zurück (kein PII-Leak).
 */
export async function getOrderForToken(token: string): Promise<{
  orderId: string;
  bestellnummer: string;
  status: string;
  alreadyRated: boolean;
} | null> {
  const sb = createServiceClient();

  const { data: order } = await sb
    .from('customer_orders')
    .select('id, bestellnummer, status')
    .eq('rating_token', token)
    .maybeSingle();

  if (!order) return null;

  const { data: existingRating } = await sb
    .from('customer_delivery_ratings')
    .select('id')
    .eq('order_id', order.id)
    .maybeSingle();

  return {
    orderId:       order.id as string,
    bestellnummer: order.bestellnummer as string,
    status:        order.status as string,
    alreadyRated:  !!existingRating,
  };
}

/**
 * Markiert alle frisch gelieferten Orders als "Rating-Link verschickt".
 * Wird im Cron-Tick aufgerufen — fire-and-forget.
 */
export async function markRatingTokensSent(orderIds: string[]): Promise<void> {
  if (!orderIds.length) return;
  const sb = createServiceClient();
  await sb
    .from('customer_orders')
    .update({ rating_sent_at: new Date().toISOString() })
    .in('id', orderIds)
    .is('rating_sent_at', null);
}
