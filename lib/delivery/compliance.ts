/**
 * lib/delivery/compliance.ts
 *
 * Driver Certification & Compliance Engine — Phase 59
 *
 * Verwaltet Fahrer-Zertifikate (Lebensmittelhygiene, Führerschein,
 * Fahrzeugprüfung, Personalausweis) und deren Ablaufdaten.
 * Verhindert Dispatch an nicht-konforme Fahrer.
 *
 * Compliance-Regeln:
 *  - 'food_hygiene' abgelaufen/gesperrt → dispatch_blocked = true (hard block)
 *  - Alle anderen abgelaufenen Zertifikate → Warnung, kein Block
 *  - Ablaufdatum in ≤30 Tagen → expiringSoon-Flag
 *
 * Funktionen:
 *  getCertifications(driverId, locationId)      — Zertifikate eines Fahrers
 *  upsertCertification(input)                   — Zertifikat hinzufügen / aktualisieren
 *  deleteCertification(certId, locationId)      — Zertifikat entfernen (Tenant-Guard)
 *  getComplianceStatus(locationId)              — Gesamt-Compliance einer Location
 *  getExpiringSoon(locationId, days?)           — in N Tagen ablaufende Certs
 *  checkDriverCompliance(driverId)              — Dispatch-Freigabe prüfen
 *  autoExpireCertifications(locationId)         — abgelaufene Certs auf 'expired' setzen
 *  generateComplianceAlerts(locationId)         — Alert-Zusammenfassung erzeugen
 *  evaluateComplianceAllLocations()             — Cron-Wrapper
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CertType =
  | 'food_hygiene'
  | 'drivers_license'
  | 'vehicle_inspection'
  | 'food_handler'
  | 'id_verification'
  | 'other';

export type CertStatus = 'active' | 'expired' | 'suspended' | 'pending_renewal';

export type ComplianceLevel =
  | 'compliant'
  | 'expiring_soon'
  | 'partial'
  | 'non_compliant'
  | 'no_certs';

export interface DriverCertification {
  id: string;
  driverId: string;
  locationId: string;
  certType: CertType;
  certNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  status: CertStatus;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertCertInput {
  driverId: string;
  locationId: string;
  certType: CertType;
  certNumber?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  status?: CertStatus;
  notes?: string | null;
  createdBy?: string | null;
}

export interface DriverComplianceStatus {
  driverId: string;
  employeeId: string | null;
  vehicle: string | null;
  complianceStatus: ComplianceLevel;
  activeCerts: number;
  expiredCerts: number;
  suspendedCerts: number;
  expiringSoonCount: number;
  lastCertUpdate: string | null;
  dispatchBlocked: boolean;
}

export interface LocationComplianceOverview {
  locationId: string;
  totalDrivers: number;
  compliant: number;
  expiringSoon: number;
  partial: number;
  nonCompliant: number;
  noCerts: number;
  blockedForDispatch: number;
  drivers: DriverComplianceStatus[];
}

export interface ExpiringSoonCert {
  id: string;
  driverId: string;
  locationId: string;
  certType: CertType;
  certNumber: string | null;
  expiresAt: string;
  status: CertStatus;
  daysUntilExpiry: number;
  notes: string | null;
}

export interface ComplianceAlertResult {
  locationId: string;
  alertsGenerated: number;
  expiredAutoUpdated: number;
  expiringSoonFound: number;
}

export interface ComplianceCheckResult {
  compliant: boolean;
  blocked: boolean;
  reason: string | null;
}

export interface EvaluateAllResult {
  locations: number;
  alertsGenerated: number;
  expiredAutoUpdated: number;
  errors: number;
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapCert(row: Record<string, unknown>): DriverCertification {
  return {
    id:          String(row.id),
    driverId:    String(row.driver_id),
    locationId:  String(row.location_id),
    certType:    row.cert_type as CertType,
    certNumber:  (row.cert_number as string | null) ?? null,
    issuedAt:    (row.issued_at as string | null) ?? null,
    expiresAt:   (row.expires_at as string | null) ?? null,
    status:      row.status as CertStatus,
    notes:       (row.notes as string | null) ?? null,
    createdBy:   (row.created_by as string | null) ?? null,
    createdAt:   String(row.created_at),
    updatedAt:   String(row.updated_at),
  };
}

function mapComplianceRow(row: Record<string, unknown>): DriverComplianceStatus {
  const lvl = (row.compliance_status as ComplianceLevel | undefined) ?? 'no_certs';
  return {
    driverId:          String(row.driver_id),
    employeeId:        (row.employee_id as string | null) ?? null,
    vehicle:           (row.vehicle as string | null) ?? null,
    complianceStatus:  lvl,
    activeCerts:       Number(row.active_certs ?? 0),
    expiredCerts:      Number(row.expired_certs ?? 0),
    suspendedCerts:    Number(row.suspended_certs ?? 0),
    expiringSoonCount: Number(row.expiring_soon_count ?? 0),
    lastCertUpdate:    (row.last_cert_update as string | null) ?? null,
    dispatchBlocked:   lvl === 'non_compliant',
  };
}

// ─── Public functions ─────────────────────────────────────────────────────────

/** Alle Zertifikate eines Fahrers für eine bestimmte Location. */
export async function getCertifications(
  driverId: string,
  locationId: string,
): Promise<DriverCertification[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_certifications')
    .select('id, driver_id, location_id, cert_type, cert_number, issued_at, expires_at, status, notes, created_by, created_at, updated_at')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .order('cert_type');
  return (data ?? []).map((r) => mapCert(r as Record<string, unknown>));
}

/** Zertifikat hinzufügen oder aktualisieren (UPSERT via driver_id + cert_type). */
export async function upsertCertification(
  input: UpsertCertInput,
): Promise<DriverCertification> {
  const sb = createServiceClient();
  const row = {
    driver_id:   input.driverId,
    location_id: input.locationId,
    cert_type:   input.certType,
    cert_number: input.certNumber ?? null,
    issued_at:   input.issuedAt ?? null,
    expires_at:  input.expiresAt ?? null,
    status:      input.status ?? 'active',
    notes:       input.notes ?? null,
    created_by:  input.createdBy ?? null,
    updated_at:  new Date().toISOString(),
  };
  const { data, error } = await sb
    .from('driver_certifications')
    .upsert(row, { onConflict: 'driver_id,cert_type' })
    .select('id, driver_id, location_id, cert_type, cert_number, issued_at, expires_at, status, notes, created_by, created_at, updated_at')
    .single();
  if (error) throw new Error(`upsert cert failed: ${error.message}`);
  return mapCert(data as Record<string, unknown>);
}

/** Zertifikat entfernen (Multi-Tenant: location_id-Check wird erzwungen). */
export async function deleteCertification(
  certId: string,
  locationId: string,
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('driver_certifications')
    .delete()
    .eq('id', certId)
    .eq('location_id', locationId);
}

/** Compliance-Übersicht aller Fahrer einer Location. */
export async function getComplianceStatus(
  locationId: string,
): Promise<LocationComplianceOverview> {
  const sb = createServiceClient();

  // Fahrer deren Zertifikate für diese Location registriert sind
  const { data: certDrivers } = await sb
    .from('driver_certifications')
    .select('driver_id')
    .eq('location_id', locationId);

  const driverIdsFromCerts = [...new Set(
    (certDrivers ?? []).map((r) => String((r as Record<string, unknown>).driver_id)),
  )];

  // Alle aktiven Fahrer des Systems (mise_drivers hat kein location_id)
  const { data: allDriverRows } = await sb
    .from('mise_drivers')
    .select('id, employee_id, vehicle')
    .eq('active', true);

  const allDrivers = (allDriverRows ?? []) as Array<{
    id: string;
    employee_id: string | null;
    vehicle: string | null;
  }>;

  // Compliance-View für alle bekannten Fahrer laden
  const knownDriverIds = [
    ...new Set([
      ...allDrivers.map((d) => d.id),
      ...driverIdsFromCerts,
    ]),
  ];

  let compRows: Array<Record<string, unknown>> = [];
  if (knownDriverIds.length > 0) {
    const { data } = await sb
      .from('v_driver_compliance_status')
      .select('driver_id, employee_id, vehicle, compliance_status, active_certs, expired_certs, suspended_certs, expiring_soon_count, last_cert_update')
      .in('driver_id', knownDriverIds);
    compRows = (data ?? []) as Array<Record<string, unknown>>;
  }

  const compMap = new Map<string, DriverComplianceStatus>();
  for (const r of compRows) {
    const status = mapComplianceRow(r);
    compMap.set(status.driverId, status);
  }

  // Fahrer mit bekannten Zertifikaten aber ggf. nicht in mise_drivers (edge-case)
  const driverIds = [...new Set([
    ...allDrivers.map((d) => d.id),
    ...driverIdsFromCerts,
  ])];

  const drivers: DriverComplianceStatus[] = driverIds.map((id) => {
    if (compMap.has(id)) return compMap.get(id)!;
    const d = allDrivers.find((dr) => dr.id === id);
    return {
      driverId:          id,
      employeeId:        d?.employee_id ?? null,
      vehicle:           d?.vehicle ?? null,
      complianceStatus:  'no_certs',
      activeCerts:       0,
      expiredCerts:      0,
      suspendedCerts:    0,
      expiringSoonCount: 0,
      lastCertUpdate:    null,
      dispatchBlocked:   false,
    };
  });

  const counts = drivers.reduce(
    (acc, d) => {
      acc[d.complianceStatus] = (acc[d.complianceStatus] ?? 0) + 1;
      if (d.dispatchBlocked) acc.blocked++;
      return acc;
    },
    { compliant: 0, expiring_soon: 0, partial: 0, non_compliant: 0, no_certs: 0, blocked: 0 } as Record<string, number>,
  );

  return {
    locationId,
    totalDrivers:      drivers.length,
    compliant:         counts.compliant,
    expiringSoon:      counts.expiring_soon,
    partial:           counts.partial,
    nonCompliant:      counts.non_compliant,
    noCerts:           counts.no_certs,
    blockedForDispatch: counts.blocked,
    drivers,
  };
}

/** Zertifikate die in den nächsten N Tagen ablaufen (default: 30). */
export async function getExpiringSoon(
  locationId: string,
  days = 30,
): Promise<ExpiringSoonCert[]> {
  const sb = createServiceClient();
  const safeDays = Math.min(Math.max(days, 1), 90);
  const today = new Date().toISOString().split('T')[0];
  const until = new Date(Date.now() + safeDays * 86_400_000).toISOString().split('T')[0];

  const { data } = await sb
    .from('driver_certifications')
    .select('id, driver_id, location_id, cert_type, cert_number, expires_at, status, notes')
    .eq('location_id', locationId)
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .gte('expires_at', today)
    .lte('expires_at', until)
    .order('expires_at');

  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const expiresAt = String(row.expires_at);
    const daysLeft = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / 86_400_000,
    );
    return {
      id:              String(row.id),
      driverId:        String(row.driver_id),
      locationId:      String(row.location_id),
      certType:        row.cert_type as CertType,
      certNumber:      (row.cert_number as string | null) ?? null,
      expiresAt,
      status:          row.status as CertStatus,
      daysUntilExpiry: Math.max(0, daysLeft),
      notes:           (row.notes as string | null) ?? null,
    };
  });
}

/**
 * Prüft ob ein Fahrer für Dispatch freigegeben ist.
 * Hard-block: food_hygiene abgelaufen oder gesperrt.
 * Graceful: wenn Tabelle fehlt (42P01), kein Block (Fallback).
 */
export async function checkDriverCompliance(
  driverId: string,
): Promise<ComplianceCheckResult> {
  const sb = createServiceClient();

  let certs: Array<{ cert_type: string; status: string }>;
  try {
    const { data, error } = await sb
      .from('driver_certifications')
      .select('cert_type, status')
      .eq('driver_id', driverId);
    if (error) {
      // Graceful fallback wenn Tabelle noch nicht migriert
      if ((error as { code?: string }).code === '42P01') return { compliant: true, blocked: false, reason: null };
      throw error;
    }
    certs = (data ?? []) as Array<{ cert_type: string; status: string }>;
  } catch {
    return { compliant: true, blocked: false, reason: null };
  }

  const foodHygiene = certs.find((c) => c.cert_type === 'food_hygiene');
  if (foodHygiene && (foodHygiene.status === 'expired' || foodHygiene.status === 'suspended')) {
    return {
      compliant: false,
      blocked:   true,
      reason:    `food_hygiene cert is ${foodHygiene.status}`,
    };
  }

  const otherBlocked = certs.find(
    (c) => c.cert_type !== 'food_hygiene' && (c.status === 'expired' || c.status === 'suspended'),
  );
  if (otherBlocked) {
    return {
      compliant: false,
      blocked:   false,
      reason:    `${otherBlocked.cert_type} cert is ${otherBlocked.status}`,
    };
  }

  return { compliant: true, blocked: false, reason: null };
}

/**
 * Setzt abgelaufene Zertifikate (expires_at < heute, status='active')
 * automatisch auf 'expired'.
 */
export async function autoExpireCertifications(locationId: string): Promise<number> {
  const sb = createServiceClient();
  const today = new Date().toISOString().split('T')[0];
  const { data } = await sb
    .from('driver_certifications')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('location_id', locationId)
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .lt('expires_at', today)
    .select('id');
  return (data ?? []).length;
}

/**
 * Generiert eine Alert-Zusammenfassung für eine Location:
 * - Setzt abgelaufene Certs auf 'expired'
 * - Zählt ablaufende Certs (Warnung)
 */
export async function generateComplianceAlerts(
  locationId: string,
): Promise<ComplianceAlertResult> {
  const expiredAutoUpdated = await autoExpireCertifications(locationId);

  const sb = createServiceClient();
  const today = new Date().toISOString().split('T')[0];
  const in30  = new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0];

  const { count: expiringSoonFound } = await sb
    .from('driver_certifications')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .gte('expires_at', today)
    .lte('expires_at', in30);

  return {
    locationId,
    alertsGenerated:    (expiredAutoUpdated) + (expiringSoonFound ?? 0),
    expiredAutoUpdated,
    expiringSoonFound:  expiringSoonFound ?? 0,
  };
}

/** Cron-Wrapper: alle aktiven Locations evaluieren. */
export async function evaluateComplianceAllLocations(): Promise<EvaluateAllResult> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  let totalAlerts     = 0;
  let totalExpired    = 0;
  let errors          = 0;

  for (const loc of locations ?? []) {
    try {
      const r = await generateComplianceAlerts(String((loc as Record<string, unknown>).id));
      totalAlerts  += r.alertsGenerated;
      totalExpired += r.expiredAutoUpdated;
    } catch {
      errors++;
    }
  }

  return {
    locations:           (locations ?? []).length,
    alertsGenerated:     totalAlerts,
    expiredAutoUpdated:  totalExpired,
    errors,
  };
}
