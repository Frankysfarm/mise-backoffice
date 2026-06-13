/**
 * lib/delivery/address-intelligence.ts
 *
 * Smart Customer Address Intelligence Engine.
 *
 * Speichert Zustellpräferenzen pro Kunde+Adresse und trackt Problem-Adressen.
 * Fahrer sehen Lieferhinweise prominent in der App.
 * Admin sieht Problem-Adressen mit Häufigkeits-Analyse.
 */
import 'server-only';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typen ──────────────────────────────────────────────────────────────────

export type IssueType =
  | 'unreachable'
  | 'wrong_address'
  | 'no_answer'
  | 'access_denied'
  | 'unsafe'
  | 'other';

export interface AddressPreferences {
  id: string;
  locationId: string;
  customerEmail: string;
  addressHash: string;
  addressLabel: string | null;
  addressDisplay: string | null;
  ringBell: boolean;
  leaveAtDoor: boolean;
  floor: string | null;
  apartment: string | null;
  gateCode: string | null;
  buildingInfo: string | null;
  specialInstructions: string | null;
  useCount: number;
  lastUsedAt: string;
  createdAt: string;
}

export interface AddressPreferencesInput {
  customerEmail: string;
  addressHash: string;
  addressDisplay?: string;
  addressLabel?: string;
  ringBell?: boolean;
  leaveAtDoor?: boolean;
  floor?: string;
  apartment?: string;
  gateCode?: string;
  buildingInfo?: string;
  specialInstructions?: string;
}

export interface AddressIssue {
  id: string;
  locationId: string;
  addressHash: string;
  addressDisplay: string | null;
  orderId: string | null;
  driverId: string | null;
  issueType: IssueType;
  driverNotes: string | null;
  resolved: boolean;
  createdAt: string;
}

export interface ProblematicAddress {
  locationId: string;
  addressHash: string;
  addressDisplay: string | null;
  issueCount: number;
  affectedOrders: number;
  issueTypes: IssueType[];
  lastIssueAt: string;
  firstIssueAt: string;
  qualityScore: number; // 0–100, 100 = keine Probleme
}

export interface AddressIntelligenceStats {
  locationId: string;
  totalSavedAddresses: number;
  problematicAddresses: number;
  issuesToday: number;
  issuesThisWeek: number;
  customersWithPrefs: number;
  pctWithSpecialInstructions: number;
}

export interface AddressIntelligenceDashboard {
  stats: AddressIntelligenceStats;
  problematicAddresses: ProblematicAddress[];
  recentIssues: AddressIssue[];
}

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

/** Normalisiert und hasht eine Adresse für konsistente Lookups. */
export function hashAddress(address: string): string {
  const normalized = address
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
    .trim();
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

/** Berechnet Quality-Score aus Issue-Anzahl. */
function computeQualityScore(issueCount: number): number {
  if (issueCount === 0) return 100;
  if (issueCount === 1) return 70;
  if (issueCount === 2) return 45;
  if (issueCount === 3) return 25;
  return Math.max(0, 15 - issueCount * 3);
}

// ─── Präferenzen verwalten ──────────────────────────────────────────────────

/** Präferenzen für eine Adresse laden. Null wenn keine vorhanden. */
export async function getAddressPreferences(
  customerEmail: string,
  addressHash: string,
  locationId: string,
): Promise<AddressPreferences | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('customer_address_preferences')
    .select('*')
    .eq('location_id', locationId)
    .eq('customer_email', customerEmail.toLowerCase().trim())
    .eq('address_hash', addressHash)
    .maybeSingle();

  if (!data) return null;
  return mapPrefs(data);
}

/** Alle gespeicherten Adressen eines Kunden laden. */
export async function getCustomerAddresses(
  customerEmail: string,
  locationId: string,
): Promise<AddressPreferences[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('customer_address_preferences')
    .select('*')
    .eq('location_id', locationId)
    .eq('customer_email', customerEmail.toLowerCase().trim())
    .order('last_used_at', { ascending: false })
    .limit(10);

  return (data ?? []).map(mapPrefs);
}

/** Präferenzen speichern oder aktualisieren (Upsert). */
export async function saveAddressPreferences(
  locationId: string,
  input: AddressPreferencesInput,
): Promise<AddressPreferences> {
  const sb = createServiceClient();
  const email = input.customerEmail.toLowerCase().trim();

  const { data, error } = await sb
    .from('customer_address_preferences')
    .upsert(
      {
        location_id: locationId,
        customer_email: email,
        address_hash: input.addressHash,
        address_display: input.addressDisplay ?? null,
        address_label: input.addressLabel ?? null,
        ring_bell: input.ringBell ?? true,
        leave_at_door: input.leaveAtDoor ?? false,
        floor: input.floor ?? null,
        apartment: input.apartment ?? null,
        gate_code: input.gateCode ?? null,
        building_info: input.buildingInfo ?? null,
        special_instructions: input.specialInstructions ?? null,
        updated_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'location_id,customer_email,address_hash' },
    )
    .select()
    .single();

  if (error) throw new Error(`saveAddressPreferences: ${error.message}`);

  // use_count inkrementieren (separates Update, um Race-Conditions zu vermeiden)
  await sb
    .from('customer_address_preferences')
    .update({ use_count: (data.use_count as number) + 1 })
    .eq('id', data.id as string)
    .then(() => {/* fire-and-forget */});

  return mapPrefs(data);
}

/**
 * Präferenzen anhand einer Lieferadresse laden (für Fahrer-App).
 * Liefert Präferenzen wenn vorhanden, sonst Default-Objekt.
 */
export async function getOrderAddressInfo(
  orderId: string,
  locationId: string,
): Promise<{ preferences: AddressPreferences | null; qualityScore: number; issueCount: number }> {
  const sb = createServiceClient();

  // Order laden um Adresse + Kunden-Email zu ermitteln
  const { data: order } = await sb
    .from('customer_orders')
    .select('kunde_email, kunde_adresse, kunde_plz, kunde_stadt')
    .eq('id', orderId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!order) return { preferences: null, qualityScore: 100, issueCount: 0 };

  const addr = [order.kunde_adresse, order.kunde_plz, order.kunde_stadt]
    .filter(Boolean)
    .join(', ');
  const addressHash = hashAddress(addr);

  // Präferenzen + Issue-Count parallel
  const [prefsResult, issueResult] = await Promise.all([
    order.kunde_email
      ? getAddressPreferences(order.kunde_email as string, addressHash, locationId)
      : Promise.resolve(null),
    sb
      .from('delivery_address_issues')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('address_hash', addressHash)
      .eq('resolved', false)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const issueCount = issueResult.count ?? 0;
  return {
    preferences: prefsResult,
    qualityScore: computeQualityScore(issueCount),
    issueCount,
  };
}

// ─── Problem-Adressen ───────────────────────────────────────────────────────

/** Problem-Adresse aufzeichnen (nach fehlgeschlagener Lieferung). */
export async function recordAddressIssue(params: {
  locationId: string;
  orderId: string;
  addressDisplay?: string;
  driverId?: string;
  issueType: IssueType;
  driverNotes?: string;
}): Promise<void> {
  const sb = createServiceClient();

  // Adresse aus Order ermitteln
  const { data: order } = await sb
    .from('customer_orders')
    .select('kunde_adresse, kunde_plz, kunde_stadt')
    .eq('id', params.orderId)
    .maybeSingle();

  const addr = order
    ? [order.kunde_adresse, order.kunde_plz, order.kunde_stadt].filter(Boolean).join(', ')
    : params.addressDisplay ?? '';

  const addressHash = hashAddress(addr);
  const addressDisplay = params.addressDisplay ?? addr;

  await sb.from('delivery_address_issues').insert({
    location_id: params.locationId,
    address_hash: addressHash,
    address_display: addressDisplay || null,
    order_id: params.orderId,
    driver_id: params.driverId ?? null,
    issue_type: params.issueType,
    driver_notes: params.driverNotes ?? null,
  });
}

/** Problem-Adresse als gelöst markieren. */
export async function resolveAddressIssue(issueId: string, locationId: string): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('delivery_address_issues')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', issueId)
    .eq('location_id', locationId);
}

/** Alle problematischen Adressen einer Location laden. */
export async function getProblematicAddresses(
  locationId: string,
  minIssues = 2,
): Promise<ProblematicAddress[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_problematic_addresses')
    .select('*')
    .eq('location_id', locationId);

  return (data ?? [])
    .filter((r) => Number(r.issue_count) >= minIssues)
    .map((r) => ({
      locationId: r.location_id as string,
      addressHash: r.address_hash as string,
      addressDisplay: r.address_display as string | null,
      issueCount: Number(r.issue_count),
      affectedOrders: Number(r.affected_orders),
      issueTypes: (r.issue_types as string[]).map((t) => t as IssueType),
      lastIssueAt: r.last_issue_at as string,
      firstIssueAt: r.first_issue_at as string,
      qualityScore: computeQualityScore(Number(r.issue_count)),
    }));
}

/** Letzte Issues einer Location laden. */
export async function getRecentIssues(
  locationId: string,
  limit = 20,
): Promise<AddressIssue[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_address_issues')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map(mapIssue);
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

/** Kombinierter Dashboard-Response für Admin-UI. */
export async function getAddressIntelligenceDashboard(
  locationId: string,
): Promise<AddressIntelligenceDashboard> {
  const [stats, problematicAddresses, recentIssues] = await Promise.all([
    getAddressStats(locationId),
    getProblematicAddresses(locationId),
    getRecentIssues(locationId),
  ]);

  return { stats, problematicAddresses, recentIssues };
}

/** KPI-Stats aus View laden. */
export async function getAddressStats(locationId: string): Promise<AddressIntelligenceStats> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_address_intelligence_stats')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) {
    return {
      locationId,
      totalSavedAddresses: 0,
      problematicAddresses: 0,
      issuesToday: 0,
      issuesThisWeek: 0,
      customersWithPrefs: 0,
      pctWithSpecialInstructions: 0,
    };
  }

  return {
    locationId,
    totalSavedAddresses: Number(data.total_saved_addresses ?? 0),
    problematicAddresses: Number(data.problematic_addresses ?? 0),
    issuesToday: Number(data.issues_today ?? 0),
    issuesThisWeek: Number(data.issues_this_week ?? 0),
    customersWithPrefs: Number(data.customers_with_prefs ?? 0),
    pctWithSpecialInstructions: Number(data.pct_with_special_instructions ?? 0),
  };
}

/** Wöchentlicher Batch: alle Locations auf Problem-Adressen prüfen und loggen. */
export async function scanProblematicAddressesAllLocations(): Promise<{
  locations: number;
  totalProblematic: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  let totalProblematic = 0;
  for (const loc of locs ?? []) {
    const list = await getProblematicAddresses(loc.id as string).catch(() => []);
    totalProblematic += list.length;
  }

  return { locations: (locs ?? []).length, totalProblematic };
}

// ─── Mapper ─────────────────────────────────────────────────────────────────

function mapPrefs(r: Record<string, unknown>): AddressPreferences {
  return {
    id: r.id as string,
    locationId: r.location_id as string,
    customerEmail: r.customer_email as string,
    addressHash: r.address_hash as string,
    addressLabel: (r.address_label as string | null) ?? null,
    addressDisplay: (r.address_display as string | null) ?? null,
    ringBell: Boolean(r.ring_bell),
    leaveAtDoor: Boolean(r.leave_at_door),
    floor: (r.floor as string | null) ?? null,
    apartment: (r.apartment as string | null) ?? null,
    gateCode: (r.gate_code as string | null) ?? null,
    buildingInfo: (r.building_info as string | null) ?? null,
    specialInstructions: (r.special_instructions as string | null) ?? null,
    useCount: Number(r.use_count ?? 1),
    lastUsedAt: r.last_used_at as string,
    createdAt: r.created_at as string,
  };
}

function mapIssue(r: Record<string, unknown>): AddressIssue {
  return {
    id: r.id as string,
    locationId: r.location_id as string,
    addressHash: r.address_hash as string,
    addressDisplay: (r.address_display as string | null) ?? null,
    orderId: (r.order_id as string | null) ?? null,
    driverId: (r.driver_id as string | null) ?? null,
    issueType: r.issue_type as IssueType,
    driverNotes: (r.driver_notes as string | null) ?? null,
    resolved: Boolean(r.resolved),
    createdAt: r.created_at as string,
  };
}
