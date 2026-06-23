'use client';

import { useEffect, useState } from 'react';
import { MapPin, Wifi, WifiOff, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverPosition {
  driver_id: string;
  driver_name: string | null;
  lat: number;
  lng: number;
  heading: number | null;
  speed_kmh: number | null;
  recorded_at: string;
  batch_status: string | null;
  staleSec: number;
}

interface Props {
  locationId: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  unterwegs: 'bg-matcha-500',
  on_route: 'bg-matcha-500',
  pickup: 'bg-amber-500',
  at_restaurant: 'bg-blue-500',
  idle: 'bg-gray-400',
  online: 'bg-matcha-400',
};

function latLngToRelative(
  positions: DriverPosition[],
  width = 100,
  height = 80,
): { x: number; y: number; d: DriverPosition }[] {
  if (positions.length === 0) return [];
  const lats = positions.map((p) => p.lat);
  const lngs = positions.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.01;
  const lngRange = maxLng - minLng || 0.01;
  const pad = 10;

  return positions.map((d) => ({
    x: pad + ((d.lng - minLng) / lngRange) * (width - 2 * pad),
    y: pad + ((maxLat - d.lat) / latRange) * (height - 2 * pad),
    d,
  }));
}

export function DispatchFahrzeugTrackingOverlay({ locationId }: Props) {
  const [positions, setPositions] = useState<DriverPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/gps-trails?location_id=${encodeURIComponent(locationId)}&action=live&limit=30`)
      .then((r) => r.json())
      .then((d) => {
        const now = Date.now();
        const rows: DriverPosition[] = (d.positions ?? d.drivers ?? d.data ?? []).map((p: Record<string, unknown>) => ({
          driver_id: p.driver_id as string,
          driver_name: (p.driver_name ?? p.name ?? null) as string | null,
          lat: Number(p.lat ?? p.latitude ?? 0),
          lng: Number(p.lng ?? p.longitude ?? 0),
          heading: p.heading != null ? Number(p.heading) : null,
          speed_kmh: p.speed_kmh != null ? Number(p.speed_kmh) : null,
          recorded_at: (p.recorded_at ?? p.created_at ?? new Date().toISOString()) as string,
          batch_status: (p.batch_status ?? p.status ?? null) as string | null,
          staleSec: Math.round((now - new Date((p.recorded_at ?? p.created_at ?? new Date().toISOString()) as string).getTime()) / 1000),
        })).filter((p: DriverPosition) => p.lat !== 0 || p.lng !== 0);
        setPositions(rows);
        setLastUpdate(new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const mapped = latLngToRelative(positions);
  const activeCount = positions.filter((p) => p.staleSec < 120).length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Fahrzeug-Tracking Overlay</span>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {activeCount} aktiv
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px] text-muted-foreground">
              {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t p-4 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade GPS-Positionen…
            </div>
          )}

          {!loading && positions.length === 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-4 text-sm text-muted-foreground">
              <WifiOff className="h-4 w-4" /> Keine GPS-Daten verfügbar — Fahrer noch nicht aktiv oder GPS deaktiviert
            </div>
          )}

          {!loading && positions.length > 0 && (
            <>
              {/* Relative coordinate map */}
              <div className="relative w-full rounded-xl bg-gradient-to-br from-matcha-50 to-emerald-50 border border-matcha-200 overflow-hidden" style={{ paddingBottom: '60%' }}>
                <div className="absolute inset-0">
                  {/* Grid lines */}
                  <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                    {[25, 50, 75].map((p) => (
                      <g key={p}>
                        <line x1={`${p}%`} y1="0" x2={`${p}%`} y2="100%" stroke="#6b7280" strokeWidth="0.5" />
                        <line x1="0" y1={`${p}%`} x2="100%" y2={`${p}%`} stroke="#6b7280" strokeWidth="0.5" />
                      </g>
                    ))}
                  </svg>

                  {/* Driver markers */}
                  {mapped.map(({ x, y, d }) => {
                    const stale = d.staleSec > 120;
                    const color = stale ? 'bg-gray-400' : (STATUS_COLORS[d.batch_status ?? ''] ?? 'bg-matcha-500');
                    return (
                      <div
                        key={d.driver_id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 group"
                        style={{ left: `${x}%`, top: `${y}%` }}
                      >
                        <div className={cn('w-5 h-5 rounded-full border-2 border-white shadow-lg flex items-center justify-center', color)}>
                          <span className="text-[7px] font-black text-white">
                            {(d.driver_name ?? '?')[0]?.toUpperCase()}
                          </span>
                        </div>
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap rounded-lg bg-gray-900 text-white text-[10px] px-2 py-1 shadow-xl">
                          {d.driver_name ?? 'Fahrer'} · {stale ? 'Inaktiv' : `${Math.floor(d.staleSec / 60)}m alt`}
                          {d.speed_kmh != null && ` · ${Math.round(d.speed_kmh)} km/h`}
                        </div>
                      </div>
                    );
                  })}

                  {/* Legend */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-2 text-[9px] text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-matcha-500 inline-block" />Aktiv</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Abholung</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />Inaktiv</span>
                  </div>
                </div>
              </div>

              {/* Driver list */}
              <div className="space-y-1.5">
                {positions
                  .sort((a, b) => a.staleSec - b.staleSec)
                  .map((d) => {
                    const stale = d.staleSec > 120;
                    const color = stale ? 'bg-gray-400' : (STATUS_COLORS[d.batch_status ?? ''] ?? 'bg-matcha-500');
                    return (
                      <div key={d.driver_id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                        <div className={cn('w-2 h-2 rounded-full shrink-0', color)} />
                        <span className="flex-1 text-xs font-medium truncate">{d.driver_name ?? d.driver_id.slice(0, 8)}</span>
                        {d.speed_kmh != null && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(d.speed_kmh)} km/h</span>
                        )}
                        <div className="flex items-center gap-1">
                          {stale
                            ? <WifiOff className="h-3 w-3 text-gray-400" />
                            : <Wifi className="h-3 w-3 text-matcha-500" />
                          }
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {stale ? `${Math.floor(d.staleSec / 60)}m` : `${d.staleSec}s`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
