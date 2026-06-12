/**
 * lib/delivery/loyalty-points.ts
 *
 * Kunden-Loyalty-Punkte-System — Phase 77.
 *
 * Regeln:
 *   POINTS_PER_EUR = 10     → 10 Punkte pro € Bestellwert
 *   REDEEM_RATE    = 0.01   → 1 Punkt = 0,01 € Rabatt (100 P = 1 €)
 *   MIN_REDEEM     = 100    → Mindest-Einlösung 100 Punkte
 *   MAX_REDEEM_PCT = 20     → Einlösung max. 20 % des Bestellwerts
 *   POINTS_TTL_DAYS = 365   → Punkte verfallen nach 12 Monaten ohne Nutzung
 *
 * Tier-Grenzen (lifetime_points):
 *   Bronze   0 – 499
 *   Silver   500 – 1 999
 *   Gold     2 000 – 4 999
 *   Platinum 5 000+
 *
 * Funktionen:
 *   earnPoints()                  — Punkte nach Lieferung vergeben
 *   redeemPoints()                — Punkte im Checkout einlösen
 *   getBalance()                  — Kontostand abfragen (public)
 *   getTransactionHistory()       — Transaktionsverlauf
 *   getLeaderboard()              — Top-Kunden einer Location
 *   getLoyaltyKpis()              — Admin-KPIs
 *   manualAdjust()                — Admin-Korrektur
 *   processExpiredPoints()        — Cron: abgelaufene Punkte verfallen lassen
 *   processExpiredPointsAllLocations() — Cron-Wrapper
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Konstanten ────────────────────────────────────────────────────────────────

export const POINTS_PER_EUR    = 10;
export const REDEEM_RATE       = 0.01;  // € pro Punkt
export const MIN_REDEEM_POINTS = 100;
export const MAX_REDEEM_PCT    = 20;    // max. 20 % des Bestellwerts als Rabatt
export const POINTS_TTL_DAYS   = 365;

export const TIER_THRESHOLDS = {
  bronze:   0,
  silver:   500,
  gold:     2000,
  platinum: 5000,
} as const;

export type LoyaltyTier = keyof typeof TIER_THRESHOLDS;

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface LoyaltyAccount {
  id: string;
  locationId: string;
  customerEmail: string;
  customerName: string | null;
  totalPoints: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  lastActivityAt: string;
  createdAt: string;
}

export interface PointTransaction {
  id: string;
  accountId: string;
  type: 'earn' | 'redeem' | 'expire' | 'manual' | 'refund';
  points: number;
  balanceAfter: number;
  description: string | null;
  orderId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface EarnResult {
  accountId: string;
  pointsEarned: number;
  newBalance: number;
  tier: LoyaltyTier;
  tierUpgraded: boolean;
}

export interface RedeemResult {
  ok: true;
  pointsRedeemed: number;
  discountEur: number;
  newBalance: number;
}

export interface LoyaltyBalance {
  accountId: string;
  totalPoints: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  tierNextName: LoyaltyTier | null;
  tierNextPoints: number | null;
  maxRedeemPoints: number;
  maxRedeemEur: number;
}

export interface LeaderboardEntry {
  rank: number;
  accountId: string;
  customerEmail: string;
  customerName: string | null;
  totalPoints: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  lastActivityAt: string;
}

export interface LoyaltyKpis {
  totalAccounts: number;
  activeAccounts: number;
  totalPointsOutstanding: number;
  totalLifetimeEarned: number;
  tierBreakdown: Record<LoyaltyTier, number>;
  avgPointsPerAccount: number;
  redemptionRate: number;
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function computeTier(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (lifetimePoints >= TIER_THRESHOLDS.gold)     return 'gold';
  if (lifetimePoints >= TIER_THRESHOLDS.silver)   return 'silver';
  return 'bronze';
}

function nextTier(tier: LoyaltyTier): { name: LoyaltyTier; points: number } | null {
  if (tier === 'bronze')   return { name: 'silver',   points: TIER_THRESHOLDS.silver };
  if (tier === 'silver')   return { name: 'gold',     points: TIER_THRESHOLDS.gold };
  if (tier === 'gold')     return { name: 'platinum', points: TIER_THRESHOLDS.platinum };
  return null;
}

function mapAccount(r: Record<string, unknown>): LoyaltyAccount {
  return {
    id:             String(r.id),
    locationId:     String(r.location_id),
    customerEmail:  String(r.customer_email),
    customerName:   (r.customer_name as string | null) ?? null,
    totalPoints:    Number(r.total_points ?? 0),
    lifetimePoints: Number(r.lifetime_points ?? 0),
    tier:           (r.tier as LoyaltyTier) ?? 'bronze',
    lastActivityAt: String(r.last_activity_at ?? r.created_at),
    createdAt:      String(r.created_at),
  };
}

function mapTxn(r: Record<string, unknown>): PointTransaction {
  return {
    id:           String(r.id),
    accountId:    String(r.account_id),
    type:         r.type as PointTransaction['type'],
    points:       Number(r.points),
    balanceAfter: Number(r.balance_after),
    description:  (r.description as string | null) ?? null,
    orderId:      (r.order_id as string | null) ?? null,
    expiresAt:    (r.expires_at as string | null) ?? null,
    createdAt:    String(r.created_at),
  };
}

function isMissingTable(err: { code?: string } | null): boolean {
  return err?.code === '42P01';
}

// ── Interner Account-Lookup ───────────────────────────────────────────────────

async function getOrCreateAccount(
  email: string,
  name: string | null,
  locationId: string,
): Promise<LoyaltyAccount> {
  const svc = createServiceClient();
  const normalizedEmail = email.trim().toLowerCase();

  const { data: existing } = await svc
    .from('customer_loyalty_accounts')
    .select('*')
    .eq('location_id', locationId)
    .eq('customer_email', normalizedEmail)
    .maybeSingle();

  if (existing) return mapAccount(existing as Record<string, unknown>);

  const { data: created, error } = await svc
    .from('customer_loyalty_accounts')
    .insert({
      location_id:     locationId,
      customer_email:  normalizedEmail,
      customer_name:   name ?? null,
      total_points:    0,
      lifetime_points: 0,
      tier:            'bronze',
    })
    .select('*')
    .single();

  if (error) throw new Error(`Loyalty account creation failed: ${error.message}`);
  return mapAccount(created as Record<string, unknown>);
}

// ── Öffentliche API ───────────────────────────────────────────────────────────

/**
 * Punkte vergeben nach Lieferung.
 * Punkte = Math.round(amountEur * POINTS_PER_EUR)
 * Mindestwert: 1 Punkt (damit die Aktion aufgezeichnet wird).
 */
export async function earnPoints(input: {
  orderId: string;
  locationId: string;
  amountEur: number;
  customerEmail: string;
  customerName: string | null;
}): Promise<EarnResult> {
  const svc = createServiceClient();
  const points = Math.max(1, Math.round(input.amountEur * POINTS_PER_EUR));
  const normalizedEmail = input.customerEmail.trim().toLowerCase();

  const account = await getOrCreateAccount(normalizedEmail, input.customerName, input.locationId);
  const prevTier = account.tier;
  const newTotal    = account.totalPoints + points;
  const newLifetime = account.lifetimePoints + points;
  const newTier     = computeTier(newLifetime);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + POINTS_TTL_DAYS);

  const { error: updateErr } = await svc
    .from('customer_loyalty_accounts')
    .update({
      total_points:    newTotal,
      lifetime_points: newLifetime,
      tier:            newTier,
      tier_updated_at: newTier !== prevTier ? new Date().toISOString() : undefined,
      last_activity_at: new Date().toISOString(),
      customer_name:   input.customerName ?? account.customerName ?? null,
    })
    .eq('id', account.id);

  if (updateErr) throw new Error(`Loyalty earn update failed: ${updateErr.message}`);

  await svc.from('loyalty_point_transactions').insert({
    account_id:    account.id,
    location_id:   input.locationId,
    order_id:      input.orderId,
    type:          'earn',
    points:        points,
    balance_after: newTotal,
    description:   `Bestellung: ${Math.round(input.amountEur * 100) / 100} €`,
    expires_at:    expiresAt.toISOString(),
  });

  return {
    accountId:    account.id,
    pointsEarned: points,
    newBalance:   newTotal,
    tier:         newTier,
    tierUpgraded: newTier !== prevTier,
  };
}

/**
 * Punkte einlösen.
 * Prüft: Kontostand ausreichend, Mindest-Einlösung, Max-Rabatt-Grenze.
 * Gibt Rabatt in EUR zurück.
 */
export async function redeemPoints(input: {
  customerEmail: string;
  locationId: string;
  points: number;
  orderId: string;
  orderAmountEur: number;
}): Promise<RedeemResult | { ok: false; reason: string }> {
  const svc = createServiceClient();
  const normalizedEmail = input.customerEmail.trim().toLowerCase();

  if (input.points < MIN_REDEEM_POINTS) {
    return { ok: false, reason: `Mindest-Einlösung: ${MIN_REDEEM_POINTS} Punkte` };
  }

  const maxDiscount = (input.orderAmountEur * MAX_REDEEM_PCT) / 100;
  const requestedDiscount = input.points * REDEEM_RATE;
  const actualDiscount = Math.min(requestedDiscount, maxDiscount);
  const actualPoints = Math.round(actualDiscount / REDEEM_RATE);

  const { data: account } = await svc
    .from('customer_loyalty_accounts')
    .select('id, total_points, lifetime_points, tier')
    .eq('location_id', input.locationId)
    .eq('customer_email', normalizedEmail)
    .maybeSingle();

  if (!account) return { ok: false, reason: 'Kein Loyalty-Konto gefunden' };
  if ((account.total_points as number) < actualPoints) {
    return { ok: false, reason: `Nicht genug Punkte (Guthaben: ${account.total_points})` };
  }

  const newTotal = (account.total_points as number) - actualPoints;

  const { error: updateErr } = await svc
    .from('customer_loyalty_accounts')
    .update({
      total_points:    newTotal,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', account.id);

  if (updateErr) return { ok: false, reason: updateErr.message };

  await svc.from('loyalty_point_transactions').insert({
    account_id:    account.id as string,
    location_id:   input.locationId,
    order_id:      input.orderId,
    type:          'redeem',
    points:        -actualPoints,
    balance_after: newTotal,
    description:   `Einlösung: ${actualDiscount.toFixed(2)} € Rabatt`,
  });

  return {
    ok:              true,
    pointsRedeemed:  actualPoints,
    discountEur:     Math.round(actualDiscount * 100) / 100,
    newBalance:      newTotal,
  };
}

/**
 * Kontostand abfragen (öffentlich via E-Mail + location_id).
 */
export async function getBalance(
  customerEmail: string,
  locationId: string,
): Promise<LoyaltyBalance | null> {
  const svc = createServiceClient();
  const normalizedEmail = customerEmail.trim().toLowerCase();

  const { data } = await svc
    .from('customer_loyalty_accounts')
    .select('id, total_points, lifetime_points, tier')
    .eq('location_id', locationId)
    .eq('customer_email', normalizedEmail)
    .maybeSingle();

  if (!data) return null;

  const total    = data.total_points as number;
  const lifetime = data.lifetime_points as number;
  const tier     = (data.tier as LoyaltyTier) ?? 'bronze';
  const next     = nextTier(tier);

  return {
    accountId:       data.id as string,
    totalPoints:     total,
    lifetimePoints:  lifetime,
    tier,
    tierNextName:    next?.name ?? null,
    tierNextPoints:  next ? next.points - lifetime : null,
    maxRedeemPoints: total,
    maxRedeemEur:    Math.round(total * REDEEM_RATE * 100) / 100,
  };
}

/**
 * Transaktionsverlauf (neueste zuerst).
 */
export async function getTransactionHistory(
  customerEmail: string,
  locationId: string,
  limit = 20,
): Promise<PointTransaction[]> {
  const svc = createServiceClient();
  const normalizedEmail = customerEmail.trim().toLowerCase();

  const { data: account } = await svc
    .from('customer_loyalty_accounts')
    .select('id')
    .eq('location_id', locationId)
    .eq('customer_email', normalizedEmail)
    .maybeSingle();

  if (!account) return [];

  const { data } = await svc
    .from('loyalty_point_transactions')
    .select('*')
    .eq('account_id', account.id as string)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 100));

  return (data ?? []).map((r) => mapTxn(r as Record<string, unknown>));
}

/**
 * Top-Kunden-Leaderboard einer Location.
 */
export async function getLeaderboard(
  locationId: string,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const svc = createServiceClient();

  const { data, error } = await svc
    .from('v_loyalty_leaderboard')
    .select('rank, account_id, customer_email, customer_name, total_points, lifetime_points, tier, last_activity_at')
    .eq('location_id', locationId)
    .order('rank', { ascending: true })
    .limit(Math.min(limit, 100));

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((r) => ({
    rank:           Number(r.rank),
    accountId:      String(r.account_id),
    customerEmail:  String(r.customer_email),
    customerName:   (r.customer_name as string | null) ?? null,
    totalPoints:    Number(r.total_points ?? 0),
    lifetimePoints: Number(r.lifetime_points ?? 0),
    tier:           (r.tier as LoyaltyTier) ?? 'bronze',
    lastActivityAt: String(r.last_activity_at),
  }));
}

/**
 * Admin-KPIs für eine Location.
 */
export async function getLoyaltyKpis(locationId: string): Promise<LoyaltyKpis> {
  const svc = createServiceClient();

  const { data, error } = await svc
    .from('customer_loyalty_accounts')
    .select('total_points, lifetime_points, tier, last_activity_at')
    .eq('location_id', locationId);

  if (error) {
    if (isMissingTable(error)) {
      return { totalAccounts: 0, activeAccounts: 0, totalPointsOutstanding: 0, totalLifetimeEarned: 0, tierBreakdown: { bronze: 0, silver: 0, gold: 0, platinum: 0 }, avgPointsPerAccount: 0, redemptionRate: 0 };
    }
    throw new Error(error.message);
  }

  const accounts = data ?? [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const tierBreakdown: Record<LoyaltyTier, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  let totalOutstanding = 0;
  let totalLifetime    = 0;
  let activeCount      = 0;

  for (const a of accounts) {
    const t = (a.tier as LoyaltyTier) ?? 'bronze';
    tierBreakdown[t]++;
    totalOutstanding += Number(a.total_points ?? 0);
    totalLifetime    += Number(a.lifetime_points ?? 0);
    if (a.last_activity_at && new Date(a.last_activity_at as string) > cutoff) activeCount++;
  }

  const totalAccounts = accounts.length;
  const redeemed = totalLifetime - totalOutstanding;

  return {
    totalAccounts,
    activeAccounts:        activeCount,
    totalPointsOutstanding: totalOutstanding,
    totalLifetimeEarned:   totalLifetime,
    tierBreakdown,
    avgPointsPerAccount:   totalAccounts > 0 ? Math.round(totalOutstanding / totalAccounts) : 0,
    redemptionRate:        totalLifetime > 0 ? Math.round((redeemed / totalLifetime) * 1000) / 10 : 0,
  };
}

/**
 * Admin: manuelle Punkte-Anpassung (+ oder –).
 */
export async function manualAdjust(input: {
  customerEmail: string;
  locationId: string;
  points: number;  // positiv = hinzufügen, negativ = abziehen
  reason: string;
  adminId: string;
}): Promise<{ ok: true; newBalance: number } | { ok: false; reason: string }> {
  const svc = createServiceClient();
  const normalizedEmail = input.customerEmail.trim().toLowerCase();

  const { data: account } = await svc
    .from('customer_loyalty_accounts')
    .select('id, total_points, lifetime_points, tier')
    .eq('location_id', input.locationId)
    .eq('customer_email', normalizedEmail)
    .maybeSingle();

  if (!account) return { ok: false, reason: 'Kein Loyalty-Konto gefunden' };

  const current = account.total_points as number;
  const newTotal = current + input.points;

  if (newTotal < 0) return { ok: false, reason: 'Kontostand würde negativ' };

  const newLifetime = input.points > 0
    ? (account.lifetime_points as number) + input.points
    : account.lifetime_points as number;
  const newTier = computeTier(newLifetime as number);

  const { error } = await svc
    .from('customer_loyalty_accounts')
    .update({
      total_points:    newTotal,
      lifetime_points: newLifetime,
      tier:            newTier,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', account.id as string);

  if (error) return { ok: false, reason: error.message };

  await svc.from('loyalty_point_transactions').insert({
    account_id:    account.id as string,
    location_id:   input.locationId,
    type:          'manual',
    points:        input.points,
    balance_after: newTotal,
    description:   `Admin-Anpassung: ${input.reason}`,
  });

  return { ok: true, newBalance: newTotal };
}

/**
 * Cron: abgelaufene Punkte verfallen lassen (Earn-Buchungen älter als POINTS_TTL_DAYS).
 * Sucht Konten mit abgelaufenen Earn-Buchungen und reduziert Kontostand entsprechend.
 */
export async function processExpiredPoints(locationId: string): Promise<{ expired: number }> {
  const svc = createServiceClient();
  const now = new Date().toISOString();
  let expired = 0;

  const { data: expiredTxns, error } = await svc
    .from('loyalty_point_transactions')
    .select('id, account_id, points, balance_after')
    .eq('location_id', locationId)
    .eq('type', 'earn')
    .lt('expires_at', now)
    .limit(100);

  if (error) {
    if (isMissingTable(error)) return { expired: 0 };
    return { expired: 0 };
  }

  if (!expiredTxns || expiredTxns.length === 0) return { expired: 0 };

  // Summiere ablaufende Punkte pro Konto
  const byAccount = new Map<string, number>();
  for (const t of expiredTxns) {
    const acc = t.account_id as string;
    byAccount.set(acc, (byAccount.get(acc) ?? 0) + (t.points as number));
  }

  for (const [accountId, earnedPoints] of byAccount.entries()) {
    const { data: acc } = await svc
      .from('customer_loyalty_accounts')
      .select('total_points')
      .eq('id', accountId)
      .maybeSingle();

    if (!acc) continue;
    const current = acc.total_points as number;
    const expirePoints = Math.min(earnedPoints, current);
    if (expirePoints <= 0) continue;

    const newTotal = current - expirePoints;
    await svc
      .from('customer_loyalty_accounts')
      .update({ total_points: newTotal, last_activity_at: new Date().toISOString() })
      .eq('id', accountId);

    await svc.from('loyalty_point_transactions').insert({
      account_id:    accountId,
      location_id:   locationId,
      type:          'expire',
      points:        -expirePoints,
      balance_after: newTotal,
      description:   'Automatisch verfallen (> 12 Monate)',
    });

    expired += expirePoints;
  }

  // Verarbeitete Earn-Buchungen: expires_at auf null setzen damit sie nicht erneut erfasst werden
  const ids = expiredTxns.map((t) => t.id as string);
  await svc
    .from('loyalty_point_transactions')
    .update({ expires_at: null })
    .in('id', ids);

  return { expired };
}

/**
 * Cron-Wrapper: alle aktiven Locations.
 */
export async function processExpiredPointsAllLocations(): Promise<{
  locations: number;
  totalExpired: number;
}> {
  const svc = createServiceClient();
  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(50);

  let totalExpired = 0;
  const results = await Promise.allSettled(
    (locs ?? []).map((l) => processExpiredPoints(l.id as string)),
  );

  for (const r of results) {
    if (r.status === 'fulfilled') totalExpired += r.value.expired;
  }

  return { locations: (locs ?? []).length, totalExpired };
}
