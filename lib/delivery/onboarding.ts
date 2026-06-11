/**
 * lib/delivery/onboarding.ts
 *
 * Fahrer-Bewerbungs- & Onboarding-Engine — Phase 61
 *
 * Verwaltet den vollständigen Lebenszyklus einer Fahrer-Bewerbung:
 * öffentliches Einreichen → Admin-Review → Onboarding-Checkliste → Freigabe.
 *
 * Funktionen:
 *  submitApplication(input)                 — öffentlich: Bewerbung einreichen
 *  getApplications(locationId, filters?)    — Admin: Liste filtern
 *  getApplicationById(id, locationId)       — Admin: Einzelansicht + Steps
 *  updateApplicationStatus(...)             — Admin: Status ändern
 *  createDefaultOnboardingSteps(appId, locId) — Steps anlegen wenn Review startet
 *  getOnboardingSteps(appId, locationId)    — Steps laden
 *  updateOnboardingStep(...)                — Step abhaken / Notiz setzen
 *  linkDriverToApplication(appId, locId, driverId) — verknüpfen wenn Fahrer-Account erstellt
 *  expireStaleApplications()               — Cron: abgelaufene pending-Bewerbungen markieren
 *  getOnboardingFunnelStats(locationId)    — Admin-Dashboard: Trichter-KPIs
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | 'pending'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export type VehicleType = 'bicycle' | 'moped' | 'car' | 'scooter' | 'ebike';

export type Availability =
  | 'fulltime'
  | 'parttime'
  | 'weekends'
  | 'evenings'
  | 'flexible';

export type StepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'failed';

export interface DriverApplication {
  id: string;
  locationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hasVehicle: boolean;
  vehicleType: VehicleType | null;
  licenseClass: string | null;
  availability: Availability | null;
  coverLetter: string | null;
  referralCode: string | null;
  status: ApplicationStatus;
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  driverId: string | null;
  appliedAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationOverview extends DriverApplication {
  stepsTotal: number;
  stepsCompleted: number;
  stepsBlocking: number;
}

export interface OnboardingStep {
  id: string;
  applicationId: string;
  locationId: string;
  stepKey: string;
  stepName: string;
  stepOrder: number;
  required: boolean;
  status: StepStatus;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SubmitApplicationInput {
  locationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hasVehicle: boolean;
  vehicleType?: VehicleType;
  licenseClass?: string;
  availability?: Availability;
  coverLetter?: string;
  referralCode?: string;
}

export interface ApplicationFilters {
  status?: ApplicationStatus;
  search?: string;          // email / name substring
  limit?: number;
  offset?: number;
}

export interface FunnelStats {
  locationId: string;
  totalApplications: number;
  pending: number;
  reviewing: number;
  approved: number;
  rejected: number;
  withdrawn: number;
  expiredPending: number;
  approvalRatePct: number | null;
}

// Default onboarding steps applied to every new application under review.
// Admin can add custom steps via updateOnboardingStep.
const DEFAULT_STEPS: Array<{
  stepKey: string;
  stepName: string;
  stepOrder: number;
  required: boolean;
}> = [
  { stepKey: 'id_check',          stepName: 'Identitätsprüfung (Personalausweis)',      stepOrder: 1, required: true  },
  { stepKey: 'food_hygiene_cert', stepName: 'Lebensmittelhygiene-Zertifikat einreichen', stepOrder: 2, required: true  },
  { stepKey: 'drivers_license',   stepName: 'Führerschein prüfen',                       stepOrder: 3, required: false },
  { stepKey: 'vehicle_check',     stepName: 'Fahrzeug-/TÜV-Nachweis',                   stepOrder: 4, required: false },
  { stepKey: 'app_install',       stepName: 'Fahrer-App installiert & eingeloggt',       stepOrder: 5, required: true  },
  { stepKey: 'intro_briefing',    stepName: 'Einführungs-Gespräch abgehalten',           stepOrder: 6, required: true  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): DriverApplication {
  return {
    id:           row.id as string,
    locationId:   row.location_id as string,
    firstName:    row.first_name as string,
    lastName:     row.last_name as string,
    email:        row.email as string,
    phone:        row.phone as string,
    hasVehicle:   row.has_vehicle as boolean,
    vehicleType:  (row.vehicle_type ?? null) as VehicleType | null,
    licenseClass: (row.license_class ?? null) as string | null,
    availability: (row.availability ?? null) as Availability | null,
    coverLetter:  (row.cover_letter ?? null) as string | null,
    referralCode: (row.referral_code ?? null) as string | null,
    status:       row.status as ApplicationStatus,
    adminNotes:   (row.admin_notes ?? null) as string | null,
    reviewedBy:   (row.reviewed_by ?? null) as string | null,
    reviewedAt:   (row.reviewed_at ?? null) as string | null,
    driverId:     (row.driver_id ?? null) as string | null,
    appliedAt:    row.applied_at as string,
    expiresAt:    row.expires_at as string,
    createdAt:    row.created_at as string,
    updatedAt:    row.updated_at as string,
  };
}

function mapOverviewRow(row: Record<string, unknown>): ApplicationOverview {
  return {
    ...mapRow(row),
    stepsTotal:     Number(row.steps_total ?? 0),
    stepsCompleted: Number(row.steps_completed ?? 0),
    stepsBlocking:  Number(row.steps_blocking ?? 0),
  };
}

function mapStepRow(row: Record<string, unknown>): OnboardingStep {
  return {
    id:            row.id as string,
    applicationId: row.application_id as string,
    locationId:    row.location_id as string,
    stepKey:       row.step_key as string,
    stepName:      row.step_name as string,
    stepOrder:     Number(row.step_order ?? 0),
    required:      row.required as boolean,
    status:        row.status as StepStatus,
    completedAt:   (row.completed_at ?? null) as string | null,
    notes:         (row.notes ?? null) as string | null,
    createdAt:     row.created_at as string,
  };
}

// ─── Public: Bewerbung einreichen ─────────────────────────────────────────────

export async function submitApplication(
  input: SubmitApplicationInput,
): Promise<DriverApplication> {
  const sb = createServiceClient();

  // Duplicate-guard: gleiche E-Mail + Location darf nicht zweimal pending/reviewing sein
  const { data: existing } = await sb
    .from('driver_applications')
    .select('id, status')
    .eq('location_id', input.locationId)
    .eq('email', input.email.toLowerCase().trim())
    .in('status', ['pending', 'reviewing'])
    .maybeSingle();

  if (existing) {
    throw new Error('DUPLICATE_APPLICATION');
  }

  const { data, error } = await sb
    .from('driver_applications')
    .insert({
      location_id:   input.locationId,
      first_name:    input.firstName.trim(),
      last_name:     input.lastName.trim(),
      email:         input.email.toLowerCase().trim(),
      phone:         input.phone.trim(),
      has_vehicle:   input.hasVehicle,
      vehicle_type:  input.vehicleType ?? null,
      license_class: input.licenseClass ?? null,
      availability:  input.availability ?? null,
      cover_letter:  input.coverLetter?.trim() ?? null,
      referral_code: input.referralCode?.trim() ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

// ─── Admin: Liste ─────────────────────────────────────────────────────────────

export async function getApplications(
  locationId: string,
  filters: ApplicationFilters = {},
): Promise<ApplicationOverview[]> {
  const sb = createServiceClient();
  const limit  = Math.min(filters.limit  ?? 50, 200);
  const offset = filters.offset ?? 0;

  let query = sb
    .from('v_application_overview')
    .select('*')
    .eq('location_id', locationId)
    .order('applied_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`email.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(r => mapOverviewRow(r as Record<string, unknown>));
}

// ─── Admin: Einzelansicht ─────────────────────────────────────────────────────

export async function getApplicationById(
  id: string,
  locationId: string,
): Promise<{ application: ApplicationOverview; steps: OnboardingStep[] } | null> {
  const sb = createServiceClient();

  const [appRes, stepsRes] = await Promise.all([
    sb
      .from('v_application_overview')
      .select('*')
      .eq('id', id)
      .eq('location_id', locationId)
      .maybeSingle(),
    sb
      .from('driver_onboarding_steps')
      .select('*')
      .eq('application_id', id)
      .eq('location_id', locationId)
      .order('step_order', { ascending: true }),
  ]);

  if (appRes.error) throw appRes.error;
  if (!appRes.data) return null;

  return {
    application: mapOverviewRow(appRes.data as Record<string, unknown>),
    steps: (stepsRes.data ?? []).map(r => mapStepRow(r as Record<string, unknown>)),
  };
}

// ─── Admin: Status ändern ─────────────────────────────────────────────────────

export async function updateApplicationStatus(
  id: string,
  locationId: string,
  status: ApplicationStatus,
  adminNotes: string | null,
  reviewedBy: string,
): Promise<DriverApplication> {
  const sb = createServiceClient();

  const update: Record<string, unknown> = {
    status,
    admin_notes: adminNotes,
    updated_at:  new Date().toISOString(),
  };

  // Nur beim ersten Review-Übergang reviewed_at setzen
  if (status !== 'pending') {
    update.reviewed_by = reviewedBy;
    update.reviewed_at = new Date().toISOString();
  }

  const { data, error } = await sb
    .from('driver_applications')
    .update(update)
    .eq('id', id)
    .eq('location_id', locationId)
    .select()
    .single();

  if (error) throw error;

  // Wenn Status → 'reviewing', automatisch Default-Steps erzeugen (idempotent)
  if (status === 'reviewing') {
    await createDefaultOnboardingSteps(id, locationId).catch(() => undefined);
  }

  return mapRow(data as Record<string, unknown>);
}

// ─── Onboarding Steps: Default-Set anlegen ───────────────────────────────────

export async function createDefaultOnboardingSteps(
  applicationId: string,
  locationId: string,
): Promise<OnboardingStep[]> {
  const sb = createServiceClient();

  const rows = DEFAULT_STEPS.map(s => ({
    application_id: applicationId,
    location_id:    locationId,
    step_key:       s.stepKey,
    step_name:      s.stepName,
    step_order:     s.stepOrder,
    required:       s.required,
    status:         'pending',
  }));

  // ON CONFLICT DO NOTHING — idempotent, doppelter Aufruf erzeugt keine Duplikate
  const { data, error } = await sb
    .from('driver_onboarding_steps')
    .upsert(rows, { onConflict: 'application_id,step_key', ignoreDuplicates: true })
    .select();

  if (error) throw error;
  return (data ?? []).map(r => mapStepRow(r as Record<string, unknown>));
}

// ─── Onboarding Steps: laden ──────────────────────────────────────────────────

export async function getOnboardingSteps(
  applicationId: string,
  locationId: string,
): Promise<OnboardingStep[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_onboarding_steps')
    .select('*')
    .eq('application_id', applicationId)
    .eq('location_id', locationId)
    .order('step_order', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(r => mapStepRow(r as Record<string, unknown>));
}

// ─── Onboarding Step: abhaken ─────────────────────────────────────────────────

export async function updateOnboardingStep(
  stepId: string,
  applicationId: string,
  locationId: string,
  status: StepStatus,
  notes?: string,
): Promise<OnboardingStep> {
  const sb = createServiceClient();

  const update: Record<string, unknown> = { status, notes: notes ?? null };
  if (status === 'completed') {
    update.completed_at = new Date().toISOString();
  } else {
    update.completed_at = null;
  }

  const { data, error } = await sb
    .from('driver_onboarding_steps')
    .update(update)
    .eq('id', stepId)
    .eq('application_id', applicationId)
    .eq('location_id', locationId)
    .select()
    .single();

  if (error) throw error;
  return mapStepRow(data as Record<string, unknown>);
}

// ─── Fahrer verknüpfen (nach Account-Erstellung) ─────────────────────────────

export async function linkDriverToApplication(
  applicationId: string,
  locationId: string,
  driverId: string,
): Promise<DriverApplication> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_applications')
    .update({
      driver_id:  driverId,
      status:     'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .eq('location_id', locationId)
    .select()
    .single();

  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

// ─── Cron: abgelaufene Bewerbungen bereinigen ─────────────────────────────────

export async function expireStaleApplications(): Promise<number> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_applications')
    .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) throw error;
  return (data ?? []).length;
}

// ─── Admin-Dashboard: Trichter-KPIs ───────────────────────────────────────────

export async function getOnboardingFunnelStats(
  locationId: string,
): Promise<FunnelStats | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('v_onboarding_funnel')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    locationId:       row.location_id as string,
    totalApplications: Number(row.total_applications ?? 0),
    pending:           Number(row.pending ?? 0),
    reviewing:         Number(row.reviewing ?? 0),
    approved:          Number(row.approved ?? 0),
    rejected:          Number(row.rejected ?? 0),
    withdrawn:         Number(row.withdrawn ?? 0),
    expiredPending:    Number(row.expired_pending ?? 0),
    approvalRatePct:   row.approval_rate_pct != null ? Number(row.approval_rate_pct) : null,
  };
}

// ─── Alle Locations: Cron-Wrapper ─────────────────────────────────────────────

export async function expireStaleApplicationsAllLocations(): Promise<{
  expired: number;
}> {
  const expired = await expireStaleApplications();
  return { expired };
}
