'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';

type ComplianceLevel = 'compliant' | 'expiring_soon' | 'partial' | 'non_compliant' | 'no_certs';

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
  certType: string;
  certNumber: string | null;
  expiresAt: string;
  daysUntilExpiry: number;
  notes: string | null;
}

const LEVEL_CONFIG: Record<ComplianceLevel, { label: string; badge: string }> = {
  compliant: { label: 'Konform', badge: 'bg-matcha-50 border-matcha-200 text-matcha-700' },
  expiring_soon: { label: 'Läuft bald ab', badge: 'bg-amber-50 border-amber-200 text-amber-700' },
  partial: { label: 'Teilweise', badge: 'bg-blue-50 border-blue-200 text-blue-700' },
  non_compliant: { label: 'Nicht konform', badge: 'bg-red-50 border-red-300 text-red-700' },
  no_certs: { label: 'Keine Zertifikate', badge: 'bg-muted border-border text-muted-foreground' },
};

const CERT_TYPE_LABELS: Record<string, string> = {
  food_hygiene: 'Lebensmittelhygiene',
  drivers_license: 'Führerschein',
  vehicle_inspection: 'Fahrzeugprüfung',
  food_handler: 'Lebensmittelhandler',
  id_verification: 'Identitätsprüfung',
  other: 'Sonstiges',
};

export function ComplianceClient({ locationId }: { locationId: string }) {
  const [overview, setOverview] = useState<LocationComplianceOverview | null>(null);
  const [expiring, setExpiring] = useState<ExpiringSoonCert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/delivery/admin/compliance?location_id=${locationId}&view=overview`).then(r => r.ok ? r.json() : null),
      fetch(`/api/delivery/admin/compliance?location_id=${locationId}&view=expiring&days=30`).then(r => r.ok ? r.json() : null),
    ]).then(([ov, exp]) => {
      if (ov?.totalDrivers !== undefined) setOverview(ov as LocationComplianceOverview);
      if (exp?.certs) setExpiring(exp.certs as ExpiringSoonCert[]);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Compliance-Daten…</div>}

      {!loading && overview && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-matcha-50 border-matcha-200 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Konform</div>
              <div className="font-display text-2xl font-black text-matcha-700">{overview.compliant}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">von {overview.totalDrivers} Fahrern</div>
            </div>
            <div className={cn('rounded-xl border px-4 py-3', overview.expiringSoon > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card')}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Läuft bald ab</div>
              <div className={cn('font-display text-2xl font-black', overview.expiringSoon > 0 ? 'text-amber-700' : '')}>{overview.expiringSoon}</div>
            </div>
            <div className={cn('rounded-xl border px-4 py-3', overview.nonCompliant > 0 ? 'bg-red-50 border-red-200' : 'bg-card')}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Nicht konform</div>
              <div className={cn('font-display text-2xl font-black', overview.nonCompliant > 0 ? 'text-red-700' : '')}>{overview.nonCompliant}</div>
            </div>
            <div className={cn('rounded-xl border px-4 py-3', overview.blockedForDispatch > 0 ? 'bg-red-50 border-red-200' : 'bg-card')}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Dispatch gesperrt</div>
              <div className={cn('font-display text-2xl font-black', overview.blockedForDispatch > 0 ? 'text-red-700' : '')}>{overview.blockedForDispatch}</div>
            </div>
          </div>

          {/* Expiring soon */}
          {expiring.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-sm text-amber-800">In den nächsten 30 Tagen ablaufend</span>
              </div>
              <div className="divide-y divide-amber-100">
                {expiring.map(c => (
                  <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-amber-900">{CERT_TYPE_LABELS[c.certType] ?? c.certType}</div>
                      {c.certNumber && <div className="text-[11px] text-amber-700">Nr. {c.certNumber}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-amber-800">{c.daysUntilExpiry} Tage</div>
                      <div className="text-[11px] text-amber-700">{new Date(c.expiresAt).toLocaleDateString('de-DE')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Driver list */}
          {overview.drivers.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-matcha-700" />
                <span className="font-semibold text-sm">Compliance nach Fahrer</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                      <th className="text-left px-4 py-2">Fahrer</th>
                      <th className="text-left px-4 py-2">Status</th>
                      <th className="text-left px-4 py-2">Aktiv</th>
                      <th className="text-left px-4 py-2">Abgelaufen</th>
                      <th className="text-left px-4 py-2">Bald ablaufend</th>
                      <th className="text-left px-4 py-2">Dispatch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.drivers.map(d => {
                      const cfg = LEVEL_CONFIG[d.complianceStatus];
                      return (
                        <tr key={d.driverId} className="border-t border-border">
                          <td className="px-4 py-2.5 text-sm font-medium">{d.driverId.slice(0, 8)}</td>
                          <td className="px-4 py-2.5">
                            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold border', cfg.badge)}>{cfg.label}</span>
                          </td>
                          <td className="px-4 py-2.5 text-sm tabular-nums">{d.activeCerts}</td>
                          <td className="px-4 py-2.5 text-sm tabular-nums text-red-600">{d.expiredCerts > 0 ? d.expiredCerts : '—'}</td>
                          <td className="px-4 py-2.5 text-sm tabular-nums text-amber-600">{d.expiringSoonCount > 0 ? d.expiringSoonCount : '—'}</td>
                          <td className="px-4 py-2.5">
                            {d.dispatchBlocked
                              ? <span className="text-[11px] text-red-600 font-bold">⛔ Gesperrt</span>
                              : <span className="text-[11px] text-matcha-700 font-bold">✓ OK</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {overview.totalDrivers === 0 && (
            <div className="flex items-center gap-2 justify-center py-16 text-muted-foreground text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Keine Fahrer gefunden.
            </div>
          )}
        </>
      )}
    </div>
  );
}
