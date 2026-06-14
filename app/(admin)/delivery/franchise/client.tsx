'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, Building2, AlertTriangle } from 'lucide-react';

interface LocationStatus {
  location_id: string;
  location_name: string;
  queue_depth: number;
  active_tours: number;
  cooking_now: number;
  oldest_queued_min: number | null;
  completed_today: number;
  active_alerts: number;
  critical_alerts: number;
  health: 'ok' | 'warning' | 'critical';
}

interface TenantDriverStatus {
  online: number;
  active: number;
  idle: number;
  offline: number;
}

interface FranchiseAlert {
  id: string;
  location_id: string;
  location_name: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  created_at: string;
}

interface FranchiseSummary {
  locations: LocationStatus[];
  drivers: TenantDriverStatus;
  alerts: FranchiseAlert[];
  totals: {
    queue_depth: number;
    active_tours: number;
    cooking_now: number;
    completed_today: number;
    active_alerts: number;
    critical_alerts: number;
  };
  generated_at: string;
  _fallback?: boolean;
}

const HEALTH_CONFIG = {
  ok:       { label: 'OK',       badge: 'bg-matcha-50 border-matcha-200 text-matcha-700' },
  warning:  { label: 'Warnung',  badge: 'bg-amber-50 border-amber-200 text-amber-700' },
  critical: { label: 'Kritisch', badge: 'bg-red-50 border-red-200 text-red-700' },
};

const SEVERITY_CONFIG = {
  info:     { badge: 'bg-blue-50 border-blue-200 text-blue-700' },
  warning:  { badge: 'bg-amber-50 border-amber-200 text-amber-700' },
  critical: { badge: 'bg-red-50 border-red-200 text-red-700' },
};

export function FranchiseClient({ locationId }: { locationId: string }) {
  const [summary, setSummary] = useState<FranchiseSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch('/api/delivery/admin/franchise?action=overview')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.totals) setSummary(d as FranchiseSummary); })
      .catch(() => {})
      .finally(() => setLoading(false));
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

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Franchise-Daten…</div>}

      {!loading && summary && (
        <>
          {summary._fallback && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
              Live-Status-View noch nicht verfügbar (Migration 028 ausstehend). Zeige Standardwerte.
            </div>
          )}

          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Queue gesamt</div>
              <div className="font-display text-2xl font-black">{summary.totals.queue_depth}</div>
            </div>
            <div className="rounded-xl border bg-blue-50 border-blue-200 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Aktive Touren</div>
              <div className="font-display text-2xl font-black text-blue-700">{summary.totals.active_tours}</div>
            </div>
            <div className="rounded-xl border bg-matcha-50 border-matcha-200 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Abgeschlossen heute</div>
              <div className="font-display text-2xl font-black text-matcha-700">{summary.totals.completed_today}</div>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Fahrer online</div>
              <div className="font-display text-2xl font-black">{summary.drivers.online}</div>
              <div className="text-[11px] text-muted-foreground">{summary.drivers.active} aktiv · {summary.drivers.idle} idle</div>
            </div>
            <div className={cn('rounded-xl border px-4 py-3', summary.totals.critical_alerts > 0 ? 'bg-red-50 border-red-200' : summary.totals.active_alerts > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card')}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Alarme</div>
              <div className={cn('font-display text-2xl font-black', summary.totals.critical_alerts > 0 ? 'text-red-700' : summary.totals.active_alerts > 0 ? 'text-amber-700' : '')}>
                {summary.totals.active_alerts}
              </div>
              {summary.totals.critical_alerts > 0 && (
                <div className="text-[11px] text-red-600 font-bold">{summary.totals.critical_alerts} kritisch</div>
              )}
            </div>
          </div>

          {/* Location grid */}
          {summary.locations.length > 0 && (
            <div className="space-y-3">
              <div className="font-display font-bold text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-matcha-700" /> Standorte ({summary.locations.length})
              </div>
              {summary.locations.map(loc => {
                const hc = HEALTH_CONFIG[loc.health];
                return (
                  <div key={loc.location_id} className={cn('rounded-xl border bg-card p-4', loc.health === 'critical' && 'border-red-200', loc.health === 'warning' && 'border-amber-200')}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="font-display font-bold flex-1">{loc.location_name}</div>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold border', hc.badge)}>{hc.label}</span>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3 text-center">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Queue</div>
                        <div className="font-bold text-lg">{loc.queue_depth}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Touren</div>
                        <div className="font-bold text-lg">{loc.active_tours}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Kochen</div>
                        <div className="font-bold text-lg">{loc.cooking_now}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Heute</div>
                        <div className="font-bold text-lg text-matcha-700">{loc.completed_today}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Alarme</div>
                        <div className={cn('font-bold text-lg', loc.critical_alerts > 0 ? 'text-red-600' : loc.active_alerts > 0 ? 'text-amber-600' : '')}>
                          {loc.active_alerts}
                        </div>
                      </div>
                    </div>
                    {loc.oldest_queued_min !== null && loc.oldest_queued_min > 5 && (
                      <div className="mt-2 text-xs text-amber-700 font-bold">
                        ⚠ Älteste Bestellung wartet seit {loc.oldest_queued_min} Min
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Active alerts */}
          {summary.alerts.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-red-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="font-semibold text-sm text-red-800">Aktive Alarme ({summary.alerts.length})</span>
              </div>
              <div className="divide-y divide-red-100">
                {summary.alerts.map(alert => {
                  const sc = SEVERITY_CONFIG[alert.severity];
                  return (
                    <div key={alert.id} className="px-4 py-2.5 flex items-start gap-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold border shrink-0 mt-0.5', sc.badge)}>
                        {alert.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-red-900">{alert.message}</div>
                        <div className="text-xs text-red-700">{alert.location_name}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
