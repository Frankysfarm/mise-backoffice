/**
 * lib/delivery/reorder-engine-v2.ts
 *
 * Phase 302 — Smart-Reorder-Engine V2 mit Saisonalität
 *
 * Erweitert die V1-Engine (reorder-engine.ts) um:
 *   - Stunden- und Wochentagsmuster (wann bestellt der Kunde?)
 *   - Monatliche Saisonalität (saisonale Boost-Faktoren)
 *   - Recency-Decay-Score (frische Bestellungen höher gewichtet)
 *   - Artikel-Kombinations-Affinität (häufige Bundles)
 *   - Composite V2-Score für bessere Ranking-Qualität
 *
 * Public API:
 *  buildV2ProfileForCustomer(locationId, phone)      — V2-Profil für einen Kunden
 *  buildV2ProfilesForLocation(locationId)            — Batch für eine Location
 *  buildV2ProfilesAllLocations()                     — Cron-Batch
 *  getReorderSuggestionsV2(locationId, phone, n?)    — Scored V2-Vorschläge
 *  getReorderSuggestionsV2ByToken(token, n?)         — Öffentlich via Rating-Token
 *  buildLocationSeasonalPatterns(locationId)         — Saisonmuster berechnen
 *  getSeasonalBoostFactor(locationId, month)         — Boost-Faktor für aktuellen Monat
 *  getReorderDashboardV2(locationId)                 — Admin-Dashboard V2
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface ReorderItemV2 {
  name:           string;
  count:          number;
  revenue_eur:    number;
  last_ordered:   string | null;
  score:          number;   // 0–100 composite score
}

export interface ItemCombo {
  items: string[];
  count: number;
}

export interface V2CustomerProfile {
  id:                  string;
  locationId:          string;
  customerPhone:       string;
  customerName:        string | null;
  totalOrders:         number;
  totalSpentEur:       number;
  lastOrderAt:         string | null;
  preferredHour:       number | null;
  topItems:            ReorderItemV2[];
  hourPattern:         Record<string, number>;   // "0"–"23"
  dayPattern:          Record<string, number>;   // "0"=Sonntag–"6"=Samstag
  monthPattern:        Record<string, number>;   // "1"–"12"
  topCombos:           ItemCombo[];
  recencyScore:        number;    // 0–1
  v2Score:             number;    // 0–100
  v2ComputedAt:        string | null;
}

export interface ReorderSuggestionV2 {
  itemName:          string;
  orderCount:        number;
  revenueEur:        number;
  lastOrderedAt:     string | null;
  score:             number;
  seasonalBoost:     number;     // 1.0 = normal, >1.0 = saisonaler Lift
  timeOfDayBoost:    number;
  dayOfWeekBoost:    number;
  rank:              number;
}

export interface SeasonalPattern {
  locationId:    string;
  month:         number;
  year:          number;
  totalOrders:   number;
  totalRevenue:  number;
  avgDailyOrders: number | null;
  topItems:      { name: string; count: number }[];
}

export interface ReorderDashboardV2 {
  locationId:          string;
  currentMonthBoost:   number;
  topScoredCustomers: {
    phone:       string;
    name:        string | null;
    v2Score:     number;
    recencyScore: number;
    totalOrders:  number;
  }[];
  seasonalPatterns:    SeasonalPattern[];
  generatedAt:         string;
}

// ── DB-Row-Typen ───────────────────────────────────────────────────────────────

interface OrderRow {
  id:           string;
  bestellt_am:  string | null;
  gesamtbetrag: number | null;
  items:        { name: string; quantity?: number; preis_eur?: number }[] | null;
}

interface ProfileRow {
  id:             string;
  customer_phone: string;
  customer_name:  string | null;
  total_orders:   number;
  total_spent_eur: number;
  last_order_at:  string | null;
  preferred_hour: number | null;
  top_items:      unknown;
  hour_pattern:   unknown;
  day_pattern:    unknown;
  month_pattern:  unknown;
  top_combos:     unknown;
  recency_score:  number | null;
  v2_computed_at: string | null;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function recencyScore(lastOrderAt: string | null): number {
  if (!lastOrderAt) return 0;
  const daysSince = (Date.now() - new Date(lastOrderAt).getTime()) / 86_400_000;
  if (daysSince <= 7)  return 1.0;
  if (daysSince <= 14) return 0.85;
  if (daysSince <= 30) return 0.65;
  if (daysSince <= 60) return 0.4;
  if (daysSince <= 90) return 0.2;
  return 0.05;
}

function buildPatterns(orders: OrderRow[]): {
  hourPattern:  Record<string, number>;
  dayPattern:   Record<string, number>;
  monthPattern: Record<string, number>;
} {
  const hour:  Record<string, number> = {};
  const day:   Record<string, number> = {};
  const month: Record<string, number> = {};

  for (const o of orders) {
    if (!o.bestellt_am) continue;
    const d = new Date(o.bestellt_am);
    const h = String(d.getUTCHours());
    const wd = String(d.getUTCDay());
    const mo = String(d.getUTCMonth() + 1);
    hour[h]  = (hour[h]  ?? 0) + 1;
    day[wd]  = (day[wd]  ?? 0) + 1;
    month[mo] = (month[mo] ?? 0) + 1;
  }

  return { hourPattern: hour, dayPattern: day, monthPattern: month };
}

function buildTopItems(orders: OrderRow[]): ReorderItemV2[] {
  const map = new Map<string, { count: number; revenue: number; lastOrdered: string | null }>();

  for (const o of orders) {
    const items = o.items ?? [];
    for (const item of items) {
      const name = item.name?.trim();
      if (!name) continue;
      const existing = map.get(name) ?? { count: 0, revenue: 0, lastOrdered: null };
      const qty = item.quantity ?? 1;
      existing.count += qty;
      existing.revenue += (item.preis_eur ?? 0) * qty;
      const ordAt = o.bestellt_am;
      if (ordAt && (!existing.lastOrdered || ordAt > existing.lastOrdered)) {
        existing.lastOrdered = ordAt;
      }
      map.set(name, existing);
    }
  }

  const ranked = [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const maxCount = ranked[0]?.count ?? 1;

  return ranked.map((item) => ({
    name:         item.name,
    count:        item.count,
    revenue_eur:  Math.round(item.revenue * 100) / 100,
    last_ordered: item.lastOrdered,
    score:        Math.round((item.count / maxCount) * 100),
  }));
}

function buildTopCombos(orders: OrderRow[]): ItemCombo[] {
  const comboMap = new Map<string, number>();

  for (const o of orders) {
    const items = (o.items ?? []).map((i) => i.name?.trim()).filter(Boolean) as string[];
    if (items.length < 2) continue;

    // Alle Paare aus der Bestellung
    const unique = [...new Set(items)].sort();
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const key = `${unique[i]}|||${unique[j]}`;
        comboMap.set(key, (comboMap.get(key) ?? 0) + 1);
      }
    }
  }

  return [...comboMap.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([key, count]) => ({ items: key.split('|||'), count }));
}

// ── V2-Profil aufbauen ────────────────────────────────────────────────────────

export async function buildV2ProfileForCustomer(
  locationId: string,
  phone: string,
): Promise<{ updated: boolean }> {
  const svc = createServiceClient();

  // Alle Bestellungen des Kunden mit Artikel-Details
  const { data: orders } = await svc
    .from('customer_orders')
    .select('id, bestellt_am, gesamtbetrag, items:customer_order_items(name, quantity, preis_eur)')
    .eq('location_id', locationId)
    .eq('kunde_telefon', phone)
    .not('bestellt_am', 'is', null)
    .order('bestellt_am', { ascending: false })
    .limit(200);

  if (!orders || orders.length === 0) return { updated: false };

  const typedOrders = orders as unknown as OrderRow[];
  const lastOrderAt = typedOrders[0]?.bestellt_am ?? null;
  const patterns    = buildPatterns(typedOrders);
  const topItems    = buildTopItems(typedOrders);
  const topCombos   = buildTopCombos(typedOrders);
  const rScore      = recencyScore(lastOrderAt);

  await svc
    .from('customer_reorder_profiles')
    .update({
      hour_pattern:   patterns.hourPattern,
      day_pattern:    patterns.dayPattern,
      month_pattern:  patterns.monthPattern,
      top_combos:     topCombos,
      recency_score:  rScore,
      v2_computed_at: new Date().toISOString(),
    })
    .eq('location_id', locationId)
    .eq('customer_phone', phone);

  return { updated: true };
}

export async function buildV2ProfilesForLocation(locationId: string): Promise<{
  locationId:      string;
  profilesUpdated: number;
  errors:          number;
}> {
  const svc = createServiceClient();
  const { data: profiles } = await svc
    .from('customer_reorder_profiles')
    .select('customer_phone')
    .eq('location_id', locationId);

  if (!profiles || profiles.length === 0) return { locationId, profilesUpdated: 0, errors: 0 };

  let profilesUpdated = 0;
  let errors = 0;

  for (const p of profiles) {
    try {
      const res = await buildV2ProfileForCustomer(locationId, p.customer_phone as string);
      if (res.updated) profilesUpdated++;
    } catch {
      errors++;
    }
  }

  return { locationId, profilesUpdated, errors };
}

export async function buildV2ProfilesAllLocations(): Promise<{
  locations:       number;
  profilesUpdated: number;
  errors:          number;
}> {
  const svc = createServiceClient();
  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locs || locs.length === 0) return { locations: 0, profilesUpdated: 0, errors: 0 };

  const results = await Promise.all(
    locs.map((l) => buildV2ProfilesForLocation(l.id as string).catch(() => null)),
  );

  return {
    locations:       locs.length,
    profilesUpdated: results.reduce((s, r) => s + (r?.profilesUpdated ?? 0), 0),
    errors:          results.reduce((s, r) => s + (r?.errors ?? 0), 0),
  };
}

// ── Saisonale Location-Muster berechnen ───────────────────────────────────────

export async function buildLocationSeasonalPatterns(locationId: string): Promise<void> {
  const svc = createServiceClient();
  const now = new Date();

  // Letzten 12 Monate
  for (let mOffset = 0; mOffset < 12; mOffset++) {
    const d = new Date(now.getFullYear(), now.getMonth() - mOffset, 1);
    const year  = d.getFullYear();
    const month = d.getMonth() + 1;
    const from  = new Date(year, month - 1, 1).toISOString();
    const to    = new Date(year, month, 1).toISOString();

    const { data: orders } = await svc
      .from('customer_orders')
      .select('id, gesamtbetrag, items:customer_order_items(name, quantity)')
      .eq('location_id', locationId)
      .gte('bestellt_am', from)
      .lt('bestellt_am', to);

    if (!orders || orders.length === 0) continue;

    const daysInMonth = new Date(year, month, 0).getDate();
    const itemCounts  = new Map<string, number>();

    for (const o of orders as unknown as OrderRow[]) {
      for (const item of o.items ?? []) {
        const n = item.name?.trim();
        if (n) itemCounts.set(n, (itemCounts.get(n) ?? 0) + (item.quantity ?? 1));
      }
    }

    const topItems = [...itemCounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const totalRevenue = (orders as unknown as OrderRow[]).reduce(
      (s, o) => s + (o.gesamtbetrag ?? 0), 0,
    );

    await svc
      .from('location_seasonal_patterns')
      .upsert({
        location_id:      locationId,
        month,
        year,
        total_orders:     orders.length,
        total_revenue:    Math.round(totalRevenue * 100) / 100,
        avg_daily_orders: Math.round((orders.length / daysInMonth) * 10) / 10,
        top_items:        topItems,
        computed_at:      new Date().toISOString(),
      }, { onConflict: 'location_id,year,month' });
  }
}

// ── Saisonaler Boost-Faktor ───────────────────────────────────────────────────

export async function getSeasonalBoostFactor(
  locationId: string,
  month: number,
): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('location_seasonal_patterns')
    .select('avg_daily_orders')
    .eq('location_id', locationId)
    .order('year', { ascending: false })
    .limit(12);

  if (!data || data.length < 3) return 1.0;

  const avg = data.reduce((s, r) => s + Number(r.avg_daily_orders ?? 0), 0) / data.length;
  if (avg <= 0) return 1.0;

  // Aktueller Monat vs. Durchschnitt
  const { data: current } = await svc
    .from('location_seasonal_patterns')
    .select('avg_daily_orders')
    .eq('location_id', locationId)
    .eq('month', month)
    .order('year', { ascending: false })
    .limit(2);

  if (!current || current.length === 0) return 1.0;
  const monthAvg = current.reduce((s, r) => s + Number(r.avg_daily_orders ?? 0), 0) / current.length;

  // Boost: 0.7–1.5 (capped)
  return Math.min(Math.max(monthAvg / avg, 0.7), 1.5);
}

// ── V2-Empfehlungen für Kunden ─────────────────────────────────────────────────

export async function getReorderSuggestionsV2(
  locationId: string,
  phone: string,
  limit = 5,
): Promise<ReorderSuggestionV2[]> {
  const svc = createServiceClient();
  const now = new Date();

  const [profileRes, seasonBoost] = await Promise.all([
    svc
      .from('customer_reorder_profiles')
      .select('top_items, last_order_at, hour_pattern, day_pattern, recency_score')
      .eq('location_id', locationId)
      .eq('customer_phone', phone)
      .maybeSingle(),
    getSeasonalBoostFactor(locationId, now.getUTCMonth() + 1),
  ]);

  if (!profileRes.data) return [];

  const profile    = profileRes.data as ProfileRow;
  const topItems   = (profile.top_items as ReorderItemV2[] | null) ?? [];
  const hourPat    = (profile.hour_pattern as Record<string, number> | null) ?? {};
  const dayPat     = (profile.day_pattern  as Record<string, number> | null) ?? {};
  const rScore     = profile.recency_score ?? 0.5;

  // Tageszeit-Boost: Aktuell-Stunde vs. Profil
  const currentHour = String(now.getUTCHours());
  const hourTotal   = Object.values(hourPat).reduce((s, v) => s + v, 0) || 1;
  const hourShare   = (hourPat[currentHour] ?? 0) / hourTotal;
  const timeOfDayBoost = 1.0 + hourShare * 0.5; // max +50% wenn typische Bestellstunde

  // Wochentag-Boost
  const currentDay  = String(now.getUTCDay());
  const dayTotal    = Object.values(dayPat).reduce((s, v) => s + v, 0) || 1;
  const dayShare    = (dayPat[currentDay] ?? 0) / dayTotal;
  const dayOfWeekBoost = 1.0 + dayShare * 0.4; // max +40% wenn typischer Bestelltag

  const suggestions: ReorderSuggestionV2[] = topItems.slice(0, limit * 2).map((item, idx) => {
    const composite =
      item.score * 0.5        // Basis-Frequenz-Score
      + rScore * 30            // Recency-Faktor (0–30 Punkte)
      + (1 - idx / (topItems.length || 1)) * 20; // Rang-Bonus

    return {
      itemName:       item.name,
      orderCount:     item.count,
      revenueEur:     item.revenue_eur,
      lastOrderedAt:  item.last_ordered ?? null,
      score:          Math.round(composite * seasonBoost * timeOfDayBoost * dayOfWeekBoost),
      seasonalBoost:  Math.round(seasonBoost * 100) / 100,
      timeOfDayBoost: Math.round(timeOfDayBoost * 100) / 100,
      dayOfWeekBoost: Math.round(dayOfWeekBoost * 100) / 100,
      rank:           idx + 1,
    };
  });

  // Sortieren nach finalem Score
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

// ── V2 via Rating-Token (öffentlicher Endpoint) ───────────────────────────────

export async function getReorderSuggestionsV2ByToken(
  ratingToken: string,
  limit = 5,
): Promise<{
  suggestions:    ReorderSuggestionV2[];
  locationId:     string;
  phone:          string;
  seasonalBoost:  number;
} | null> {
  const svc = createServiceClient();
  const { data: order } = await svc
    .from('customer_orders')
    .select('location_id, kunde_telefon')
    .eq('rating_token', ratingToken)
    .maybeSingle();

  if (!order?.location_id || !order?.kunde_telefon) return null;

  const locationId = order.location_id as string;
  const phone      = order.kunde_telefon as string;
  const now        = new Date();

  const [suggestions, seasonalBoost] = await Promise.all([
    getReorderSuggestionsV2(locationId, phone, limit),
    getSeasonalBoostFactor(locationId, now.getUTCMonth() + 1),
  ]);

  return { suggestions, locationId, phone, seasonalBoost };
}

// ── Admin-Dashboard V2 ─────────────────────────────────────────────────────────

export async function getReorderDashboardV2(locationId: string): Promise<ReorderDashboardV2> {
  const svc = createServiceClient();
  const now = new Date();

  const [seasonBoost, topCustomers, patterns] = await Promise.all([
    getSeasonalBoostFactor(locationId, now.getUTCMonth() + 1),
    svc
      .from('v_reorder_v2_scores')
      .select('customer_phone, customer_name, v2_score, recency_score, total_orders')
      .eq('location_id', locationId)
      .not('v2_score', 'is', null)
      .order('v2_score', { ascending: false })
      .limit(20),
    svc
      .from('location_seasonal_patterns')
      .select('month, year, total_orders, total_revenue, avg_daily_orders, top_items')
      .eq('location_id', locationId)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(12),
  ]);

  return {
    locationId,
    currentMonthBoost: Math.round(seasonBoost * 100) / 100,
    topScoredCustomers: (topCustomers.data ?? []).map((r) => ({
      phone:        r.customer_phone as string,
      name:         r.customer_name as string | null,
      v2Score:      Number(r.v2_score ?? 0),
      recencyScore: Number(r.recency_score ?? 0),
      totalOrders:  Number(r.total_orders ?? 0),
    })),
    seasonalPatterns: (patterns.data ?? []).map((r) => ({
      locationId,
      month:          Number(r.month),
      year:           Number(r.year),
      totalOrders:    Number(r.total_orders),
      totalRevenue:   Number(r.total_revenue),
      avgDailyOrders: r.avg_daily_orders != null ? Number(r.avg_daily_orders) : null,
      topItems:       (r.top_items as { name: string; count: number }[]) ?? [],
    })),
    generatedAt: new Date().toISOString(),
  };
}
