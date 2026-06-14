/**
 * lib/delivery/feedback-sentiment.ts
 *
 * Kunden-Feedback-Sentiment-Engine — Phase 181
 *
 * Analysiert Freitext-Kommentare aus Kunden-Bewertungen keyword-basiert
 * (kein externer API-Aufruf nötig). Liefert Sentiment-Score, Labels und
 * erkannte Themen für Admin-Dashboard und Fahrer-Profil.
 *
 * Funktionen:
 *  analyzeFeedbackText(text, starRating)   — Sentiment-Analyse eines Kommentars
 *  processRating(ratingId, locationId)     — Einzelne Bewertung analysieren + speichern
 *  processAllUnanalyzed(locationId)        — Batch: alle unanalysierten Kommentare
 *  processAllUnanalyzedLocations()         — Cron-Batch über alle aktiven Locations
 *  getSentimentDashboard(locationId)       — Dashboard-KPIs + Trend
 *  getDriverSentimentProfile(driverId, locationId) — Fahrer-Sentiment
 *  getTopKeywords(locationId, days)        — Trending-Keywords
 *  getFlaggedComments(locationId, limit)   — Negative/geflaggte Kommentare
 *  getRecentCommentsFeed(locationId, limit) — Live-Feed aller Kommentare
 *  pruneSentimentData(days)                — Cleanup alter Einträge
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export interface SentimentResult {
  score: number;           // -1.0 bis +1.0
  label: SentimentLabel;
  keywords: string[];      // max 10 gefundene Keywords
  topics: string[];        // erkannte Themen
  isFlagged: boolean;
}

export interface FeedbackSentimentRow {
  id: string;
  locationId: string;
  ratingId: string;
  driverId: string | null;
  orderId: string | null;
  rawComment: string;
  ratingScore: number;
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
  keywords: string[];
  topics: string[];
  isFlagged: boolean;
  analyzedAt: string;
}

export interface SentimentDashboard {
  summary: {
    totalAnalyzed: number;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
    positivePct: number;
    negativePct: number;
    avgSentiment: number;
    flaggedCount: number;
    lastAnalyzedAt: string | null;
  };
  trend: Array<{
    day: string;
    total: number;
    positiveCount: number;
    negativeCount: number;
    avgSentiment: number;
  }>;
  topKeywords: Array<{ keyword: string; count: number; avgSentiment: number }>;
  flaggedComments: FeedbackSentimentRow[];
  unanalyzedCount: number;
}

export interface DriverSentimentProfile {
  driverId: string;
  totalAnalyzed: number;
  positiveCount: number;
  negativeCount: number;
  avgSentiment: number;
  avgStarRating: number;
  flaggedCount: number;
  topKeywords: Array<{ keyword: string; count: number }>;
  recentComments: FeedbackSentimentRow[];
}

// ── Keyword-Listen (Deutsch + typisches Restaurant-Slang) ─────────────────────

const POSITIVE_STRONG = [
  'super', 'perfekt', 'ausgezeichnet', 'fantastisch', 'wunderbar', 'top', 'hammer',
  'klasse', 'hervorragend', 'großartig', 'toll', 'prima', 'spitze', 'exzellent',
  'begeistert', 'mega', 'genial', 'sensationell', 'traumhaft',
];

const POSITIVE_WEAK = [
  'gut', 'schön', 'lecker', 'pünktlich', 'schnell', 'freundlich', 'nett', 'höflich',
  'kompetent', 'zuverlässig', 'warm', 'frisch', 'sauber', 'ordentlich', 'sorgfältig',
  'zufrieden', 'empfehlen', 'empfehlenswert', 'danke', 'dankeschön', 'weiter so',
  'gerne wieder', 'alles richtig', 'alles super', 'passt', 'stimmt',
];

const NEGATIVE_STRONG = [
  'katastrophe', 'furchtbar', 'schrecklich', 'skandal', 'unverschämt', 'frechheit',
  'niemals wieder', 'absolute frechheit', 'unter aller kritik', 'boykott', 'betrug',
  'rückerstattu', 'erstattung', 'anwalt', 'polizei', 'gesundheitsamt', 'vergiftet',
  'schimmel', 'verderben', 'abzocke', 'abgezockt',
];

const NEGATIVE_WEAK = [
  'schlecht', 'kalt', 'spät', 'verspätet', 'falsch', 'vergessen', 'fehlt', 'fehlte',
  'enttäuscht', 'enttäuschend', 'leider', 'mangelhaft', 'unzufrieden', 'beschwerde',
  'reklamation', 'problem', 'fehler', 'kaputt', 'zerdrückt', 'verschüttet', 'nass',
  'kein trinkgeld', 'unhöflich', 'unfreundlich', 'grob', 'roh', 'arrogant',
  'langsam', 'lange gewartet', 'nie wieder', 'nicht empfehlen',
];

const NEGATION_WORDS = [
  'nicht', 'kein', 'keine', 'keinen', 'keiner', 'nie', 'niemals', 'kaum', 'wenig',
];

// Themen-Keywords
const TOPIC_MAP: Record<string, string[]> = {
  driver: ['fahrer', 'fahrerin', 'bote', 'botin', 'kurier', 'kurierfahrer', 'lieferant'],
  food: ['essen', 'speisen', 'gericht', 'mahlzeit', 'portion', 'geschmack', 'qualität', 'lecker', 'kalt', 'warm', 'frisch', 'frische'],
  time: ['zeit', 'pünktlich', 'verspätet', 'warten', 'schnell', 'langsam', 'lange', 'minuten', 'stunden'],
  packaging: ['verpackung', 'tüte', 'beutel', 'box', 'karton', 'folie', 'plastik', 'zerdrückt', 'aufgegangen'],
  price: ['preis', 'teuer', 'billig', 'günstig', 'wert', 'wertvoll', 'überteuert', 'abzocke'],
  delivery: ['lieferung', 'liefern', 'zugestellt', 'übergabe', 'haustür', 'klingeln'],
};

// ── Kern-Analyse ──────────────────────────────────────────────────────────────

export function analyzeFeedbackText(text: string, starRating: number): SentimentResult {
  const lower = text.toLowerCase();
  const words = lower.split(/[\s,!?.;:\-–()\[\]"']+/).filter(Boolean);

  let score = 0;
  const foundKeywords: string[] = [];
  const foundTopics = new Set<string>();
  let isFlagged = false;

  // Star-Rating als Basis-Prior: 5★=+0.4, 4★=+0.15, 3★=0, 2★=-0.2, 1★=-0.4
  const starPrior = starRating === 5 ? 0.4 : starRating === 4 ? 0.15 : starRating === 3 ? 0 : starRating === 2 ? -0.2 : -0.4;
  score += starPrior;

  // Negations-Fenster: check 2 Wörter vor jedem Keyword
  const checkNegated = (idx: number): boolean => {
    const window = words.slice(Math.max(0, idx - 2), idx);
    return window.some((w) => NEGATION_WORDS.includes(w));
  };

  words.forEach((word, idx) => {
    // Positive
    if (POSITIVE_STRONG.some((k) => word.includes(k))) {
      const factor = checkNegated(idx) ? -1 : 1;
      score += factor * 0.3;
      foundKeywords.push(word);
    } else if (POSITIVE_WEAK.some((k) => word.includes(k))) {
      const factor = checkNegated(idx) ? -1 : 1;
      score += factor * 0.15;
      foundKeywords.push(word);
    }
    // Negative
    if (NEGATIVE_STRONG.some((k) => lower.includes(k))) {
      score -= 0.35;
      isFlagged = true;
      foundKeywords.push(word);
    } else if (NEGATIVE_WEAK.some((k) => word.includes(k))) {
      const factor = checkNegated(idx) ? 1 : -1;
      score += factor * 0.15;
      foundKeywords.push(word);
    }

    // Themen
    for (const [topic, topicWords] of Object.entries(TOPIC_MAP)) {
      if (topicWords.some((tw) => word.includes(tw))) {
        foundTopics.add(topic);
      }
    }
  });

  // Clamp score to [-1, 1]
  score = Math.max(-1, Math.min(1, score));

  // Label
  let label: SentimentLabel;
  if (score >= 0.15) label = 'positive';
  else if (score <= -0.15) label = 'negative';
  else label = 'neutral';

  // Flag wenn negativ + ≤2 Sterne
  if (label === 'negative' && starRating <= 2) isFlagged = true;

  // Deduplizieren + auf 10 Stück kürzen
  const uniqueKeywords = [...new Set(foundKeywords)].slice(0, 10);

  return {
    score: Math.round(score * 1000) / 1000,
    label,
    keywords: uniqueKeywords,
    topics: [...foundTopics],
    isFlagged,
  };
}

// ── Persistierung ─────────────────────────────────────────────────────────────

export async function processRating(
  ratingId: string,
  locationId: string,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const svc = createServiceClient();

  // Lade Bewertung
  const { data: rating, error: fetchErr } = await svc
    .from('customer_ratings')
    .select('id, order_id, driver_id, rating, comment, location_id')
    .eq('id', ratingId)
    .eq('location_id', locationId)
    .single();

  if (fetchErr || !rating) return { ok: false, error: 'Rating nicht gefunden' };
  if (!rating.comment?.trim()) return { ok: true, skipped: true };

  // Schon analysiert?
  const { data: existing } = await svc
    .from('delivery_feedback_sentiment')
    .select('id')
    .eq('rating_id', ratingId)
    .maybeSingle();

  if (existing) return { ok: true, skipped: true };

  const result = analyzeFeedbackText(rating.comment, rating.rating);

  const { error: insertErr } = await svc.from('delivery_feedback_sentiment').insert({
    location_id: locationId,
    rating_id: ratingId,
    driver_id: rating.driver_id ?? null,
    order_id: rating.order_id ?? null,
    raw_comment: rating.comment,
    rating_score: rating.rating,
    sentiment_score: result.score,
    sentiment_label: result.label,
    keywords: result.keywords,
    topics: result.topics,
    is_flagged: result.isFlagged,
    analyzed_at: new Date().toISOString(),
  });

  if (insertErr) return { ok: false, error: insertErr.message };
  return { ok: true };
}

interface RatingDbRow {
  id: string;
  order_id: string | null;
  driver_id: string | null;
  rating: number;
  comment: string | null;
  location_id: string;
}

interface SentimentIdRow {
  rating_id: string;
}

export async function processAllUnanalyzed(
  locationId: string,
): Promise<{ processed: number; skipped: number; errors: number }> {
  const svc = createServiceClient();

  // Lade alle Ratings mit Kommentar die noch nicht analysiert wurden
  const { data: ratingsRaw } = await svc
    .from('customer_ratings')
    .select('id, order_id, driver_id, rating, comment, location_id')
    .eq('location_id', locationId)
    .not('comment', 'is', null)
    .neq('comment', '')
    .order('created_at', { ascending: false })
    .limit(500);

  const ratings = (ratingsRaw ?? []) as RatingDbRow[];
  if (!ratings.length) return { processed: 0, skipped: 0, errors: 0 };

  // Bereits analysierte IDs laden
  const ratingIds = ratings.map((r: RatingDbRow) => r.id);
  const { data: existingRaw } = await svc
    .from('delivery_feedback_sentiment')
    .select('rating_id')
    .in('rating_id', ratingIds);

  const existingRows = (existingRaw ?? []) as SentimentIdRow[];
  const analyzedIds = new Set(existingRows.map((r: SentimentIdRow) => r.rating_id));

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  const toAnalyze = ratings.filter((r: RatingDbRow) => !analyzedIds.has(r.id) && r.comment?.trim());

  // Batch-Insert in 50er Chunks
  const CHUNK = 50;
  for (let i = 0; i < toAnalyze.length; i += CHUNK) {
    const chunk = toAnalyze.slice(i, i + CHUNK);
    const rows = chunk.map((r: RatingDbRow) => {
      const result = analyzeFeedbackText(r.comment!, r.rating);
      return {
        location_id: locationId,
        rating_id: r.id,
        driver_id: r.driver_id ?? null,
        order_id: r.order_id ?? null,
        raw_comment: r.comment!,
        rating_score: r.rating,
        sentiment_score: result.score,
        sentiment_label: result.label,
        keywords: result.keywords,
        topics: result.topics,
        is_flagged: result.isFlagged,
        analyzed_at: new Date().toISOString(),
      };
    });

    const { error } = await svc
      .from('delivery_feedback_sentiment')
      .insert(rows);

    if (error) {
      errors += chunk.length;
    } else {
      processed += chunk.length;
    }
  }

  skipped = analyzedIds.size;
  return { processed, skipped, errors };
}

export async function processAllUnanalyzedLocations(): Promise<void> {
  const svc = createServiceClient();
  const { data: locations } = await svc
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locations?.length) return;

  for (const loc of locations) {
    await processAllUnanalyzed(loc.id).catch(() => null);
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getSentimentDashboard(
  locationId: string,
): Promise<SentimentDashboard> {
  const svc = createServiceClient();

  const [summaryRes, trendRes, keywordsRes, flaggedRes, unanalyzedRes] = await Promise.all([
    svc.from('v_feedback_sentiment_summary').select('*').eq('location_id', locationId).maybeSingle(),
    svc
      .from('v_feedback_sentiment_daily')
      .select('day, total, positive_count, negative_count, avg_sentiment')
      .eq('location_id', locationId)
      .order('day', { ascending: false })
      .limit(30),
    svc
      .from('delivery_feedback_sentiment')
      .select('keywords')
      .eq('location_id', locationId)
      .gte('analyzed_at', new Date(Date.now() - 30 * 86400_000).toISOString())
      .limit(1000),
    svc
      .from('delivery_feedback_sentiment')
      .select('id, location_id, rating_id, driver_id, order_id, raw_comment, rating_score, sentiment_score, sentiment_label, keywords, topics, is_flagged, analyzed_at')
      .eq('location_id', locationId)
      .eq('is_flagged', true)
      .order('analyzed_at', { ascending: false })
      .limit(20),
    // Unanalyzed count
    svc
      .from('customer_ratings')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .not('comment', 'is', null)
      .neq('comment', ''),
  ]);

  const s = summaryRes.data;
  const summary = {
    totalAnalyzed: Number(s?.total_analyzed ?? 0),
    positiveCount: Number(s?.positive_count ?? 0),
    neutralCount: Number(s?.neutral_count ?? 0),
    negativeCount: Number(s?.negative_count ?? 0),
    positivePct: Number(s?.positive_pct ?? 0),
    negativePct: Number(s?.negative_pct ?? 0),
    avgSentiment: Number(s?.avg_sentiment ?? 0),
    flaggedCount: Number(s?.flagged_count ?? 0),
    lastAnalyzedAt: s?.last_analyzed_at ?? null,
  };

  interface TrendRow { day: unknown; total: unknown; positive_count: unknown; negative_count: unknown; avg_sentiment: unknown }
  const trend = ((trendRes.data ?? []) as TrendRow[]).map((r) => ({
    day: r.day as string,
    total: Number(r.total),
    positiveCount: Number(r.positive_count),
    negativeCount: Number(r.negative_count),
    avgSentiment: Number(r.avg_sentiment),
  }));

  // Top-Keywords aggregieren
  const kwCount: Record<string, { count: number; scoreSum: number }> = {};
  ((keywordsRes.data ?? []) as Array<{ keywords: unknown }>).forEach((row) => {
    const arr = Array.isArray(row.keywords) ? (row.keywords as string[]) : [];
    arr.forEach((kw: string) => {
      if (!kwCount[kw]) kwCount[kw] = { count: 0, scoreSum: 0 };
      kwCount[kw].count++;
    });
  });
  const topKeywords = Object.entries(kwCount)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([keyword, { count, scoreSum }]) => ({
      keyword,
      count,
      avgSentiment: scoreSum ? Math.round((scoreSum / count) * 1000) / 1000 : 0,
    }));

  const flaggedComments = (flaggedRes.data ?? []).map(mapRow);

  const totalWithComment = unanalyzedRes.count ?? 0;
  const unanalyzedCount = Math.max(0, totalWithComment - summary.totalAnalyzed);

  return { summary, trend, topKeywords, flaggedComments, unanalyzedCount };
}

export async function getDriverSentimentProfile(
  driverId: string,
  locationId: string,
): Promise<DriverSentimentProfile | null> {
  const svc = createServiceClient();

  const [profileRes, commentsRes] = await Promise.all([
    svc
      .from('v_driver_sentiment')
      .select('*')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .maybeSingle(),
    svc
      .from('delivery_feedback_sentiment')
      .select('id, location_id, rating_id, driver_id, order_id, raw_comment, rating_score, sentiment_score, sentiment_label, keywords, topics, is_flagged, analyzed_at')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .order('analyzed_at', { ascending: false })
      .limit(10),
  ]);

  if (!profileRes.data) return null;

  // Keywords aus recent comments aggregieren
  const kwCount: Record<string, number> = {};
  ((commentsRes.data ?? []) as Array<{ keywords: unknown }>).forEach((row) => {
    ((row.keywords as string[]) ?? []).forEach((kw: string) => {
      kwCount[kw] = (kwCount[kw] ?? 0) + 1;
    });
  });
  const topKeywords = Object.entries(kwCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([keyword, count]) => ({ keyword, count }));

  const p = profileRes.data;
  return {
    driverId,
    totalAnalyzed: Number(p.total_analyzed ?? 0),
    positiveCount: Number(p.positive_count ?? 0),
    negativeCount: Number(p.negative_count ?? 0),
    avgSentiment: Number(p.avg_sentiment ?? 0),
    avgStarRating: Number(p.avg_star_rating ?? 0),
    flaggedCount: Number(p.flagged_count ?? 0),
    topKeywords,
    recentComments: (commentsRes.data ?? []).map(mapRow),
  };
}

export async function getTopKeywords(
  locationId: string,
  days = 30,
): Promise<Array<{ keyword: string; count: number }>> {
  const svc = createServiceClient();
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const { data } = await svc
    .from('delivery_feedback_sentiment')
    .select('keywords')
    .eq('location_id', locationId)
    .gte('analyzed_at', since)
    .limit(2000);

  const kwCount: Record<string, number> = {};
  ((data ?? []) as Array<{ keywords: unknown }>).forEach((row) => {
    ((row.keywords as string[]) ?? []).forEach((kw: string) => {
      kwCount[kw] = (kwCount[kw] ?? 0) + 1;
    });
  });

  return Object.entries(kwCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, count]) => ({ keyword, count }));
}

export async function getFlaggedComments(
  locationId: string,
  limit = 50,
): Promise<FeedbackSentimentRow[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('delivery_feedback_sentiment')
    .select('id, location_id, rating_id, driver_id, order_id, raw_comment, rating_score, sentiment_score, sentiment_label, keywords, topics, is_flagged, analyzed_at')
    .eq('location_id', locationId)
    .eq('is_flagged', true)
    .order('analyzed_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map(mapRow);
}

export async function getRecentCommentsFeed(
  locationId: string,
  limit = 30,
): Promise<FeedbackSentimentRow[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('delivery_feedback_sentiment')
    .select('id, location_id, rating_id, driver_id, order_id, raw_comment, rating_score, sentiment_score, sentiment_label, keywords, topics, is_flagged, analyzed_at')
    .eq('location_id', locationId)
    .order('analyzed_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map(mapRow);
}

export async function pruneSentimentData(olderThanDays = 180): Promise<number> {
  const svc = createServiceClient();
  const cutoff = new Date(Date.now() - olderThanDays * 86400_000).toISOString();
  const { count } = await svc
    .from('delivery_feedback_sentiment')
    .delete({ count: 'exact' })
    .lt('analyzed_at', cutoff);
  return count ?? 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): FeedbackSentimentRow {
  return {
    id: r.id as string,
    locationId: r.location_id as string,
    ratingId: r.rating_id as string,
    driverId: r.driver_id as string | null,
    orderId: r.order_id as string | null,
    rawComment: r.raw_comment as string,
    ratingScore: Number(r.rating_score),
    sentimentScore: Number(r.sentiment_score),
    sentimentLabel: r.sentiment_label as SentimentLabel,
    keywords: r.keywords as string[],
    topics: r.topics as string[],
    isFlagged: Boolean(r.is_flagged),
    analyzedAt: r.analyzed_at as string,
  };
}
