/**
 * lib/delivery/smart-upsell.ts
 *
 * Phase 186: Smart Upsell Engine
 *
 * Analysiert Bestellhistorie (market-basket analysis) und generiert
 * Echtzeit-Upsell-Vorschläge beim Checkout.
 *
 * Ablauf:
 *  1. Nacht-Cron: rebuildUpsellPairs() baut Paar-Frequenztabelle neu
 *     (Market-Basket mit Support/Confidence/Lift-Scores)
 *  2. Checkout: getUpsellSuggestions(locationId, cartItems) → Top-3 Vorschläge
 *     Prüft zunächst manuelle Regeln, fällt auf Pair-Analytics zurück
 *  3. Impression: recordImpression() → trackt was angezeigt wurde
 *  4. Conversion: recordConversion() → trackt was der Kunde angenommen hat
 *  5. Admin: getDashboard() → Conversion-Rate, Revenue-Lift, Top-Paare
 *
 * Alle Funktionen fangen fehlende Migration graceful ab (kein Crash).
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UpsellPair {
  id: string;
  location_id: string;
  item_a: string;
  item_b: string;
  pair_count: number;
  order_count_a: number;
  order_count_b: number;
  total_orders: number;
  support_score: number;
  confidence_ab: number;
  confidence_ba: number;
  lift_score: number;
  last_rebuilt_at: string;
}

export interface UpsellRule {
  id: string;
  location_id: string;
  name: string;
  trigger_item: string;
  suggested_item: string;
  headline: string | null;
  badge: string | null;
  extra_fee_eur: number;
  is_active: boolean;
  priority: number;
  max_per_day: number | null;
  impressions_today: number;
  total_impressions: number;
  total_conversions: number;
  created_at: string;
  updated_at: string;
}

export interface UpsellSuggestion {
  suggested_item: string;
  headline: string;
  badge: string | null;
  extra_fee_eur: number;
  source: 'rule' | 'analytics';
  rule_id: string | null;
  confidence: number;  // 0–1
  lift_score: number;
}

export interface UpsellDashboard {
  total_pairs: number;
  total_rules: number;
  active_rules: number;
  total_impressions_30d: number;
  total_conversions_30d: number;
  conversion_rate_pct: number;
  total_revenue_lift_eur: number;
  top_pairs: UpsellPair[];
  rule_performance: RulePerformance[];
  last_rebuilt_at: string | null;
}

interface RulePerformance {
  rule_id: string;
  name: string;
  trigger_item: string;
  suggested_item: string;
  is_active: boolean;
  total_impressions: number;
  total_conversions: number;
  conversion_rate_pct: number;
  total_revenue_lift_eur: number;
  last_impression_at: string | null;
}

// ── Pair Analytics ─────────────────────────────────────────────────────────────

/**
 * Rebuild market-basket pair frequency for one location.
 * Scans the last 90 days of orders, builds item co-occurrence matrix,
 * computes support/confidence/lift scores, and upserts into upsell_item_pairs.
 */
export async function rebuildUpsellPairs(locationId: string): Promise<{
  pairs_upserted: number;
  orders_analyzed: number;
  errors: number;
}> {
  const sb = createServiceClient();

  // Fetch completed orders from last 90 days with item lists
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: orders, error: ordersErr } = await sb
    .from('customer_orders')
    .select('id, artikel')
    .eq('location_id', locationId)
    .in('status', ['geliefert', 'abgeholt', 'abgeschlossen', 'delivered', 'completed'])
    .gte('created_at', since)
    .not('artikel', 'is', null)
    .limit(5000);

  if (ordersErr) return { pairs_upserted: 0, orders_analyzed: 0, errors: 1 };
  if (!orders || orders.length === 0) return { pairs_upserted: 0, orders_analyzed: 0, errors: 0 };

  // Build item sets per order
  const itemSets: string[][] = [];
  for (const order of orders) {
    const items = extractItemNames(order.artikel);
    if (items.length >= 2) itemSets.push(items);
  }

  const totalOrders = itemSets.length;
  if (totalOrders === 0) return { pairs_upserted: 0, orders_analyzed: orders.length, errors: 0 };

  // Count single-item frequencies
  const itemFreq = new Map<string, number>();
  for (const items of itemSets) {
    const unique = [...new Set(items)];
    for (const item of unique) {
      itemFreq.set(item, (itemFreq.get(item) ?? 0) + 1);
    }
  }

  // Count pair frequencies
  const pairFreq = new Map<string, number>();
  for (const items of itemSets) {
    const unique = [...new Set(items)].sort();
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const key = `${unique[i]}|||${unique[j]}`;
        pairFreq.set(key, (pairFreq.get(key) ?? 0) + 1);
      }
    }
  }

  // Build upsert rows with support/confidence/lift
  const rows = [];
  for (const [key, pairCount] of pairFreq.entries()) {
    if (pairCount < 2) continue;  // minimum support = 2 orders
    const [item_a, item_b] = key.split('|||');
    const countA = itemFreq.get(item_a) ?? 1;
    const countB = itemFreq.get(item_b) ?? 1;
    const support    = pairCount / totalOrders;
    const confAB     = pairCount / countA;
    const confBA     = pairCount / countB;
    const probB      = countB / totalOrders;
    const lift       = probB > 0 ? confAB / probB : 0;

    rows.push({
      location_id:     locationId,
      item_a,
      item_b,
      pair_count:      pairCount,
      order_count_a:   countA,
      order_count_b:   countB,
      total_orders:    totalOrders,
      support_score:   Math.round(support * 1e6) / 1e6,
      confidence_ab:   Math.round(confAB * 1e6) / 1e6,
      confidence_ba:   Math.round(confBA * 1e6) / 1e6,
      lift_score:      Math.round(lift * 1e4) / 1e4,
      last_rebuilt_at: new Date().toISOString(),
    });
  }

  if (rows.length === 0) return { pairs_upserted: 0, orders_analyzed: totalOrders, errors: 0 };

  // Upsert in chunks of 200
  let pairsUpserted = 0;
  let errors = 0;
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await sb
      .from('upsell_item_pairs')
      .upsert(chunk, { onConflict: 'location_id,item_a,item_b', ignoreDuplicates: false });
    if (error) errors++;
    else pairsUpserted += chunk.length;
  }

  return { pairs_upserted: pairsUpserted, orders_analyzed: totalOrders, errors };
}

/** Cron batch: rebuild pairs for all locations. */
export async function rebuildAllLocations(): Promise<{
  locations: number;
  pairs_upserted: number;
  orders_analyzed: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('is_active', true);

  if (!locs || locs.length === 0) return { locations: 0, pairs_upserted: 0, orders_analyzed: 0, errors: 0 };

  let totalPairs = 0, totalOrders = 0, totalErrors = 0;
  await Promise.all(
    locs.map(async (loc) => {
      try {
        const r = await rebuildUpsellPairs(loc.id);
        totalPairs  += r.pairs_upserted;
        totalOrders += r.orders_analyzed;
        totalErrors += r.errors;
      } catch {
        totalErrors++;
      }
    }),
  );

  // Reset daily impression counters
  await sb.rpc('reset_upsell_daily_counts').catch(() => null);

  return {
    locations:      locs.length,
    pairs_upserted: totalPairs,
    orders_analyzed: totalOrders,
    errors:          totalErrors,
  };
}

// ── Real-time Suggestions ──────────────────────────────────────────────────────

/**
 * Returns up to `limit` upsell suggestions for the given cart.
 * Priority: active manual rules > analytics pairs, sorted by confidence/lift.
 */
export async function getUpsellSuggestions(
  locationId: string,
  cartItems: string[],
  limit = 3,
): Promise<UpsellSuggestion[]> {
  if (cartItems.length === 0) return [];
  const sb = createServiceClient();
  const cartNorm = cartItems.map(normalizeItem);

  // 1) Manual rules: check which trigger items are in cart
  const { data: rules } = await sb
    .from('upsell_rules')
    .select('id, trigger_item, suggested_item, headline, badge, extra_fee_eur, priority, max_per_day, impressions_today')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .limit(50);

  const suggestions: UpsellSuggestion[] = [];
  const seenItems = new Set<string>(cartNorm);

  if (rules) {
    for (const rule of rules) {
      const triggerNorm = normalizeItem(rule.trigger_item);
      if (!cartNorm.includes(triggerNorm)) continue;
      if (seenItems.has(normalizeItem(rule.suggested_item))) continue;
      if (rule.max_per_day != null && rule.impressions_today >= rule.max_per_day) continue;

      seenItems.add(normalizeItem(rule.suggested_item));
      suggestions.push({
        suggested_item: rule.suggested_item,
        headline:       rule.headline ?? 'Kunden mögen auch…',
        badge:          rule.badge,
        extra_fee_eur:  Number(rule.extra_fee_eur),
        source:         'rule',
        rule_id:        rule.id,
        confidence:     1,
        lift_score:     1,
      });
      if (suggestions.length >= limit) break;
    }
  }

  if (suggestions.length >= limit) return suggestions;

  // 2) Analytics pairs: find pairs where item_a or item_b is in cart
  const { data: pairs } = await sb
    .from('upsell_item_pairs')
    .select('item_a, item_b, confidence_ab, confidence_ba, lift_score')
    .eq('location_id', locationId)
    .or(cartNorm.map(i => `item_a.eq.${i},item_b.eq.${i}`).join(','))
    .gte('pair_count', 3)
    .order('lift_score', { ascending: false })
    .limit(30);

  if (pairs) {
    for (const pair of pairs) {
      const aNorm = normalizeItem(pair.item_a);
      const bNorm = normalizeItem(pair.item_b);

      if (cartNorm.includes(aNorm) && !seenItems.has(bNorm)) {
        seenItems.add(bNorm);
        suggestions.push({
          suggested_item: pair.item_b,
          headline:       'Wird oft zusammen bestellt',
          badge:          null,
          extra_fee_eur:  0,
          source:         'analytics',
          rule_id:        null,
          confidence:     Number(pair.confidence_ab),
          lift_score:     Number(pair.lift_score),
        });
      } else if (cartNorm.includes(bNorm) && !seenItems.has(aNorm)) {
        seenItems.add(aNorm);
        suggestions.push({
          suggested_item: pair.item_a,
          headline:       'Wird oft zusammen bestellt',
          badge:          null,
          extra_fee_eur:  0,
          source:         'analytics',
          rule_id:        null,
          confidence:     Number(pair.confidence_ba),
          lift_score:     Number(pair.lift_score),
        });
      }

      if (suggestions.length >= limit) break;
    }
  }

  return suggestions.slice(0, limit);
}

// ── Impression & Conversion Tracking ──────────────────────────────────────────

export async function recordImpression(
  locationId: string,
  suggestions: UpsellSuggestion[],
  cartItems: string[],
  orderId?: string,
): Promise<string[]> {
  if (suggestions.length === 0) return [];
  const sb = createServiceClient();
  const ruleIds = suggestions
    .filter(s => s.rule_id != null)
    .map(s => s.rule_id as string);

  const rows = suggestions.map(s => ({
    location_id:    locationId,
    order_id:       orderId ?? null,
    rule_id:        s.rule_id,
    suggested_item: s.suggested_item,
    cart_items:     cartItems,
    converted:      false,
  }));

  const { data } = await sb
    .from('upsell_impressions')
    .insert(rows)
    .select('id')
    .catch(() => ({ data: null }));

  // Increment daily + total impression counters on matched rules
  for (const rid of ruleIds) {
    const { data: rule } = await sb
      .from('upsell_rules')
      .select('impressions_today, total_impressions')
      .eq('id', rid)
      .maybeSingle()
      .catch(() => ({ data: null }));
    if (rule) {
      await sb
        .from('upsell_rules')
        .update({
          impressions_today: (rule.impressions_today ?? 0) + 1,
          total_impressions: (rule.total_impressions ?? 0) + 1,
        })
        .eq('id', rid)
        .catch(() => null);
    }
  }

  return data?.map((r: { id: string }) => r.id) ?? [];
}

export async function recordConversion(
  impressionId: string,
  revenueEur: number,
): Promise<void> {
  const sb = createServiceClient();
  const { data: imp } = await sb
    .from('upsell_impressions')
    .update({ converted: true, revenue_lift_eur: revenueEur })
    .eq('id', impressionId)
    .select('rule_id')
    .maybeSingle()
    .catch(() => ({ data: null }));

  if (imp?.rule_id) {
    // Increment conversion counter on rule directly
    const { data: rule } = await sb
      .from('upsell_rules')
      .select('total_conversions')
      .eq('id', imp.rule_id)
      .maybeSingle();
    if (rule) {
      await sb
        .from('upsell_rules')
        .update({ total_conversions: (rule.total_conversions ?? 0) + 1 })
        .eq('id', imp.rule_id);
    }
  }
}

// ── Rule CRUD ─────────────────────────────────────────────────────────────────

export async function getRules(locationId: string): Promise<UpsellRule[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('upsell_rules')
    .select('*')
    .eq('location_id', locationId)
    .order('priority', { ascending: false });
  return (data ?? []) as UpsellRule[];
}

export async function createRule(
  locationId: string,
  params: {
    name: string;
    trigger_item: string;
    suggested_item: string;
    headline?: string;
    badge?: string;
    extra_fee_eur?: number;
    priority?: number;
    max_per_day?: number | null;
  },
): Promise<UpsellRule> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('upsell_rules')
    .insert({
      location_id:    locationId,
      name:           params.name,
      trigger_item:   params.trigger_item,
      suggested_item: params.suggested_item,
      headline:       params.headline ?? null,
      badge:          params.badge ?? null,
      extra_fee_eur:  params.extra_fee_eur ?? 0,
      priority:       params.priority ?? 0,
      max_per_day:    params.max_per_day ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as UpsellRule;
}

export async function updateRule(
  ruleId: string,
  updates: Partial<Pick<UpsellRule, 'name' | 'trigger_item' | 'suggested_item' | 'headline' | 'badge' | 'extra_fee_eur' | 'is_active' | 'priority' | 'max_per_day'>>,
): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('upsell_rules')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', ruleId);
  if (error) throw new Error(error.message);
}

export async function deleteRule(ruleId: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('upsell_rules')
    .delete()
    .eq('id', ruleId);
  if (error) throw new Error(error.message);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboard(locationId: string): Promise<UpsellDashboard> {
  const sb = createServiceClient();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [pairsRes, rulesRes, impressionsRes, perfRes] = await Promise.all([
    sb.from('upsell_item_pairs')
      .select('id, item_a, item_b, pair_count, confidence_ab, confidence_ba, lift_score, support_score, order_count_a, order_count_b, total_orders, last_rebuilt_at', { count: 'exact' })
      .eq('location_id', locationId)
      .gte('pair_count', 2)
      .order('lift_score', { ascending: false })
      .limit(10),
    sb.from('upsell_rules')
      .select('id, is_active', { count: 'exact' })
      .eq('location_id', locationId),
    sb.from('upsell_impressions')
      .select('converted, revenue_lift_eur')
      .eq('location_id', locationId)
      .gte('created_at', since30),
    sb.from('v_upsell_performance')
      .select('rule_id, name, trigger_item, suggested_item, is_active, total_impressions, total_conversions, conversion_rate_pct, total_revenue_lift_eur, last_impression_at')
      .eq('location_id', locationId)
      .order('total_impressions', { ascending: false })
      .limit(20),
  ]);

  const impressions = impressionsRes.data ?? [];
  const totalImpressions = impressions.length;
  const totalConversions = impressions.filter(i => i.converted).length;
  const totalRevenue = impressions
    .filter(i => i.converted && i.revenue_lift_eur != null)
    .reduce((s, i) => s + Number(i.revenue_lift_eur), 0);

  const rules = rulesRes.data ?? [];
  const lastRebuilt = pairsRes.data?.[0]?.last_rebuilt_at ?? null;

  return {
    total_pairs:             pairsRes.count ?? 0,
    total_rules:             rulesRes.count ?? 0,
    active_rules:            rules.filter(r => r.is_active).length,
    total_impressions_30d:   totalImpressions,
    total_conversions_30d:   totalConversions,
    conversion_rate_pct:     totalImpressions > 0
      ? Math.round(totalConversions / totalImpressions * 10000) / 100
      : 0,
    total_revenue_lift_eur:  Math.round(totalRevenue * 100) / 100,
    top_pairs:               (pairsRes.data ?? []) as UpsellPair[],
    rule_performance:        (perfRes.data ?? []) as unknown as RulePerformance[],
    last_rebuilt_at:         lastRebuilt,
  };
}

export async function getTopPairs(locationId: string, limit = 20): Promise<UpsellPair[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('upsell_item_pairs')
    .select('*')
    .eq('location_id', locationId)
    .gte('pair_count', 2)
    .order('lift_score', { ascending: false })
    .limit(limit);
  return (data ?? []) as UpsellPair[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeItem(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Extracts item names from the `artikel` JSON field of customer_orders.
 * Handles both array-of-objects [{name, ...}] and flat string arrays.
 */
function extractItemNames(artikel: unknown): string[] {
  if (!artikel) return [];
  const arr = Array.isArray(artikel) ? artikel : [];
  const names: string[] = [];
  for (const item of arr) {
    if (typeof item === 'string') {
      names.push(item);
    } else if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      const name = obj['name'] ?? obj['artikel'] ?? obj['item'] ?? obj['titel'];
      if (typeof name === 'string' && name.trim()) names.push(name.trim());
    }
  }
  return names.filter(n => n.length > 0);
}
