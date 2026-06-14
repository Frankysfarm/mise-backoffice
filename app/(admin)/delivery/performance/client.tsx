'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, Activity } from 'lucide-react';

interface DriverPerf {
  driver_id: string;
  vehicle: string;
  active: boolean;
  state: string;
  total_deliveries: number;
  current_capacity: number;
  max_capacity: number;
  deliveries_today: number;
  deliveries_yesterday: number;
  active_batch_id: string | null;
  last_position: { lat: number; lng: number; at: string } | null;
  last_delivery_at: string | null;
  employee_name: string | null;
}

const STATE_CONFIG: Record<string, { label: string; badge: string }> = {
  available:   { label: 'Verfügbar',  badge: 'bg-matcha-50 border-matcha-200 text-matcha-700' },
  on_delivery: { label: 'Unterwegs',  badge: 'bg-blue-50 border-blue-200 text-blue-700' },
  break:       { label: 'Pause',      badge: 'bg-amber-50 border-amber-200 text-amber-700' },
  offline:     { label: 'Offline',    badge: 'bg-muted border-border text-muted-foreground' },
};

export function PerformanceClient({ locationId }: { locationId: string }) {
  const [drivers, setDrivers] = useState<DriverPerf[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`/api/delivery/admin/performance?location_id=${locationId}&limit=50`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.drivers) setDrivers(d.drivers as DriverPerf[]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId]);

  const activeDrivers = drivers.filter(d => d.active);
  const totalToday = drivers.reduce((s, d) => s + d.deliveries_today, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
      </div>

      {/* Summary KPIs */}
      {!loading && drivers.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-xl border bg-matcha-50 border-matcha-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Fahrer aktiv</div>
            <div className="font-display text-2xl font-black text-matcha-700">{activeDrivers.length}</div>
            <div className="text-[11px] text-muted-foreground">von {drivers.length} gesamt</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Lieferungen heute</div>
            <div className="font-display text-2xl font-black">{totalToday}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Mit aktivem Batch</div>
            <div className="font-display text-2xl font-black">{drivers.filter(d => d.active_batch_id).length}</div>
          </div>
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Performance-Daten…</div>}

      {!loading && drivers.length === 0 && (
        <div className="flex items-center gap-2 justify-center py-16 text-muted-foreground text-sm">
          <Activity className="h-4 w-4" />
          Keine Fahrer gefunden.
        </div>
      )}

      {!loading && drivers.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2">Fahrer</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Fahrzeug</th>
                  <th className="text-left px-4 py-2">Heute</th>
                  <th className="text-left px-4 py-2">Gestern</th>
                  <th className="text-left px-4 py-2">Kapazität</th>
                  <th className="text-left px-4 py-2">Letzter Stop</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(d => {
                  const sc = STATE_CONFIG[d.state] ?? { label: d.state, badge: 'bg-muted border-border text-muted-foreground' };
                  return (
                    <tr key={d.driver_id} className={cn('border-t border-border', !d.active && 'opacity-50')}>
                      <td className="px-4 py-2.5 text-sm font-medium">{d.employee_name ?? d.driver_id.slice(0, 8)}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold border', sc.badge)}>{sc.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{d.vehicle || '—'}</td>
                      <td className="px-4 py-2.5 text-sm tabular-nums font-bold">{d.deliveries_today}</td>
                      <td className="px-4 py-2.5 text-sm tabular-nums text-muted-foreground">{d.deliveries_yesterday}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-matcha-500 rounded-full"
                              style={{ width: `${d.max_capacity > 0 ? Math.round((d.current_capacity / d.max_capacity) * 100) : 0}%` }} />
                          </div>
                          <span className="text-xs tabular-nums">{d.current_capacity}/{d.max_capacity}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {d.last_delivery_at
                          ? new Date(d.last_delivery_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
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
