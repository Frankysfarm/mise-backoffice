'use client';

/**
 * BewerbungenClient — Phase 63
 * Admin-UI für Fahrer-Lieferdienst-Bewerbungen.
 * Zeigt Funnel-KPIs, gefilterte Bewerbungsliste und Detail-Modal
 * mit Status-Wechsel + Onboarding-Checkliste.
 */

import { useState, useEffect, useCallback, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, ChevronDown, ChevronRight, Circle, Clock,
  FileText, Loader2, RefreshCw, Search, User, X, XCircle,
  AlertCircle, Bike, Car, ChevronUp,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ApplicationStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'withdrawn';
type VehicleType = 'bicycle' | 'moped' | 'car' | 'scooter' | 'ebike';
type Availability = 'fulltime' | 'parttime' | 'weekends' | 'evenings' | 'flexible';
type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

interface Application {
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
  stepsTotal: number;
  stepsCompleted: number;
  stepsBlocking: number;
}

interface OnboardingStep {
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

interface FunnelStats {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: 'Ausstehend', reviewing: 'In Prüfung',
  approved: 'Genehmigt', rejected: 'Abgelehnt', withdrawn: 'Zurückgezogen',
};

const STATUS_STYLE: Record<ApplicationStatus, string> = {
  pending:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  reviewing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  approved:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected:  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  withdrawn: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

const STEP_STYLE: Record<StepStatus, string> = {
  pending:     'text-zinc-400',
  in_progress: 'text-blue-500',
  completed:   'text-green-500',
  skipped:     'text-zinc-300',
  failed:      'text-red-500',
};

const VEHICLE_LABEL: Record<VehicleType, string> = {
  bicycle: 'Fahrrad', moped: 'Moped', car: 'Auto', scooter: 'Roller', ebike: 'E-Bike',
};

const AVAILABILITY_LABEL: Record<Availability, string> = {
  fulltime: 'Vollzeit', parttime: 'Teilzeit', weekends: 'Wochenenden',
  evenings: 'Abende', flexible: 'Flexibel',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === 'failed')    return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === 'in_progress') return <Clock className="w-4 h-4 text-blue-500" />;
  if (status === 'skipped')   return <ChevronRight className="w-4 h-4 text-zinc-400" />;
  return <Circle className="w-4 h-4 text-zinc-300" />;
}

// ─── Funnel KPI Card ───────────────────────────────────────────────────────

function KpiCard({ label, value, color, onClick, active }: {
  label: string; value: number; color: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-2xl p-4 text-left transition-all border',
        active
          ? 'border-transparent shadow-md scale-[1.02]'
          : 'border-transparent hover:border-zinc-200 dark:hover:border-zinc-700',
        color,
      )}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-0.5 opacity-80 font-medium">{label}</div>
    </button>
  );
}

// ─── Detail Modal ──────────────────────────────────────────────────────────

function DetailModal({
  app,
  locationId,
  onClose,
  onStatusChanged,
}: {
  app: Application;
  locationId: string;
  onClose: () => void;
  onStatusChanged: (id: string, status: ApplicationStatus) => void;
}) {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<ApplicationStatus | null>(null);
  const [updatingStep, setUpdatingStep] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState(app.adminNotes ?? '');
  const [showNotesSave, setShowNotesSave] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(app.status);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (app.status === 'reviewing' || app.status === 'approved') {
      setLoadingSteps(true);
      fetch(`/api/delivery/admin/applications/${app.id}/steps?location_id=${locationId}`)
        .then((r) => r.json())
        .then((d) => setSteps(d.steps ?? []))
        .finally(() => setLoadingSteps(false));
    }
  }, [app.id, app.status, locationId]);

  async function changeStatus(newStatus: ApplicationStatus) {
    setUpdatingStatus(newStatus);
    try {
      const res = await fetch(`/api/delivery/admin/applications/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, status: newStatus, admin_notes: adminNotes || null }),
      });
      if (res.ok) {
        setCurrentStatus(newStatus);
        onStatusChanged(app.id, newStatus);
        if (newStatus === 'reviewing') {
          setLoadingSteps(true);
          const sr = await fetch(`/api/delivery/admin/applications/${app.id}/steps?location_id=${locationId}`);
          const sd = await sr.json();
          setSteps(sd.steps ?? []);
          setLoadingSteps(false);
        }
      }
    } finally {
      setUpdatingStatus(null);
    }
  }

  async function toggleStep(step: OnboardingStep) {
    const newStatus: StepStatus = step.status === 'completed' ? 'pending' : 'completed';
    setUpdatingStep(step.id);
    try {
      const res = await fetch(`/api/delivery/admin/applications/${app.id}/steps`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, step_id: step.id, status: newStatus }),
      });
      if (res.ok) {
        setSteps((prev) => prev.map((s) =>
          s.id === step.id ? { ...s, status: newStatus, completedAt: newStatus === 'completed' ? new Date().toISOString() : null } : s,
        ));
      }
    } finally {
      setUpdatingStep(null);
    }
  }

  async function saveNotes() {
    await fetch(`/api/delivery/admin/applications/${app.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, status: currentStatus, admin_notes: adminNotes || null }),
    });
    setShowNotesSave(false);
  }

  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const requiredSteps  = steps.filter((s) => s.required).length;
  const completedRequired = steps.filter((s) => s.required && s.status === 'completed').length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 rounded-t-2xl z-10">
          <div>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-zinc-400" />
              <h2 className="text-lg font-semibold">{app.firstName} {app.lastName}</h2>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[currentStatus])}>
                {STATUS_LABEL[currentStatus]}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">{app.email} · {app.phone}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Bewerbungs-Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3">
              <p className="text-xs text-zinc-500 mb-1">Fahrzeug</p>
              <p className="font-medium">
                {app.hasVehicle && app.vehicleType ? VEHICLE_LABEL[app.vehicleType] : app.hasVehicle ? 'Ja' : 'Kein Fahrzeug'}
              </p>
              {app.licenseClass && <p className="text-xs text-zinc-500 mt-0.5">Führerschein: {app.licenseClass}</p>}
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3">
              <p className="text-xs text-zinc-500 mb-1">Verfügbarkeit</p>
              <p className="font-medium">{app.availability ? AVAILABILITY_LABEL[app.availability] : '—'}</p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3">
              <p className="text-xs text-zinc-500 mb-1">Beworben am</p>
              <p className="font-medium">{fmt(app.appliedAt)}</p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3">
              <p className="text-xs text-zinc-500 mb-1">Läuft ab</p>
              <p className={cn('font-medium', new Date(app.expiresAt) < new Date() ? 'text-red-500' : '')}>
                {fmt(app.expiresAt)}
              </p>
            </div>
            {app.referralCode && (
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 col-span-2">
                <p className="text-xs text-zinc-500 mb-1">Empfehlungscode</p>
                <p className="font-mono font-medium">{app.referralCode}</p>
              </div>
            )}
          </div>

          {/* Cover Letter */}
          {app.coverLetter && (
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />Anschreiben</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{app.coverLetter}</p>
            </div>
          )}

          {/* Status-Aktionen */}
          <div>
            <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">Status ändern</p>
            <div className="flex flex-wrap gap-2">
              {(['pending', 'reviewing', 'approved', 'rejected', 'withdrawn'] as ApplicationStatus[])
                .filter((s) => s !== currentStatus)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    disabled={updatingStatus !== null}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-lg font-medium transition-all border',
                      s === 'approved'  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' :
                      s === 'reviewing' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800' :
                      s === 'rejected'  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800' :
                      'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
                    )}
                  >
                    {updatingStatus === s ? <Loader2 className="w-3 h-3 animate-spin inline" /> : null}
                    {' '}{STATUS_LABEL[s]}
                  </button>
                ))
              }
            </div>
          </div>

          {/* Onboarding-Checkliste */}
          {(currentStatus === 'reviewing' || currentStatus === 'approved') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Onboarding-Checkliste</p>
                {steps.length > 0 && (
                  <span className="text-xs text-zinc-500">
                    {completedSteps}/{steps.length} erledigt · {completedRequired}/{requiredSteps} Pflicht
                  </span>
                )}
              </div>
              {loadingSteps ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400 p-3">
                  <Loader2 className="w-4 h-4 animate-spin" /> Lade Steps…
                </div>
              ) : steps.length === 0 ? (
                <p className="text-sm text-zinc-400 p-3">Keine Steps gefunden.</p>
              ) : (
                <div className="space-y-1.5">
                  {steps.sort((a, b) => a.stepOrder - b.stepOrder).map((step) => (
                    <button
                      key={step.id}
                      onClick={() => toggleStep(step)}
                      disabled={updatingStep !== null}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                        'bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                        step.status === 'completed' ? 'opacity-70' : '',
                      )}
                    >
                      {updatingStep === step.id
                        ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400 shrink-0" />
                        : <StepIcon status={step.status} />
                      }
                      <span className={cn('text-sm flex-1', step.status === 'completed' ? 'line-through text-zinc-400' : '')}>
                        {step.stepName}
                      </span>
                      {step.required && (
                        <span className="text-xs text-zinc-400 shrink-0">Pflicht</span>
                      )}
                      {step.completedAt && (
                        <span className="text-xs text-zinc-400 shrink-0">{fmt(step.completedAt)}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Admin-Notizen */}
          <div>
            <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">Admin-Notizen</p>
            <textarea
              rows={3}
              value={adminNotes}
              onChange={(e) => { setAdminNotes(e.target.value); setShowNotesSave(true); }}
              placeholder="Interne Notizen zur Bewerbung…"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showNotesSave && (
              <button
                onClick={saveNotes}
                className="mt-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Notizen speichern
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function BewerbungenClient({
  locations,
  defaultLocationId,
}: {
  locations: { id: string; name: string }[];
  defaultLocationId: string | null;
}) {
  const [locationId, setLocationId] = useState(defaultLocationId ?? locations[0]?.id ?? '');
  const [apps, setApps] = useState<Application[]>([]);
  const [funnel, setFunnel] = useState<FunnelStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [, startTransition] = useTransition();

  const load = useCallback(async (locId: string, status?: ApplicationStatus | 'all', q?: string) => {
    if (!locId) return;
    setLoading(true);
    const params = new URLSearchParams({ location_id: locId });
    if (status && status !== 'all') params.set('status', status);
    if (q) params.set('search', q);

    const [appsRes, funnelRes] = await Promise.all([
      fetch(`/api/delivery/admin/applications?${params}`),
      fetch(`/api/delivery/admin/applications?location_id=${locId}&view=funnel`),
    ]);
    const [appsData, funnelData] = await Promise.all([appsRes.json(), funnelRes.json()]);
    setApps(appsData.applications ?? []);
    setFunnel(funnelData.stats ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(locationId, statusFilter, search || undefined);
  }, [locationId, load]);

  function applyFilters() {
    load(locationId, statusFilter, search || undefined);
  }

  function handleStatusChanged(id: string, status: ApplicationStatus) {
    setApps((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
    if (selectedApp?.id === id) setSelectedApp((prev) => prev ? { ...prev, status } : null);
    load(locationId, statusFilter, search || undefined);
  }

  const filtered = apps.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.firstName.toLowerCase().includes(q) ||
        a.lastName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Location + Refresh */}
      <div className="flex flex-wrap items-center gap-3">
        {locations.length > 1 && (
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => load(locationId, statusFilter, search || undefined)}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl px-3 py-2 border border-zinc-200 dark:border-zinc-700 transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Aktualisieren
        </button>
      </div>

      {/* Funnel KPI Cards */}
      {funnel && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <KpiCard
            label="Ausstehend" value={funnel.pending} color="bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
            onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
            active={statusFilter === 'pending'}
          />
          <KpiCard
            label="In Prüfung" value={funnel.reviewing} color="bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
            onClick={() => setStatusFilter(statusFilter === 'reviewing' ? 'all' : 'reviewing')}
            active={statusFilter === 'reviewing'}
          />
          <KpiCard
            label="Genehmigt" value={funnel.approved} color="bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200"
            onClick={() => setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')}
            active={statusFilter === 'approved'}
          />
          <KpiCard
            label="Abgelehnt" value={funnel.rejected} color="bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200"
            onClick={() => setStatusFilter(statusFilter === 'rejected' ? 'all' : 'rejected')}
            active={statusFilter === 'rejected'}
          />
          <KpiCard
            label="Gesamt" value={funnel.totalApplications} color="bg-zinc-50 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
            onClick={() => setStatusFilter('all')}
            active={statusFilter === 'all'}
          />
        </div>
      )}

      {/* Genehmigungsquote */}
      {funnel?.approvalRatePct !== null && funnel?.approvalRatePct !== undefined && (
        <p className="text-xs text-zinc-500">
          Genehmigungsquote: <span className="font-semibold text-green-600">{funnel.approvalRatePct.toFixed(1)} %</span>
          {funnel.expiredPending > 0 && (
            <span className="ml-3 text-amber-600">· {funnel.expiredPending} abgelaufen</span>
          )}
        </p>
      )}

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            placeholder="Name oder E-Mail suchen…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            const v = e.target.value as ApplicationStatus | 'all';
            setStatusFilter(v);
            load(locationId, v, search || undefined);
          }}
          className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Alle Status</option>
          <option value="pending">Ausstehend</option>
          <option value="reviewing">In Prüfung</option>
          <option value="approved">Genehmigt</option>
          <option value="rejected">Abgelehnt</option>
          <option value="withdrawn">Zurückgezogen</option>
        </select>
      </div>

      {/* Applications List */}
      <Card className="rounded-2xl overflow-hidden border-0 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lade Bewerbungen…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
            <User className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-sm font-medium">Keine Bewerbungen gefunden</p>
            <p className="text-xs mt-1 opacity-70">Passe die Filter an oder warte auf neue Bewerbungen.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((app) => (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-sm font-semibold text-zinc-500">
                  {app.firstName[0]}{app.lastName[0]}
                </div>

                {/* Name + Email */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{app.firstName} {app.lastName}</p>
                  <p className="text-xs text-zinc-500 truncate">{app.email}</p>
                </div>

                {/* Vehicle */}
                <div className="hidden sm:flex items-center gap-1 text-xs text-zinc-500 shrink-0">
                  {app.hasVehicle && app.vehicleType
                    ? VEHICLE_LABEL[app.vehicleType]
                    : app.hasVehicle ? 'Kein Typ' : '—'}
                </div>

                {/* Steps progress */}
                {(app.status === 'reviewing' || app.status === 'approved') && app.stepsTotal > 0 && (
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 shrink-0">
                    <div className="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${(app.stepsCompleted / app.stepsTotal) * 100}%` }}
                      />
                    </div>
                    <span>{app.stepsCompleted}/{app.stepsTotal}</span>
                  </div>
                )}

                {/* Status badge */}
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', STATUS_STYLE[app.status])}>
                  {STATUS_LABEL[app.status]}
                </span>

                {/* Date */}
                <span className="hidden md:block text-xs text-zinc-400 shrink-0">{fmt(app.appliedAt)}</span>

                <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      {selectedApp && (
        <DetailModal
          app={selectedApp}
          locationId={locationId}
          onClose={() => setSelectedApp(null)}
          onStatusChanged={handleStatusChanged}
        />
      )}
    </div>
  );
}
