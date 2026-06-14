'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bike, MapPin, RefreshCw, Wifi } from 'lucide-react';

interface TrailPoint {
  lat: number;
  lng: number;
  speed_kmh: number | null;
  recorded_at: string;
}

interface DriverTrail {
  driver_id: string;
  driver_name: string;
  driver_state: string;
  vehicle: string;
  trail_points: TrailPoint[];
  last_lat: number | null;
  last_lng: number | null;
  last_seen: string | null;
}

interface GpsData {
  drivers: DriverTrail[];
  location_id: string;
  generated_at: string;
  _fallback?: boolean;
}

function stateColor(state: string) {
  if (state === 'delivering') return 'bg-matcha-100 text-matcha-800';
  if (state === 'online') return 'bg-blue-100 text-blue-700';
  if (state === 'returning') return 'bg-amber-100 text-amber-700';
  return 'bg-muted text-muted-foreground';
}

const STATE_LABELS: Record<string, string> = {
  delivering: 'Liefert',
  online: 'Online',
  returning: 'Rückkehr',
  offline: 'Offline',
};

function minsAgo(iso: string | null): string {
  if (!iso) return '—';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Gerade eben';
  return `vor ${mins} Min`;
}

function avgSpeed(points: TrailPoint[]): string {
  const valid = points.filter(p => p.speed_kmh !== null && p.speed_kmh > 0);
  if (valid.length === 0) return '—';
  const avg = valid.reduce((s, p) => s + (p.speed_kmh ?? 0), 0) / valid.length;
  return `${Math.round(avg)} km/h`;
}

export function GpsTrailsClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<GpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/delivery/admin/gps-trails?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d as GpsData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const activeDrivers = (data?.drivers ?? []).filter(d => d.driver_state !== 'offline');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground flex items-center gap-1">
          <Wifi className="h-3 w-3" />
          {data?.generated_at ? `Stand: ${new Date(data.generated_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
          {' · automatisch alle 30 Sek.'}
        </span>
      </div>

      {data?._fallback && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          GPS-Tracking-Tabellen noch nicht eingerichtet (Migration 029 ausstehend).
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">Lade GPS-Daten…</div>
      )}

      {/* Stats */}
      {data && !data._fallback && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Fahrer gesamt</div>
            <div className="font-display text-2xl font-black">{data.drivers.length}</div>
          </div>
          <div className="rounded-xl border bg-matcha-50 border-matcha-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Aktiv</div>
            <div className="font-display text-2xl font-black text-matcha-700">{activeDrivers.length}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Liefern gerade</div>
            <div className="font-display text-2xl font-black">{data.drivers.filter(d => d.driver_state === 'delivering').length}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Mit GPS-Spur</div>
            <div className="font-display text-2xl font-black">{data.drivers.filter(d => d.trail_points.length > 0).length}</div>
          </div>
        </div>
      )}

      {/* Driver list */}
      {data && !data._fallback && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <MapPin className="h-4 w-4 text-matcha-700" />
            <span className="font-semibold text-sm">Fahrer-Positionen</span>
          </div>
          <div className="divide-y divide-border">
            {data.drivers.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Keine Fahrer aktiv.</div>
            )}
            {data.drivers.map(driver => (
              <div key={driver.driver_id}>
                <button
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition text-left"
                  onClick={() => setExpanded(expanded === driver.driver_id ? null : driver.driver_id)}
                >
                  <div className="h-8 w-8 rounded-full bg-matcha-100 text-matcha-800 flex items-center justify-center text-xs font-bold shrink-0">
                    <Bike className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{driver.driver_name}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', stateColor(driver.driver_state))}>
                        {STATE_LABELS[driver.driver_state] ?? driver.driver_state}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {driver.trail_points.length} Punkte · Zuletzt gesehen {minsAgo(driver.last_seen)}
                      {driver.trail_points.length > 0 ? ` · Ø ${avgSpeed(driver.trail_points)}` : ''}
                    </div>
                  </div>
                  {driver.last_lat && driver.last_lng && (
                    <div className="text-[11px] text-muted-foreground tabular-nums shrink-0 text-right">
                      <div>{driver.last_lat.toFixed(4)}</div>
                      <div>{driver.last_lng.toFixed(4)}</div>
                    </div>
                  )}
                </button>

                {/* Expanded trail points */}
                {expanded === driver.driver_id && driver.trail_points.length > 0 && (
                  <div className="bg-muted/20 border-t border-border px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Letzte GPS-Punkte</div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {driver.trail_points.slice(-10).reverse().map((pt, i) => (
                        <div key={i} className="flex items-center gap-3 text-[11px] tabular-nums">
                          <span className="text-muted-foreground w-14 shrink-0">
                            {new Date(pt.recorded_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span>{pt.lat.toFixed(5)}, {pt.lng.toFixed(5)}</span>
                          {pt.speed_kmh !== null && <span className="text-muted-foreground">{Math.round(pt.speed_kmh)} km/h</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
