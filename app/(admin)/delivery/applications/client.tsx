'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, CheckCircle2, XCircle, Clock, UserPlus } from 'lucide-react';

type ApplicationStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'withdrawn';

interface DriverApplication {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hasVehicle: boolean;
  vehicleType: string | null;
  availability: string | null;
  status: ApplicationStatus;
  adminNotes: string | null;
  appliedAt: string;
}

interface FunnelStats {
  totalApplications: number;
  pending: number;
  reviewing: number;
  approved: number;
  rejected: number;
  withdrawn: number;
  expiredPending: number;
  approvalRatePct: number | null;
}

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; badge: string }> = {
  pending:    { label: 'Ausstehend',  badge: 'bg-amber-50 border-amber-200 text-amber-700' },
  reviewing:  { label: 'In Prüfung', badge: 'bg-blue-50 border-blue-200 text-blue-700' },
  approved:   { label: 'Genehmigt',  badge: 'bg-matcha-50 border-matcha-200 text-matcha-700' },
  rejected:   { label: 'Abgelehnt',  badge: 'bg-red-50 border-red-200 text-red-700' },
  withdrawn:  { label: 'Zurückgez.', badge: 'bg-muted border-border text-muted-foreground' },
};

const AVAILABILITY_LABELS: Record<string, string> = {
  fulltime: 'Vollzeit',
  parttime: 'Teilzeit',
  weekends: 'Wochenende',
  evenings: 'Abends',
  flexible: 'Flexibel',
};

const VEHICLE_LABELS: Record<string, string> = {
  bicycle: 'Fahrrad',
  moped:   'Moped',
  car:     'Auto',
  scooter: 'Scooter',
  ebike:   'E-Bike',
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Alle' },
  { value: 'pending', label: 'Ausstehend' },
  { value: 'reviewing', label: 'In Prüfung' },
  { value: 'approved', label: 'Genehmigt' },
  { value: 'rejected', label: 'Abgelehnt' },
];

export function ApplicationsClient({ locationId }: { locationId: string }) {
  const [funnel, setFunnel] = useState<FunnelStats | null>(null);
  const [applications, setApplications] = useState<DriverApplication[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const qs = statusFilter ? `&status=${statusFilter}` : '';
    Promise.all([
      fetch(`/api/delivery/admin/applications?location_id=${locationId}&view=funnel`).then(r => r.ok ? r.json() : null),
      fetch(`/api/delivery/admin/applications?location_id=${locationId}${qs}&limit=50`).then(r => r.ok ? r.json() : null),
    ]).then(([f, a]) => {
      if (f?.stats) setFunnel(f.stats as FunnelStats);
      if (a?.applications) setApplications(a.applications as DriverApplication[]);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId, statusFilter]);

  const updateStatus = async (id: string, status: ApplicationStatus) => {
    setUpdating(id);
    setError(null);
    const res = await fetch(`/api/delivery/admin/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, status }),
    });
    if (res.ok) {
      setApplications(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } else {
      const json = await res.json();
      setError(json.error ?? 'Fehler beim Aktualisieren');
    }
    setUpdating(null);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
        {STATUS_FILTERS.map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={cn('rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
              statusFilter === f.value ? 'bg-matcha-700 border-matcha-700 text-white' : 'bg-card border-border text-muted-foreground hover:bg-muted')}>
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">{error}</div>
      )}

      {/* Funnel KPIs */}
      {funnel && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-amber-50 border-amber-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ausstehend</div>
            <div className="font-display text-2xl font-black text-amber-700">{funnel.pending}</div>
          </div>
          <div className="rounded-xl border bg-blue-50 border-blue-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">In Prüfung</div>
            <div className="font-display text-2xl font-black text-blue-700">{funnel.reviewing}</div>
          </div>
          <div className="rounded-xl border bg-matcha-50 border-matcha-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Genehmigt</div>
            <div className="font-display text-2xl font-black text-matcha-700">{funnel.approved}</div>
            {funnel.approvalRatePct !== null && (
              <div className="text-[11px] text-muted-foreground">{funnel.approvalRatePct.toFixed(0)} % Rate</div>
            )}
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Gesamt</div>
            <div className="font-display text-2xl font-black">{funnel.totalApplications}</div>
            <div className="text-[11px] text-muted-foreground">{funnel.rejected} abgel. · {funnel.expiredPending} abgel.</div>
          </div>
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Bewerbungen…</div>}

      {/* Applications list */}
      {!loading && applications.length === 0 && (
        <div className="flex items-center gap-2 justify-center py-16 text-muted-foreground text-sm">
          <UserPlus className="h-4 w-4" />
          Keine Bewerbungen gefunden.
        </div>
      )}

      {!loading && applications.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Kontakt</th>
                  <th className="text-left px-4 py-2">Fahrzeug</th>
                  <th className="text-left px-4 py-2">Verfügbarkeit</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Beworben</th>
                  <th className="text-left px-4 py-2">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => {
                  const cfg = STATUS_CONFIG[app.status];
                  return (
                    <tr key={app.id} className="border-t border-border">
                      <td className="px-4 py-2.5 text-sm font-medium">{app.firstName} {app.lastName}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        <div>{app.email}</div>
                        <div>{app.phone}</div>
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        {app.hasVehicle && app.vehicleType ? VEHICLE_LABELS[app.vehicleType] ?? app.vehicleType : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        {app.availability ? AVAILABILITY_LABELS[app.availability] ?? app.availability : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold border', cfg.badge)}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {new Date(app.appliedAt).toLocaleDateString('de-DE')}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {app.status === 'pending' && (
                            <button onClick={() => updateStatus(app.id, 'reviewing')} disabled={updating === app.id}
                              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                              <Clock className="h-3 w-3" /> Prüfen
                            </button>
                          )}
                          {(app.status === 'pending' || app.status === 'reviewing') && (
                            <>
                              <button onClick={() => updateStatus(app.id, 'approved')} disabled={updating === app.id}
                                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold bg-matcha-50 text-matcha-700 hover:bg-matcha-100 disabled:opacity-50">
                                <CheckCircle2 className="h-3 w-3" /> OK
                              </button>
                              <button onClick={() => updateStatus(app.id, 'rejected')} disabled={updating === app.id}
                                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50">
                                <XCircle className="h-3 w-3" /> Abl.
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
