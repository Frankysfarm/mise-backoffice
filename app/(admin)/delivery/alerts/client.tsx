'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bell, CheckCircle2, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';

type AlertSeverity = 'info' | 'warning' | 'critical';

interface DeliveryAlert {
  id: string;
  alert_type: string;
  severity: AlertSeverity;
  message: string;
  details: Record<string, unknown> | null;
  auto_resolve: boolean;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface AlertsData {
  alerts: DeliveryAlert[];
  total: number;
  critical: number;
  warning: number;
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  dispatch_queue_high: 'Dispatch-Queue voll',
  no_drivers_online: 'Kein Fahrer online',
  kitchen_overload: 'Küche überlastet',
  stale_orders_critical: 'Bestellungen feststeckend',
  eta_accuracy_low: 'ETA-Genauigkeit niedrig',
};

function severityBadge(severity: AlertSeverity) {
  if (severity === 'critical') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-red-50 border-red-300 text-red-700">Kritisch</span>;
  if (severity === 'warning') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-amber-50 border-amber-200 text-amber-700">Warnung</span>;
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-blue-50 border-blue-200 text-blue-700">Info</span>;
}

function severityIcon(severity: AlertSeverity) {
  if (severity === 'critical') return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  if (severity === 'warning') return <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />;
  return <Bell className="h-4 w-4 text-blue-500 shrink-0" />;
}

export function AlertsClient({ locationId }: { locationId: string }) {
  const [view, setView] = useState<'active' | 'history'>('active');
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/delivery/admin/alerts?location_id=${locationId}&view=${view}&limit=50`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.alerts) setData(d as AlertsData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, view]);

  useEffect(() => { load(); }, [load]);

  const evaluate = async () => {
    await fetch('/api/delivery/admin/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, action: 'evaluate' }),
    });
    load();
  };

  const resolveAll = async () => {
    setResolving(true);
    await fetch('/api/delivery/admin/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, action: 'resolve_all' }),
    });
    setResolving(false);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Tabs + Aktionen */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['active', 'history'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
              view === v
                ? 'bg-matcha-700 text-white border-matcha-700'
                : 'bg-card border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {v === 'active' ? 'Aktiv' : 'Verlauf'}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={evaluate}
            disabled={loading}
            className="rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50"
          >
            Regeln prüfen
          </button>
          {view === 'active' && data && data.total > 0 && (
            <button
              onClick={resolveAll}
              disabled={resolving}
              className="rounded-lg border border-red-300 bg-red-50 text-red-700 px-3 py-1.5 text-sm font-semibold hover:bg-red-100 transition disabled:opacity-50"
            >
              {resolving ? '…' : 'Alle auflösen'}
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Zusammenfassung */}
      {!loading && data && view === 'active' && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Gesamt aktiv</div>
            <div className="font-display text-2xl font-black">{data.total}</div>
          </div>
          <div className={cn('rounded-xl border px-4 py-3', (data.critical ?? 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-card')}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Kritisch</div>
            <div className={cn('font-display text-2xl font-black', (data.critical ?? 0) > 0 ? 'text-red-700' : '')}>{data.critical ?? 0}</div>
          </div>
          <div className={cn('rounded-xl border px-4 py-3', (data.warning ?? 0) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card')}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Warnungen</div>
            <div className={cn('font-display text-2xl font-black', (data.warning ?? 0) > 0 ? 'text-amber-700' : '')}>{data.warning ?? 0}</div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Alarme…</div>
      )}

      {!loading && data && data.alerts.length === 0 && (
        <div className="flex items-center gap-2 justify-center py-16 text-muted-foreground text-sm">
          <CheckCircle2 className="h-4 w-4 text-matcha-600" />
          {view === 'active' ? 'Keine aktiven Alarme.' : 'Kein Alarmverlauf.'}
        </div>
      )}

      {!loading && data && data.alerts.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {data.alerts.map(alert => (
              <div key={alert.id} className="px-4 py-3 flex items-start gap-3">
                {severityIcon(alert.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">
                      {ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type}
                    </span>
                    {severityBadge(alert.severity)}
                    {alert.resolved_at && (
                      <span className="text-[11px] bg-matcha-50 border border-matcha-200 text-matcha-700 rounded-full px-2 py-0.5 font-bold">Aufgelöst</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{alert.message}</p>
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums shrink-0 text-right">
                  <div>{new Date(alert.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div>{new Date(alert.created_at).toLocaleDateString('de-DE')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
