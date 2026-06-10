/**
 * lib/delivery/incidents.ts
 *
 * Delivery Incident Management Engine — Phase 51
 *
 * Strukturiertes Incident-Tracking für schlechte Bewertungen, Verspätungen
 * und betriebliche Probleme. Auto-erstellt Incidents aus Bewertungen ≤2 Sterne.
 *
 * Funktionen:
 *  createIncidentFromRating()     — Auto-Incident nach schlechter Bewertung
 *  createManualIncident()         — Admin erstellt Incident manuell
 *  getIncidents()                 — Liste mit Filtern + Paginierung
 *  getIncident()                  — Einzelner Incident mit Actions
 *  updateIncident()               — Status / Schwere / Notizen aktualisieren
 *  addIncidentAction()            — Aktions-Log eintragen
 *  resolveIncident()              — Incident auflösen
 *  escalateIncident()             — Severity auf high/critical anheben
 *  getIncidentStats()             — v_incident_stats für eine Location
 *  autoCreateIncidentsForRatings()— Cron-Helfer: Nachzügler ohne Incident
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================
// Typen
// ============================================================

export type IncidentType =
  | 'low_rating'
  | 'late_delivery'
  | 'wrong_item'
  | 'missing_item'
  | 'damaged'
  | 'driver_behavior'
  | 'failed_delivery'
  | 'manual';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatus =
  | 'open'
  | 'investigating'
  | 'escalated'
  | 'resolved'
  | 'closed';

export type IncidentActionType =
  | 'created'
  | 'status_changed'
  | 'severity_changed'
  | 'customer_contacted'
  | 'driver_contacted'
  | 'credit_issued'
  | 'escalated'
  | 'resolved'
  | 'closed'
  | 'note';

export interface DeliveryIncident {
  id: string;
  location_id: string;
  order_id: string | null;
  driver_id: string | null;
  batch_id: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string | null;
  customer_rating: number | null;
  customer_comment: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  resolution_notes: string | null;
  credit_issued_id: string | null;
  escalated_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  // enriched from joins
  bestellnummer?: string | null;
  order_type?: string | null;
  driver_name?: string | null;
}

export interface IncidentAction {
  id: string;
  incident_id: string;
  action_type: IncidentActionType;
  note: string | null;
  performed_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface IncidentWithActions extends DeliveryIncident {
  actions: IncidentAction[];
}

export interface IncidentStats {
  location_id: string;
  total: number;
  open_count: number;
  resolved_count: number;
  closed_count: number;
  low_rating_count: number;
  late_delivery_count: number;
  fulfillment_count: number;
  critical_count: number;
  high_count: number;
  avg_resolution_min: number | null;
  credits_issued: number;
  last_incident_at: string | null;
}

export interface CreateManualIncidentInput {
  location_id: string;
  order_id?: string;
  driver_id?: string;
  batch_id?: string;
  type: IncidentType;
  severity?: IncidentSeverity;
  title: string;
  description?: string;
  customer_name?: string;
  customer_phone?: string;
  performed_by?: string;
}

export interface UpdateIncidentInput {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  description?: string;
  resolution_notes?: string;
  credit_issued_id?: string;
}

// ============================================================
// Supabase client helper
// ============================================================

function incidentTableExists(error: { code?: string } | null): boolean {
  return error?.code !== '42P01';
}

// ============================================================
// createIncidentFromRating
// ============================================================

/**
 * Auto-erstellt einen Incident wenn eine Bewertung ≤ 2 Sterne eintrifft.
 * Dedup-Guard: kein zweiter Incident für dieselbe Bestellung + Typ.
 */
export async function createIncidentFromRating(
  orderId: string,
  locationId: string,
  rating: 1 | 2 | 3 | 4 | 5,
  comment: string | null,
): Promise<DeliveryIncident | null> {
  if (rating > 2) return null;

  const sb = createServiceClient();

  // Dedup: bereits ein low_rating Incident für diese Bestellung?
  const { data: existing, error: chkErr } = await sb
    .from('delivery_incidents')
    .select('id')
    .eq('order_id', orderId)
    .eq('type', 'low_rating')
    .maybeSingle();

  if (!incidentTableExists(chkErr)) return null;
  if (existing) return null;

  // Bestelldetails für Titel / Kundeninfo laden
  const { data: order } = await sb
    .from('customer_orders')
    .select('bestellnummer, kunde_name, kunde_telefon, mise_driver_id, mise_batch_id')
    .eq('id', orderId)
    .maybeSingle();

  const severity: IncidentSeverity = rating === 1 ? 'high' : 'medium';
  const title = order?.bestellnummer
    ? `${rating}★ Bewertung — Bestellung ${order.bestellnummer}`
    : `${rating}★ Bewertung — schlechte Kundenzufriedenheit`;

  const { data: incident, error: insertErr } = await sb
    .from('delivery_incidents')
    .insert({
      location_id:      locationId,
      order_id:         orderId,
      driver_id:        order?.mise_driver_id ?? null,
      batch_id:         order?.mise_batch_id ?? null,
      type:             'low_rating' as IncidentType,
      severity,
      status:           'open' as IncidentStatus,
      title,
      customer_rating:  rating,
      customer_comment: comment,
      customer_name:    order?.kunde_name ?? null,
      customer_phone:   order?.kunde_telefon ?? null,
    })
    .select()
    .maybeSingle();

  if (insertErr || !incident) return null;

  // First action
  await sb.from('incident_actions').insert({
    incident_id:  incident.id,
    action_type:  'created' as IncidentActionType,
    note:         `Automatisch erstellt — Bewertung: ${rating}★${comment ? ` — Kommentar: "${comment}"` : ''}`,
    performed_by: 'system',
  });

  return incident as DeliveryIncident;
}

// ============================================================
// createManualIncident
// ============================================================

export async function createManualIncident(
  input: CreateManualIncidentInput,
): Promise<DeliveryIncident | null> {
  const sb = createServiceClient();

  const { data: incident, error } = await sb
    .from('delivery_incidents')
    .insert({
      location_id:  input.location_id,
      order_id:     input.order_id ?? null,
      driver_id:    input.driver_id ?? null,
      batch_id:     input.batch_id ?? null,
      type:         input.type,
      severity:     input.severity ?? 'medium',
      status:       'open' as IncidentStatus,
      title:        input.title,
      description:  input.description ?? null,
      customer_name:  input.customer_name ?? null,
      customer_phone: input.customer_phone ?? null,
    })
    .select()
    .maybeSingle();

  if (error || !incident) return null;

  await sb.from('incident_actions').insert({
    incident_id:  incident.id,
    action_type:  'created' as IncidentActionType,
    note:         input.description ?? null,
    performed_by: input.performed_by ?? 'admin',
  });

  return incident as DeliveryIncident;
}

// ============================================================
// getIncidents
// ============================================================

export interface IncidentFilters {
  status?: IncidentStatus | 'open_all';
  type?: IncidentType;
  severity?: IncidentSeverity;
  driver_id?: string;
  limit?: number;
  offset?: number;
}

export async function getIncidents(
  locationId: string,
  filters: IncidentFilters = {},
): Promise<{ incidents: DeliveryIncident[]; total: number }> {
  const sb = createServiceClient();
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;

  let q = sb
    .from('delivery_incidents')
    .select('id, location_id, order_id, driver_id, batch_id, type, severity, status, title, description, customer_rating, customer_comment, customer_name, customer_phone, resolution_notes, credit_issued_id, escalated_at, resolved_at, created_at, updated_at', { count: 'exact' })
    .eq('location_id', locationId);

  if (filters.status === 'open_all') {
    q = q.in('status', ['open', 'investigating', 'escalated']);
  } else if (filters.status) {
    q = q.eq('status', filters.status);
  }

  if (filters.type)     q = q.eq('type', filters.type);
  if (filters.severity) q = q.eq('severity', filters.severity);
  if (filters.driver_id) q = q.eq('driver_id', filters.driver_id);

  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (!incidentTableExists(error)) return { incidents: [], total: 0 };

  const incidents = (data ?? []) as DeliveryIncident[];

  // Enrich with order + driver details
  const orderIds  = [...new Set(incidents.map(i => i.order_id).filter(Boolean))] as string[];
  const driverIds = [...new Set(incidents.map(i => i.driver_id).filter(Boolean))] as string[];

  const [orderMap, driverMap] = await Promise.all([
    orderIds.length > 0
      ? sb.from('customer_orders').select('id, bestellnummer, lieferung_oder_abholung').in('id', orderIds).then(r =>
          Object.fromEntries((r.data ?? []).map(o => [o.id, o])))
      : Promise.resolve({} as Record<string, { id: string; bestellnummer: string; lieferung_oder_abholung: string }>),
    driverIds.length > 0
      ? sb.from('mise_drivers').select('id, name').in('id', driverIds).then(r =>
          Object.fromEntries((r.data ?? []).map(d => [d.id, d])))
      : Promise.resolve({} as Record<string, { id: string; name: string }>),
  ]);

  const enriched = incidents.map(i => ({
    ...i,
    bestellnummer: i.order_id ? (orderMap[i.order_id]?.bestellnummer ?? null) : null,
    order_type:    i.order_id ? (orderMap[i.order_id]?.lieferung_oder_abholung ?? null) : null,
    driver_name:   i.driver_id ? (driverMap[i.driver_id]?.name ?? null) : null,
  }));

  return { incidents: enriched, total: count ?? 0 };
}

// ============================================================
// getIncident — single with actions
// ============================================================

export async function getIncident(
  id: string,
  locationId: string,
): Promise<IncidentWithActions | null> {
  const sb = createServiceClient();

  const { data: incident, error } = await sb
    .from('delivery_incidents')
    .select('id, location_id, order_id, driver_id, batch_id, type, severity, status, title, description, customer_rating, customer_comment, customer_name, customer_phone, resolution_notes, credit_issued_id, escalated_at, resolved_at, created_at, updated_at')
    .eq('id', id)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!incidentTableExists(error) || !incident) return null;

  const { data: actions } = await sb
    .from('incident_actions')
    .select('id, incident_id, action_type, note, performed_by, metadata, created_at')
    .eq('incident_id', id)
    .order('created_at', { ascending: true });

  // Enrich
  const [orderData, driverData] = await Promise.all([
    incident.order_id
      ? sb.from('customer_orders').select('bestellnummer, lieferung_oder_abholung').eq('id', incident.order_id).maybeSingle().then(r => r.data)
      : Promise.resolve(null),
    incident.driver_id
      ? sb.from('mise_drivers').select('name').eq('id', incident.driver_id).maybeSingle().then(r => r.data)
      : Promise.resolve(null),
  ]);

  return {
    ...(incident as DeliveryIncident),
    bestellnummer: orderData?.bestellnummer ?? null,
    order_type:    orderData?.lieferung_oder_abholung ?? null,
    driver_name:   driverData?.name ?? null,
    actions:       (actions ?? []) as IncidentAction[],
  };
}

// ============================================================
// updateIncident
// ============================================================

export async function updateIncident(
  id: string,
  locationId: string,
  update: UpdateIncidentInput,
  performedBy: string = 'admin',
): Promise<DeliveryIncident | null> {
  const sb = createServiceClient();

  // Load current state to detect what changed
  const { data: current } = await sb
    .from('delivery_incidents')
    .select('status, severity')
    .eq('id', id)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!current) return null;

  const patch: Record<string, unknown> = {};
  if (update.status     !== undefined) patch.status           = update.status;
  if (update.severity   !== undefined) patch.severity         = update.severity;
  if (update.description !== undefined) patch.description     = update.description;
  if (update.resolution_notes !== undefined) patch.resolution_notes = update.resolution_notes;
  if (update.credit_issued_id !== undefined) patch.credit_issued_id = update.credit_issued_id;

  const { data: updated, error } = await sb
    .from('delivery_incidents')
    .update(patch)
    .eq('id', id)
    .eq('location_id', locationId)
    .select()
    .maybeSingle();

  if (error || !updated) return null;

  // Log each significant change
  const actions: Array<{ action_type: IncidentActionType; note: string }> = [];

  if (update.status && update.status !== current.status) {
    actions.push({
      action_type: 'status_changed',
      note: `Status: ${current.status} → ${update.status}`,
    });
  }
  if (update.severity && update.severity !== current.severity) {
    actions.push({
      action_type: 'severity_changed',
      note: `Schwere: ${current.severity} → ${update.severity}`,
    });
  }
  if (update.credit_issued_id) {
    actions.push({
      action_type: 'credit_issued',
      note: `Gutschrift ausgestellt (ID: ${update.credit_issued_id})`,
    });
  }

  if (actions.length > 0) {
    await sb.from('incident_actions').insert(
      actions.map(a => ({ incident_id: id, performed_by: performedBy, ...a })),
    );
  }

  return updated as DeliveryIncident;
}

// ============================================================
// addIncidentAction
// ============================================================

export async function addIncidentAction(
  incidentId: string,
  locationId: string,
  actionType: IncidentActionType,
  note: string | null,
  performedBy: string = 'admin',
  metadata?: Record<string, unknown>,
): Promise<IncidentAction | null> {
  const sb = createServiceClient();

  // Verify incident belongs to location
  const { data: exists } = await sb
    .from('delivery_incidents')
    .select('id')
    .eq('id', incidentId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!exists) return null;

  const { data, error } = await sb
    .from('incident_actions')
    .insert({
      incident_id:  incidentId,
      action_type:  actionType,
      note,
      performed_by: performedBy,
      metadata:     metadata ?? null,
    })
    .select()
    .maybeSingle();

  if (error || !data) return null;
  return data as IncidentAction;
}

// ============================================================
// resolveIncident
// ============================================================

export async function resolveIncident(
  id: string,
  locationId: string,
  notes: string,
  creditIssuedId?: string,
  performedBy: string = 'admin',
): Promise<DeliveryIncident | null> {
  const sb = createServiceClient();

  const patch: Record<string, unknown> = {
    status:           'resolved' as IncidentStatus,
    resolution_notes: notes,
    resolved_at:      new Date().toISOString(),
  };
  if (creditIssuedId) patch.credit_issued_id = creditIssuedId;

  const { data: updated, error } = await sb
    .from('delivery_incidents')
    .update(patch)
    .eq('id', id)
    .eq('location_id', locationId)
    .select()
    .maybeSingle();

  if (error || !updated) return null;

  const actionNote = notes + (creditIssuedId ? ` (Gutschrift: ${creditIssuedId})` : '');
  await sb.from('incident_actions').insert({
    incident_id:  id,
    action_type:  'resolved' as IncidentActionType,
    note:         actionNote,
    performed_by: performedBy,
  });

  return updated as DeliveryIncident;
}

// ============================================================
// escalateIncident
// ============================================================

export async function escalateIncident(
  id: string,
  locationId: string,
  note: string,
  performedBy: string = 'admin',
): Promise<DeliveryIncident | null> {
  const sb = createServiceClient();

  const { data: updated, error } = await sb
    .from('delivery_incidents')
    .update({
      status:       'escalated' as IncidentStatus,
      severity:     'high' as IncidentSeverity,
      escalated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('location_id', locationId)
    .select()
    .maybeSingle();

  if (error || !updated) return null;

  await sb.from('incident_actions').insert({
    incident_id:  id,
    action_type:  'escalated' as IncidentActionType,
    note,
    performed_by: performedBy,
  });

  return updated as DeliveryIncident;
}

// ============================================================
// getIncidentStats
// ============================================================

export async function getIncidentStats(locationId: string): Promise<IncidentStats | null> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('v_incident_stats')
    .select('location_id, total, open_count, resolved_count, closed_count, low_rating_count, late_delivery_count, fulfillment_count, critical_count, high_count, avg_resolution_min, credits_issued, last_incident_at')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!incidentTableExists(error)) return null;
  if (!data) {
    // No incidents yet — return empty stats
    return {
      location_id: locationId,
      total: 0, open_count: 0, resolved_count: 0, closed_count: 0,
      low_rating_count: 0, late_delivery_count: 0, fulfillment_count: 0,
      critical_count: 0, high_count: 0, avg_resolution_min: null,
      credits_issued: 0, last_incident_at: null,
    };
  }

  return {
    location_id:         data.location_id as string,
    total:               Number(data.total),
    open_count:          Number(data.open_count),
    resolved_count:      Number(data.resolved_count),
    closed_count:        Number(data.closed_count),
    low_rating_count:    Number(data.low_rating_count),
    late_delivery_count: Number(data.late_delivery_count),
    fulfillment_count:   Number(data.fulfillment_count),
    critical_count:      Number(data.critical_count),
    high_count:          Number(data.high_count),
    avg_resolution_min:  data.avg_resolution_min != null ? Number(data.avg_resolution_min) : null,
    credits_issued:      Number(data.credits_issued),
    last_incident_at:    data.last_incident_at as string | null,
  };
}

// ============================================================
// autoCreateIncidentsForRatings — Cron-Helfer
// ============================================================

/**
 * Scannt Bewertungen ≤2 Sterne der letzten 24h und erstellt fehlende Incidents.
 * Sicherheitsnetz falls createIncidentFromRating() beim Bewertungs-Submit gefehlt hat.
 */
export async function autoCreateIncidentsForRatings(): Promise<number> {
  const sb = createServiceClient();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Load bad ratings from last 24h
  const { data: ratings, error } = await sb
    .from('customer_delivery_ratings')
    .select('id, order_id, location_id, rating, comment, created_at')
    .lte('rating', 2)
    .gte('created_at', since);

  if (!incidentTableExists(error) || !ratings?.length) return 0;

  const orderIds = ratings.map(r => r.order_id).filter(Boolean) as string[];
  if (!orderIds.length) return 0;

  // Check which already have incidents
  const { data: existing } = await sb
    .from('delivery_incidents')
    .select('order_id')
    .in('order_id', orderIds)
    .eq('type', 'low_rating');

  const alreadyHasIncident = new Set((existing ?? []).map(e => e.order_id));

  let created = 0;
  for (const r of ratings) {
    if (!r.order_id || alreadyHasIncident.has(r.order_id)) continue;
    const result = await createIncidentFromRating(
      r.order_id,
      r.location_id,
      r.rating as 1 | 2,
      r.comment ?? null,
    );
    if (result) created++;
  }

  return created;
}
