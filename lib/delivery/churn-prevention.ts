/**
 * lib/delivery/churn-prevention.ts
 *
 * Smart Customer Churn Prevention & Re-Engagement Engine — Phase 101
 *
 * RFM-basiertes Scoring (Recency / Frequency / Monetary) identifiziert
 * Kunden, die abzuwandern drohen. Automatische Re-Engagement-Kampagnen
 * stellen Gutschriften aus und tracken Win-Backs.
 *
 * Funktionen:
 *   analyzeChurnForLocation(locationId)      — Scores für alle Kunden berechnen + upserten
 *   analyzeChurnAllLocations()               — Cron-Batch (täglich 02:00 UTC)
 *   getChurnDashboard(locationId)            — KPIs + Risikoverteilung + At-Risk-Liste
 *   runReEngagementCampaign(locationId, opts) — Gutschrift ausstellen + Kampagne markieren
 *   runReEngagementAllLocations()            — Cron-Batch Re-Engagement (täglich 04:00 UTC)
 *   markCampaignConverted(locationId, email) — Kauf nach Kampagne als Win-Back zählen
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { issueManualCredit } from './credits';

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────

export type ChurnRiskTier = 'safe' | 'warning' | 'at_risk' | 'churned';

export interface ChurnRiskScore {
  id: string;
  locationId: string;
  customerEmail: string;
  customerName: string | null;
  riskScore: number;
  riskTier: ChurnRiskTier;
  daysSinceLastOrder: number | null;
  orderCount30d: number;
  orderCountPrev30d: number;
  avgOrderValueEur: number | null;
  lastOrderAt: string | null;
  campaignSentAt: string | null;
  campaignResult: 'pending' | 'converted' | 'no_response' | null;
  creditId: string | null;
  creditEur: number | null;
  updatedAt: string;
}

export interface ChurnStats {
  locationId: string;
  totalCustomers: number;
  countSafe: number;
  countWarning: number;
  countAtRisk: number;
  countChurned: number;
  campaignsSent: number;
  winBacks: number;
  winBackRatePct: number | null;
  avgRiskScore: number | null;
}

export interface ChurnDashboard {
  stats: ChurnStats;
  atRiskCustomers: ChurnRiskScore[];
  recentlySentCampaigns: ChurnRiskScore[];
}

export interface ReEngagementOptions {
  maxCustomers?: number;
  creditAtRiskEur?: number;
  creditChurnedEur?: number;
  dryRun?: boolean;
}

export interface ReEngagementResult {
  locationId: string;
  eligible: number;
  campaignsSent: number;
  creditsIssued: number;
  skipped: number;
  dryRun: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interne Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

function isMissingTable(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '42P01'
  );
}

function mapRow(r: Record<string, unknown>): ChurnRiskScore {
  return {
    id:                   String(r.id),
    locationId:           String(r.location_id),
    customerEmail:        String(r.customer_email),
    customerName:         (r.customer_name as string | null) ?? null,
    riskScore:            Number(r.risk_score),
    riskTier:             (r.risk_tier as ChurnRiskTier),
    daysSinceLastOrder:   r.days_since_last_order != null ? Number(r.days_since_last_order) : null,
    orderCount30d:        Number(r.order_count_30d ?? 0),
    orderCountPrev30d:    Number(r.order_count_prev30d ?? 0),
    avgOrderValueEur:     r.avg_order_value_eur != null ? Number(r.avg_order_value_eur) : null,
    lastOrderAt:          (r.last_order_at as string | null) ?? null,
    campaignSentAt:       (r.campaign_sent_at as string | null) ?? null,
    campaignResult:       (r.campaign_result as ChurnRiskScore['campaignResult']) ?? null,
    creditId:             (r.credit_id as string | null) ?? null,
    creditEur:            r.credit_eur != null ? Number(r.credit_eur) : null,
    updatedAt:            String(r.updated_at),
  };
}

/** RFM-Score berechnen (0–100) */
function computeRiskScore(params: {
  daysSinceLastOrder: number | null;
  orderCount30d: number;
  orderCountPrev30d: number;
}): number {
  let score = 0;

  // Recency (0–50 Punkte): Je länger her, desto mehr Risiko
  const days = params.daysSinceLastOrder ?? 999;
  if (days > 90)      score += 50;
  else if (days > 60) score += 35;
  else if (days > 30) score += 20;
  else if (days > 14) score += 5;

  // Frequency-Rückgang (0–30 Punkte)
  const curr = params.orderCount30d;
  const prev = params.orderCountPrev30d;
  if (prev > 0 && curr < prev) {
    const declinePct = (prev - curr) / prev;
    if (declinePct > 0.75)      score += 30;
    else if (declinePct > 0.5)  score += 20;
    else if (declinePct > 0.25) score += 12;
    else                        score += 5;
  }

  // Aktivität letzter 30 Tage (0–20 Punkte)
  if      (curr === 0)  score += 20;
  else if (curr === 1)  score += 10;
  else if (curr === 2)  score += 5;

  return Math.min(100, Math.max(0, score));
}

function scoreToTier(score: number): ChurnRiskTier {
  if (score >= 80) return 'churned';
  if (score >= 60) return 'at_risk';
  if (score >= 30) return 'warning';
  return 'safe';
}

// ─────────────────────────────────────────────────────────────────────────────
// Analyse
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Churn-Scores für alle Kunden einer Location berechnen und in DB upserten.
 * Betrachtet Kunden mit mindestens 1 Bestellung in den letzten 120 Tagen.
 */
export async function analyzeChurnForLocation(
  locationId: string,
): Promise<{ analyzed: number; upserted: number }> {
  const svc = createServiceClient();
  const cutoff = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
  const now    = new Date();
  const ago30  = new Date(now.getTime() -  30 * 24 * 60 * 60 * 1000).toISOString();
  const ago60  = new Date(now.getTime() -  60 * 24 * 60 * 60 * 1000).toISOString();

  // Alle relevanten Bestellungen laden (Status nicht storniert)
  const { data: orders, error } = await svc
    .from('customer_orders')
    .select('kunde_email, kunde_name, gesamtbetrag, created_at')
    .eq('location_id', locationId)
    .not('kunde_email', 'is', null)
    .not('status', 'in', '("cancelled","rejected","storniert")')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(10000);

  if (error) {
    if (isMissingTable(error)) return { analyzed: 0, upserted: 0 };
    throw new Error(`Churn analyze orders error: ${error.message}`);
  }

  if (!orders || orders.length === 0) return { analyzed: 0, upserted: 0 };

  // Aggregieren nach Kunde
  type CustomerAgg = {
    name: string | null;
    lastOrderAt: Date;
    count30d: number;
    countPrev30d: number;
    totalValue: number;
    orderCount: number;
  };

  const byEmail = new Map<string, CustomerAgg>();

  for (const o of orders) {
    const email = (o.kunde_email as string).trim().toLowerCase();
    const oDate = new Date(o.created_at as string);
    const value = Number(o.gesamtbetrag ?? 0);

    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, {
        name:         (o.kunde_name as string | null) ?? null,
        lastOrderAt:  oDate,
        count30d:     oDate >= new Date(ago30) ? 1 : 0,
        countPrev30d: oDate >= new Date(ago60) && oDate < new Date(ago30) ? 1 : 0,
        totalValue:   value,
        orderCount:   1,
      });
    } else {
      if (oDate > existing.lastOrderAt) {
        existing.lastOrderAt = oDate;
        if (!existing.name && o.kunde_name) existing.name = o.kunde_name as string;
      }
      if (oDate >= new Date(ago30))                               existing.count30d++;
      if (oDate >= new Date(ago60) && oDate < new Date(ago30))    existing.countPrev30d++;
      existing.totalValue += value;
      existing.orderCount++;
    }
  }

  // Upserts batchen
  const BATCH = 100;
  const entries = Array.from(byEmail.entries());
  let upserted = 0;

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH).map(([email, agg]) => {
      const daysSince = Math.floor(
        (now.getTime() - agg.lastOrderAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      const riskScore = computeRiskScore({
        daysSinceLastOrder: daysSince,
        orderCount30d:      agg.count30d,
        orderCountPrev30d:  agg.countPrev30d,
      });

      return {
        location_id:           locationId,
        customer_email:        email,
        customer_name:         agg.name,
        risk_score:            riskScore,
        risk_tier:             scoreToTier(riskScore),
        days_since_last_order: daysSince,
        order_count_30d:       agg.count30d,
        order_count_prev30d:   agg.countPrev30d,
        avg_order_value_eur:   agg.orderCount > 0
          ? Math.round((agg.totalValue / agg.orderCount) * 100) / 100
          : null,
        last_order_at:         agg.lastOrderAt.toISOString(),
        updated_at:            new Date().toISOString(),
      };
    });

    const { error: upsertErr } = await svc
      .from('customer_churn_risk_scores')
      .upsert(batch, { onConflict: 'location_id,customer_email' });

    if (upsertErr && !isMissingTable(upsertErr)) {
      console.error('[churn] upsert error:', upsertErr.message);
    } else {
      upserted += batch.length;
    }
  }

  return { analyzed: entries.length, upserted };
}

/** Cron-Batch: alle aktiven Locations analysieren */
export async function analyzeChurnAllLocations(): Promise<{
  locations: number;
  totalAnalyzed: number;
  totalUpserted: number;
}> {
  const svc = createServiceClient();
  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(50);

  let totalAnalyzed = 0;
  let totalUpserted = 0;

  for (const loc of locs ?? []) {
    try {
      const r = await analyzeChurnForLocation(loc.id as string);
      totalAnalyzed += r.analyzed;
      totalUpserted += r.upserted;
    } catch (e) {
      console.error('[churn] analyzeChurnForLocation error:', e instanceof Error ? e.message : e);
    }
  }

  return { locations: (locs ?? []).length, totalAnalyzed, totalUpserted };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export async function getChurnDashboard(locationId: string): Promise<ChurnDashboard> {
  const svc = createServiceClient();

  const [statsResult, atRiskResult, recentResult] = await Promise.all([
    svc
      .from('v_churn_stats')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),
    svc
      .from('customer_churn_risk_scores')
      .select('*')
      .eq('location_id', locationId)
      .gte('risk_score', 60)
      .order('risk_score', { ascending: false })
      .limit(50),
    svc
      .from('customer_churn_risk_scores')
      .select('*')
      .eq('location_id', locationId)
      .not('campaign_sent_at', 'is', null)
      .order('campaign_sent_at', { ascending: false })
      .limit(20),
  ]);

  const s = statsResult.data as Record<string, unknown> | null;
  const stats: ChurnStats = {
    locationId,
    totalCustomers:  Number(s?.total_customers ?? 0),
    countSafe:       Number(s?.count_safe       ?? 0),
    countWarning:    Number(s?.count_warning    ?? 0),
    countAtRisk:     Number(s?.count_at_risk    ?? 0),
    countChurned:    Number(s?.count_churned    ?? 0),
    campaignsSent:   Number(s?.campaigns_sent   ?? 0),
    winBacks:        Number(s?.win_backs        ?? 0),
    winBackRatePct:  s?.win_back_rate_pct != null ? Number(s.win_back_rate_pct) : null,
    avgRiskScore:    s?.avg_risk_score     != null ? Number(s.avg_risk_score)    : null,
  };

  return {
    stats,
    atRiskCustomers:       (atRiskResult.data ?? []).map(r => mapRow(r as Record<string, unknown>)),
    recentlySentCampaigns: (recentResult.data ?? []).map(r => mapRow(r as Record<string, unknown>)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-Engagement-Kampagne
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-Engagement-Kampagne: Stellt Gutschriften für at_risk + churned Kunden aus.
 * Überspringt Kunden, die in den letzten 14 Tagen bereits kontaktiert wurden.
 */
export async function runReEngagementCampaign(
  locationId: string,
  opts: ReEngagementOptions = {},
): Promise<ReEngagementResult> {
  const {
    maxCustomers      = 50,
    creditAtRiskEur   = 3.00,
    creditChurnedEur  = 5.00,
    dryRun            = false,
  } = opts;

  const svc = createServiceClient();

  const cutoffDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: eligible, error } = await svc
    .from('customer_churn_risk_scores')
    .select('*')
    .eq('location_id', locationId)
    .in('risk_tier', ['at_risk', 'churned'])
    .or(`campaign_sent_at.is.null,campaign_sent_at.lt.${cutoffDate}`)
    .order('risk_score', { ascending: false })
    .limit(maxCustomers);

  if (error) {
    if (isMissingTable(error)) {
      return { locationId, eligible: 0, campaignsSent: 0, creditsIssued: 0, skipped: 0, dryRun };
    }
    throw new Error(`Re-engagement query error: ${error.message}`);
  }

  const customers = (eligible ?? []).map(r => mapRow(r as Record<string, unknown>));
  let campaignsSent = 0;
  let creditsIssued = 0;
  let skipped       = 0;

  for (const customer of customers) {
    if (!customer.customerEmail) { skipped++; continue; }

    const creditEur = customer.riskTier === 'churned' ? creditChurnedEur : creditAtRiskEur;

    if (dryRun) {
      campaignsSent++;
      continue;
    }

    try {
      const credit = await issueManualCredit({
        locationId,
        amountEur:     creditEur,
        reason:        'manual',
        reasonDetail:  'Churn-Prävention: Wir vermissen dich! Komm zurück.',
        customerEmail: customer.customerEmail,
        customerName:  customer.customerName ?? undefined,
        expiresInDays: 30,
        createdBy:     'churn-engine',
      });

      await svc
        .from('customer_churn_risk_scores')
        .update({
          campaign_sent_at: new Date().toISOString(),
          campaign_result:  'pending',
          credit_id:        credit.id,
          credit_eur:       creditEur,
          updated_at:       new Date().toISOString(),
        })
        .eq('location_id', locationId)
        .eq('customer_email', customer.customerEmail);

      campaignsSent++;
      creditsIssued++;
    } catch (e) {
      console.error('[churn] campaign error for', customer.customerEmail, e instanceof Error ? e.message : e);
      skipped++;
    }
  }

  return {
    locationId,
    eligible:  customers.length,
    campaignsSent,
    creditsIssued,
    skipped,
    dryRun,
  };
}

/** Cron-Batch: Re-Engagement für alle aktiven Locations */
export async function runReEngagementAllLocations(opts?: ReEngagementOptions): Promise<{
  locations: number;
  totalEligible: number;
  totalSent: number;
  totalCredits: number;
}> {
  const svc = createServiceClient();
  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(50);

  let totalEligible = 0;
  let totalSent     = 0;
  let totalCredits  = 0;

  for (const loc of locs ?? []) {
    try {
      const r = await runReEngagementCampaign(loc.id as string, opts);
      totalEligible += r.eligible;
      totalSent     += r.campaignsSent;
      totalCredits  += r.creditsIssued;
    } catch (e) {
      console.error('[churn] runReEngagementCampaign error:', e instanceof Error ? e.message : e);
    }
  }

  return { locations: (locs ?? []).length, totalEligible, totalSent, totalCredits };
}

/**
 * Win-Back tracken: Wenn ein Kunde nach einer Kampagne wieder bestellt,
 * campaign_result auf 'converted' setzen.
 * Fire-and-forget aus dem Order-Flow (earnPoints, tour status).
 */
export async function markCampaignConverted(
  locationId: string,
  customerEmail: string,
): Promise<void> {
  try {
    const svc   = createServiceClient();
    const email = customerEmail.trim().toLowerCase();

    const { data: existing } = await svc
      .from('customer_churn_risk_scores')
      .select('id, campaign_result, campaign_sent_at')
      .eq('location_id', locationId)
      .eq('customer_email', email)
      .maybeSingle();

    if (!existing) return;
    const r = existing as Record<string, unknown>;
    // Nur konvertieren wenn Kampagne kürzlich versendet wurde
    if (r.campaign_result !== 'pending') return;
    if (!r.campaign_sent_at) return;

    const sentAt = new Date(r.campaign_sent_at as string);
    const daysSince = (Date.now() - sentAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 30) return; // zu alt

    await svc
      .from('customer_churn_risk_scores')
      .update({ campaign_result: 'converted', updated_at: new Date().toISOString() })
      .eq('location_id', locationId)
      .eq('customer_email', email);
  } catch {
    // fire-and-forget
  }
}
