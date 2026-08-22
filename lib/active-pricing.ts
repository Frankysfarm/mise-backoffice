/**
 * Active-Pricing-Helper für Mise.
 *
 * Findet das gerade aktive Order-Profil + alle aktiven Price-Lists und berechnet
 * den finalen Preis pro Menu-Item. Wird sowohl von Server-Components (Storefront,
 * POS-Server-Side) als auch von Client-Components (POS-Terminal-UI) genutzt.
 *
 * **Reihenfolge der Anwendung:**
 * 1. Basispreis aus `menu_items.preis`
 * 2. Falls Override-Preis in einer aktiven Price-List → der gewinnt (höchste Priorität zuerst)
 * 3. Falls Rabatt/Aufschlag-Listen aktiv → kumulativ multipliziert
 * 4. Falls Order-Profile-Modifier (`preis_modifier_pct`) → final draufgerechnet
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface OrderProfile {
  id: string;
  tenant_id: string;
  location_id: string | null;
  name: string;
  type: string;
  zeit_aktiv: boolean;
  wochentage: number[];
  start_zeit: string | null;
  end_zeit: string | null;
  preis_modifier_pct: number;
  service_charge_pct: number;
  steuersatz_strategie: string;
  farbe: string | null;
  is_default: boolean;
  aktiv: boolean;
}

export interface PriceList {
  id: string;
  tenant_id: string;
  location_id: string | null;
  name: string;
  zeit_aktiv: boolean;
  wochentage: number[];
  start_zeit: string | null;
  end_zeit: string | null;
  profile_id: string | null;
  modus: 'override' | 'rabatt_pct' | 'aufschlag_pct';
  rabatt_pct: number | null;
  aufschlag_pct: number | null;
  prioritaet: number;
  aktiv: boolean;
}

export interface PriceListItem {
  price_list_id: string;
  menu_item_id: string;
  preis: number;
}

/** Ist eine Profile/Liste gerade aktiv basierend auf jetzigem Datum? */
export function isScheduleActive(
  zeit_aktiv: boolean,
  wochentage: number[],
  start_zeit: string | null,
  end_zeit: string | null,
  now: Date = new Date(),
): boolean {
  if (!zeit_aktiv) return true;
  // 0=Sonntag in JS, wir nutzen 1=Mo..7=So
  const jsDow = now.getDay();
  const dow = jsDow === 0 ? 7 : jsDow;
  if (!wochentage.includes(dow)) return false;
  if (!start_zeit || !end_zeit) return true;
  const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  return hhmm >= start_zeit.slice(0,5) && hhmm <= end_zeit.slice(0,5);
}

/**
 * Lade das aktive Order-Profile.
 * - Wenn `prefer_type` gesetzt: bevorzugt Profile dieses Typs
 * - Sonst: das `is_default`-Profile
 * - Sonst: das erste `aktiv`-Profile
 */
export async function getActiveProfile(
  svc: SupabaseClient,
  tenantId: string,
  locationId: string,
  preferType?: string,
  now: Date = new Date(),
): Promise<OrderProfile | null> {
  const { data } = await svc.from('order_profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`location_id.eq.${locationId},location_id.is.null`)
    .eq('aktiv', true)
    .order('sort_order');
  const profiles = (data as OrderProfile[]) ?? [];
  if (profiles.length === 0) return null;

  const matchTime = profiles.filter((p) =>
    isScheduleActive(p.zeit_aktiv, p.wochentage, p.start_zeit, p.end_zeit, now),
  );
  if (matchTime.length === 0) return profiles.find((p) => p.is_default) ?? profiles[0];

  if (preferType) {
    const exact = matchTime.find((p) => p.type === preferType);
    if (exact) return exact;
  }
  return matchTime.find((p) => p.is_default) ?? matchTime[0];
}

/** Lade alle aktiven Price-Lists, sortiert nach Priorität absteigend (höchste zuerst). */
export async function getActivePriceLists(
  svc: SupabaseClient,
  tenantId: string,
  locationId: string,
  profileId: string | null = null,
  now: Date = new Date(),
): Promise<PriceList[]> {
  const { data } = await svc.from('price_lists')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`location_id.eq.${locationId},location_id.is.null`)
    .eq('aktiv', true)
    .order('prioritaet', { ascending: false });
  const lists = (data as PriceList[]) ?? [];

  return lists.filter((l) => {
    if (l.profile_id && l.profile_id !== profileId) return false;
    return isScheduleActive(l.zeit_aktiv, l.wochentage, l.start_zeit, l.end_zeit, now);
  });
}

/** Lade Override-Preise für eine Price-List + Set von Item-IDs. */
export async function getOverridePrices(
  svc: SupabaseClient,
  priceListIds: string[],
): Promise<Map<string, Map<string, number>>> {
  if (priceListIds.length === 0) return new Map();
  const { data } = await svc.from('price_list_items')
    .select('price_list_id, menu_item_id, preis')
    .in('price_list_id', priceListIds);
  const items = (data as PriceListItem[]) ?? [];
  const byList = new Map<string, Map<string, number>>();
  for (const it of items) {
    if (!byList.has(it.price_list_id)) byList.set(it.price_list_id, new Map());
    byList.get(it.price_list_id)!.set(it.menu_item_id, Number(it.preis));
  }
  return byList;
}

/** Berechne den finalen Preis für ein Item basierend auf aktivem Profil + Listen. */
export function computeItemPrice(args: {
  itemId: string;
  basePrice: number;
  activeProfile: OrderProfile | null;
  activeLists: PriceList[];
  overridesByList: Map<string, Map<string, number>>;
}): { final: number; explanation: string[] } {
  const { itemId, basePrice, activeProfile, activeLists, overridesByList } = args;
  const trace: string[] = [`Basispreis: ${basePrice.toFixed(2)} €`];
  let price = basePrice;

  // 1. Override aus höchst-priorisierter Liste
  for (const list of activeLists) {
    if (list.modus !== 'override') continue;
    const override = overridesByList.get(list.id)?.get(itemId);
    if (override !== undefined) {
      trace.push(`Override aus „${list.name}" (Prio ${list.prioritaet}): ${override.toFixed(2)} €`);
      price = override;
      break;
    }
  }

  // 2. Rabatt/Aufschlag-Listen kumulativ (höchste Prio zuerst)
  for (const list of activeLists) {
    if (list.modus === 'rabatt_pct' && list.rabatt_pct) {
      const factor = 1 - list.rabatt_pct / 100;
      const before = price;
      price = Math.max(0, price * factor);
      trace.push(`Rabatt „${list.name}" −${list.rabatt_pct}%: ${before.toFixed(2)} → ${price.toFixed(2)} €`);
    } else if (list.modus === 'aufschlag_pct' && list.aufschlag_pct) {
      const factor = 1 + list.aufschlag_pct / 100;
      const before = price;
      price = price * factor;
      trace.push(`Aufschlag „${list.name}" +${list.aufschlag_pct}%: ${before.toFixed(2)} → ${price.toFixed(2)} €`);
    }
  }

  // 3. Profile-Modifier (final draufgerechnet)
  if (activeProfile && activeProfile.preis_modifier_pct !== 0) {
    const factor = 1 + activeProfile.preis_modifier_pct / 100;
    const before = price;
    price = Math.max(0, price * factor);
    trace.push(`Profil „${activeProfile.name}" ${activeProfile.preis_modifier_pct > 0 ? '+' : ''}${activeProfile.preis_modifier_pct}%: ${before.toFixed(2)} → ${price.toFixed(2)} €`);
  }

  return { final: Math.round(price * 100) / 100, explanation: trace };
}

/** Convenience: Liefere Pricing-Context (Profile + Lists + Overrides) für eine Location/Profil. */
export async function loadPricingContext(
  svc: SupabaseClient,
  tenantId: string,
  locationId: string,
  preferProfileType?: string,
  now: Date = new Date(),
): Promise<{
  profile: OrderProfile | null;
  lists: PriceList[];
  overridesByList: Map<string, Map<string, number>>;
}> {
  const profile = await getActiveProfile(svc, tenantId, locationId, preferProfileType, now);
  const lists = await getActivePriceLists(svc, tenantId, locationId, profile?.id ?? null, now);
  const overridesByList = await getOverridePrices(svc, lists.filter((l) => l.modus === 'override').map((l) => l.id));
  return { profile, lists, overridesByList };
}
