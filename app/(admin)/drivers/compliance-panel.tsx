'use client';

/**
 * CompliancePanel — Phase 60
 * Fahrer-Zertifikats-Verwaltung + Compliance-Übersicht im Admin.
 * Lädt Daten von GET /api/delivery/admin/compliance
 * Schreibt via POST/DELETE /api/delivery/admin/compliance
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, BadgeCheck, Ban, ChevronDown, ChevronUp,
  Clock, FileText, Loader2, Plus, RefreshCw, ShieldAlert,
  ShieldCheck, Trash2, X,
} from 'lucide-react';

// ─── Types (mirrors lib/delivery/compliance.ts) ────────────────────────────

type CertType = 'food_hygiene' | 'drivers_license' | 'vehicle_inspection' | 'food_handler' | 'id_verification' | 'other';
type CertStatus = 'active' | 'expired' | 'suspended' | 'pending_renewal';
type ComplianceLevel = 'compliant' | 'expiring_soon' | 'partial' | 'non_compliant' | 'no_certs';

interface DriverCertification {
  id: string;
  driverId: string;
  locationId: string;
  certType: CertType;
  certNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  status: CertStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DriverComplianceStatus {
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

interface LocationComplianceOverview {
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

interface ExpiringSoonCert {
  id: string;
  driverId: string;
  certType: CertType;
  certNumber: string | null;
  expiresAt: string;
  daysUntilExpiry: number;
  notes: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const CERT_TYPE_LABELS: Record<CertType, string> = {
  food_hygiene:        'Lebensmittelhygiene',
  drivers_license:     'Führerschein',
  vehicle_inspection:  'Fahrzeugprüfung',
  food_handler:        'Lebensmittelhandhabung',
  id_verification:     'Personalausweis',
  other:               'Sonstiges',
};

const CERT_STATUS_LABELS: Record<CertStatus, string> = {
  active:           'Aktiv',
  expired:          'Abgelaufen',
  suspended:        'Gesperrt',
  pending_renewal:  'Verlängerung ausstehend',
};

const COMPLIANCE_LABELS: Record<ComplianceLevel, string> = {
  compliant:     'Konform',
  expiring_soon: 'Läuft bald ab',
  partial:       'Teilweise',
  non_compliant: 'Nicht konform',
  no_certs:      'Keine Zertifikate',
};

const CERT_STATUS_COLORS: Record<CertStatus, string> = {
  active:           'bg-emerald-100 text-emerald-800',
  expired:          'bg-red-100 text-red-800',
  suspended:        'bg-red-200 text-red-900 font-bold',
  pending_renewal:  'bg-amber-100 text-amber-800',
};

const COMPLIANCE_COLORS: Record<ComplianceLevel, string> = {
  compliant:     'bg-emerald-100 text-emerald-800',
  expiring_soon: 'bg-amber-100 text-amber-800',
  partial:       'bg-orange-100 text-orange-800',
  non_compliant: 'bg-red-100 text-red-900 font-bold',
  no_certs:      'bg-slate-100 text-slate-600',
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, tone }: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: 'green' | 'amber' | 'red' | 'slate' | 'orange';
}) {
  const toneClasses = {
    green:  'border-emerald-200 bg-emerald-50',
    amber:  'border-amber-200 bg-amber-50',
    red:    'border-red-200 bg-red-50',
    orange: 'border-orange-200 bg-orange-50',
    slate:  'border-slate-200 bg-slate-50',
  };
  const iconClasses = {
    green:  'text-emerald-600',
    amber:  'text-amber-600',
    red:    'text-red-600',
    orange: 'text-orange-600',
    slate:  'text-slate-500',
  };
  return (
    <div className={cn('rounded-2xl border p-4 flex items-center gap-3', toneClasses[tone])}>
      <div className={cn('shrink-0', iconClasses[tone])}>
        <Icon size={20} />
      </div>
      <div>
        <div className={cn('text-2xl font-bold font-display', iconClasses[tone])}>{value}</div>
        <div className="text-xs text-muted-foreground font-medium">{label}</div>
      </div>
    </div>
  );
}

// ─── Cert Form Modal ────────────────────────────────────────────────────────

function CertFormModal({
  locationId,
  driverId,
  onClose,
  onSaved,
}: {
  locationId: string;
  driverId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [certType, setCertType] = useState<CertType>('food_hygiene');
  const [certNumber, setCertNumber] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [status, setStatus] = useState<CertStatus>('active');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/delivery/admin/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id:  locationId,
          driver_id:    driverId,
          cert_type:    certType,
          cert_number:  certNumber || null,
          issued_at:    issuedAt || null,
          expires_at:   expiresAt || null,
          status,
          notes:        notes || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? 'Fehler beim Speichern');
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="font-display text-base font-bold">Zertifikat hinzufügen</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <FormField label="Zertifikatstyp">
            <select
              value={certType}
              onChange={(e) => setCertType(e.target.value as CertType)}
              className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
            >
              {(Object.entries(CERT_TYPE_LABELS) as [CertType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Zertifikatsnummer (optional)">
            <input
              value={certNumber}
              onChange={(e) => setCertNumber(e.target.value)}
              placeholder="z.B. HYG-2024-001"
              className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Ausstellungsdatum">
              <input
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
              />
            </FormField>
            <FormField label="Ablaufdatum">
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
              />
            </FormField>
          </div>

          <FormField label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CertStatus)}
              className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
            >
              {(Object.entries(CERT_STATUS_LABELS) as [CertStatus, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Notizen (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Zusätzliche Hinweise..."
              className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20 resize-none"
            />
          </FormField>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button onClick={onClose} className="px-4 py-2 text-sm">Abbrechen</button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-5 py-2.5 text-sm font-bold hover:bg-matcha-800 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

// ─── Driver Cert Detail Row ─────────────────────────────────────────────────

function CertRow({
  cert,
  locationId,
  onDeleted,
}: {
  cert: DriverCertification;
  locationId: string;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function del() {
    if (!confirm(`Zertifikat "${CERT_TYPE_LABELS[cert.certType]}" wirklich löschen?`)) return;
    setDeleting(true);
    await fetch(
      `/api/delivery/admin/compliance?cert_id=${cert.id}&location_id=${encodeURIComponent(locationId)}`,
      { method: 'DELETE' },
    );
    setDeleting(false);
    onDeleted();
  }

  const daysLeft = cert.expiresAt
    ? Math.ceil((new Date(cert.expiresAt).getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{CERT_TYPE_LABELS[cert.certType]}</span>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', CERT_STATUS_COLORS[cert.status])}>
            {CERT_STATUS_LABELS[cert.status]}
          </span>
          {cert.certType === 'food_hygiene' && cert.status !== 'active' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">
              DISPATCH BLOCKIERT
            </span>
          )}
        </div>
        {cert.certNumber && (
          <div className="text-xs text-muted-foreground mt-0.5 font-mono">#{cert.certNumber}</div>
        )}
        <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
          {cert.issuedAt && <span>Ausgestellt: {cert.issuedAt.slice(0, 10)}</span>}
          {cert.expiresAt && (
            <span className={cn(daysLeft !== null && daysLeft <= 14 ? 'text-red-600 font-semibold' : daysLeft !== null && daysLeft <= 30 ? 'text-amber-600 font-semibold' : '')}>
              Läuft ab: {cert.expiresAt.slice(0, 10)}
              {daysLeft !== null && daysLeft >= 0 && ` (${daysLeft}d)`}
              {daysLeft !== null && daysLeft < 0 && ' (abgelaufen)'}
            </span>
          )}
        </div>
        {cert.notes && (
          <div className="text-xs text-muted-foreground mt-1 italic">{cert.notes}</div>
        )}
      </div>
      <button
        onClick={del}
        disabled={deleting}
        className="shrink-0 rounded-lg p-1.5 hover:bg-red-50 text-muted-foreground hover:text-red-600 transition"
        title="Zertifikat löschen"
      >
        {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      </button>
    </div>
  );
}

// ─── Driver Row ─────────────────────────────────────────────────────────────

function DriverComplianceRow({
  driver,
  locationId,
  driverName,
}: {
  driver: DriverComplianceStatus;
  locationId: string;
  driverName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [certs, setCerts] = useState<DriverCertification[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const loadCerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/compliance?location_id=${encodeURIComponent(locationId)}&view=driver&driver_id=${encodeURIComponent(driver.driverId)}`,
      );
      if (res.ok) {
        const d = await res.json() as { certs: DriverCertification[] };
        setCerts(d.certs);
      }
    } finally {
      setLoading(false);
    }
  }, [locationId, driver.driverId]);

  function toggle() {
    setExpanded((v) => {
      if (!v && certs === null) loadCerts();
      return !v;
    });
  }

  const statusColor = COMPLIANCE_COLORS[driver.complianceStatus];

  return (
    <div className="border-b last:border-0">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{driverName}</span>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', statusColor)}>
              {COMPLIANCE_LABELS[driver.complianceStatus]}
            </span>
            {driver.dispatchBlocked && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white flex items-center gap-1">
                <Ban size={9} /> Dispatch blockiert
              </span>
            )}
          </div>
          <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
            <span>{driver.activeCerts} aktiv</span>
            {driver.expiredCerts > 0 && <span className="text-red-600">{driver.expiredCerts} abgelaufen</span>}
            {driver.expiringSoonCount > 0 && <span className="text-amber-600">{driver.expiringSoonCount} läuft bald ab</span>}
            {driver.vehicle && <span>• {driver.vehicle}</span>}
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
              <Loader2 size={14} className="animate-spin" /> Lade Zertifikate…
            </div>
          )}
          {!loading && certs !== null && (
            <div className="rounded-2xl border bg-white overflow-hidden">
              {certs.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Noch keine Zertifikate hinterlegt.
                </div>
              ) : (
                <div className="px-4">
                  {certs.map((c) => (
                    <CertRow
                      key={c.id}
                      cert={c}
                      locationId={locationId}
                      onDeleted={() => loadCerts()}
                    />
                  ))}
                </div>
              )}
              <div className="border-t px-4 py-3">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-4 py-2 text-xs font-bold hover:bg-matcha-800"
                >
                  <Plus size={12} /> Zertifikat hinzufügen
                </button>
              </div>
            </div>
          )}

          {showAddForm && (
            <CertFormModal
              locationId={locationId}
              driverId={driver.driverId}
              onClose={() => setShowAddForm(false)}
              onSaved={() => { loadCerts(); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main CompliancePanel ───────────────────────────────────────────────────

export function CompliancePanel({
  locationId,
  driverNames,
}: {
  locationId: string;
  driverNames: Record<string, string>;
}) {
  const [overview, setOverview] = useState<LocationComplianceOverview | null>(null);
  const [expiring, setExpiring] = useState<ExpiringSoonCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [lastEval, setLastEval] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, expiringRes] = await Promise.all([
        fetch(`/api/delivery/admin/compliance?location_id=${encodeURIComponent(locationId)}`),
        fetch(`/api/delivery/admin/compliance?location_id=${encodeURIComponent(locationId)}&view=expiring&days=30`),
      ]);
      if (overviewRes.ok) setOverview(await overviewRes.json() as LocationComplianceOverview);
      if (expiringRes.ok) {
        const d = await expiringRes.json() as { certs: ExpiringSoonCert[] };
        setExpiring(d.certs);
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  async function evaluate() {
    setEvaluating(true);
    try {
      await fetch('/api/delivery/admin/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'evaluate', location_id: locationId }),
      });
      setLastEval(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
      await load();
    } finally {
      setEvaluating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Lade Compliance-Daten…</span>
      </div>
    );
  }

  if (!overview) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Compliance-Daten konnten nicht geladen werden. Migration 048 noch nicht ausgeführt?
      </Card>
    );
  }

  // Sort: blocked first, then non_compliant, expiring_soon, partial, no_certs, compliant
  const ORDER: ComplianceLevel[] = ['non_compliant', 'expiring_soon', 'partial', 'no_certs', 'compliant'];
  const sortedDrivers = [...overview.drivers].sort((a, b) => {
    const ai = ORDER.indexOf(a.complianceStatus);
    const bi = ORDER.indexOf(b.complianceStatus);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-matcha-700" />
          <h2 className="font-display text-base font-bold">Compliance & Zertifikate</h2>
          {lastEval && (
            <span className="text-xs text-muted-foreground">Ausgewertet um {lastEval}</span>
          )}
        </div>
        <button
          onClick={evaluate}
          disabled={evaluating}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition"
        >
          {evaluating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Auswerten
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Konform" value={overview.compliant} icon={ShieldCheck} tone="green" />
        <StatCard label="Läuft bald ab" value={overview.expiringSoon} icon={Clock} tone="amber" />
        <StatCard label="Teilweise" value={overview.partial} icon={AlertTriangle} tone="orange" />
        <StatCard label="Nicht konform" value={overview.nonCompliant} icon={ShieldAlert} tone="red" />
        <StatCard label="Keine Certs" value={overview.noCerts} icon={FileText} tone="slate" />
        <StatCard label="Dispatch blockiert" value={overview.blockedForDispatch} icon={Ban} tone="red" />
      </div>

      {/* Expiring Soon Alert */}
      {expiring.length > 0 && (
        <Card className="p-4 border-amber-300 bg-amber-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-700 shrink-0" />
            <span className="text-sm font-bold text-amber-900">
              {expiring.length} Zertifikat{expiring.length !== 1 ? 'e' : ''} läuft{expiring.length === 1 ? '' : 'en'} in den nächsten 30 Tagen ab
            </span>
          </div>
          <div className="space-y-2">
            {expiring.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs text-amber-800">
                <Clock size={11} className="shrink-0" />
                <span className="font-semibold">
                  {driverNames[c.driverId] ?? `Fahrer ${c.driverId.slice(0, 6)}`}
                </span>
                <span>—</span>
                <span>{CERT_TYPE_LABELS[c.certType]}</span>
                <span className="text-amber-600 font-semibold ml-auto">
                  in {c.daysUntilExpiry}d ({c.expiresAt.slice(0, 10)})
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Blocked drivers alert */}
      {overview.blockedForDispatch > 0 && (
        <Card className="p-4 border-red-300 bg-red-50">
          <div className="flex items-center gap-2">
            <Ban size={16} className="text-red-700 shrink-0" />
            <span className="text-sm font-bold text-red-900">
              {overview.blockedForDispatch} Fahrer {overview.blockedForDispatch === 1 ? 'ist' : 'sind'} für den Dispatch blockiert
              — abgelaufene oder gesperrte Lebensmittelhygiene-Zertifikate!
            </span>
          </div>
        </Card>
      )}

      {/* Driver List */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <BadgeCheck size={15} className="text-muted-foreground" />
          <span className="text-sm font-bold">Fahrer ({overview.totalDrivers})</span>
        </div>
        {sortedDrivers.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Keine Fahrer-Compliance-Daten vorhanden. Zuerst Fahrer anlegen.
          </div>
        ) : (
          <div>
            {sortedDrivers.map((d) => (
              <DriverComplianceRow
                key={d.driverId}
                driver={d}
                locationId={locationId}
                driverName={
                  driverNames[d.driverId] ??
                  (d.employeeId ? driverNames[d.employeeId] : null) ??
                  `Fahrer ${d.driverId.slice(0, 6)}`
                }
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
