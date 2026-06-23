'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Bike, CheckCircle2, Clock, MapPin,
  Navigation, RefreshCw, Wifi, WifiOff, Zap,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────── */

type DriverPosition = {
  driver_id: string;
  driver_name: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  heading: number; // 0-360 degrees
  status: 'aktiv' | 'pause' | 'offline';
  zone: string | null;
  current_tour_id: string | null;
  stops_remaining: number;
  last_update: string;
  battery_pct: number | null;
};

type TrackingData = {
  drivers: DriverPosition[];
  online_count: number;
  offline_count: number;
  avg_speed_kmh: number;
};

/* ── Mock data ──────────────────────────────────────────────────── */

const MOCK: TrackingData = {
  drivers: [
    { driver_id: 'd1', driver_name: 'Karl M.', lat: 48.137, lng: 11.576, speed_kmh: 22, heading: 45, status: 'aktiv', zone: 'Nord', current_tour_id: 'T-001', stops_remaining: 2, last_update: new Date().toISOString(), battery_pct: 78 },
    { driver_id: 'd2', driver_name: 'Sandra L.', lat: 48.134, lng: 11.580, speed_kmh: 0, heading: 180, status: 'pause', zone: 'Mitte', current_tour_id: null, stops_remaining: 0, last_update: new Date(Date.now() - 5 * 60000).toISOString(), battery_pct: 45 },
    { driver_id: 'd3', driver_name: 'Peter W.', lat: 48.140, lng: 11.570, speed_kmh: 35, heading: 270, status: 'aktiv', zone: 'Süd', current_tour_id: 'T-003', stops_remaining: 3, last_update: new Date().toISOString(), battery_pct: 92 },
    { driver_id: 'd4', driver_name: 'Julia K.', lat: 48.130, lng: 11.585, speed_kmh: 0, heading: 0, status: 'offline', zone: null, current_tour_id: null, stops_remaining: 0, last_update: new Date(Date.now() - 25 * 60000).toISOString(), battery_pct: null },
  ],
  online_count: 2,
  offline_count: 1,
  avg_speed_kmh: 28.5,
};

/* ── Helpers ────────────────────────────────────────────────────── */

function timeSince(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

const STATUS_CFG = {
  aktiv:   { dot: 'bg-green-500', text: 'text-green-700', label: 'Aktiv' },
  pause:   { dot: 'bg-amber-400', text: 'text-amber-700', label: 'Pause' },
  offline: { dot: 'bg-gray-400',  text: 'text-gray-500',  label: 'Offline' },
};

function DirectionArrow({ heading }: { heading: number }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" className="shrink-0">
      <polygon
        points="10,2 14,14 10,12 6,14"
        fill="currentColor"
        transform={`rotate(${heading}, 10, 10)`}
      />
    </svg>
  );
}

function BatteryBar({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const color = pct >= 50 ? 'bg-green-400' : pct >= 20 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1">
      <div className="w-8 h-2 rounded-full bg-gray-200 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-muted-foreground">{pct}%</span>
    </div>
  );
}

/* ── Component ──────────────────────────────────────────────────── */

export function DispatchEchtzeitFahrzeugTracking() {
  const [data, setData] = useState<TrackingData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/driver-performance-realtime');
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json() as { drivers?: DriverPosition[] };
      if (json.drivers && json.drivers.length > 0) {
        const aktiv = json.drivers.filter((d: DriverPosition) => d.status === 'aktiv').length;
        const offline = json.drivers.filter((d: DriverPosition) => d.status === 'offline').length;
        const avgSpeed = json.drivers.filter((d: DriverPosition) => d.status === 'aktiv').reduce((s: number, d: DriverPosition) => s + (d.speed_kmh ?? 0), 0) / Math.max(1, aktiv);
        setData({ drivers: json.drivers, online_count: aktiv, offline_count: offline, avg_speed_kmh: Math.round(avgSpeed * 10) / 10 });
      }
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 15_000);
    return () => clearInterval(iv);
  }, [refresh]);

  const activeDrivers = data.drivers.filter((d) => d.status === 'aktiv');
  const pauseDrivers = data.drivers.filter((d) => d.status === 'pause');
  const offlineDrivers = data.drivers.filter((d) => d.status === 'offline');

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-600">
        <Navigation className="h-4 w-4 text-white" />
        <span className="text-xs font-black uppercase tracking-wider text-white">
          Echtzeit-Fahrzeug-Tracking
        </span>
        <div className="ml-auto flex items-center gap-2">
          {connected
            ? <Wifi className="h-3.5 w-3.5 text-green-300" />
            : <WifiOff className="h-3.5 w-3.5 text-red-300" />}
          <button onClick={refresh} className="text-white/70 hover:text-white">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 divide-x divide-border bg-muted/30 text-center">
        <div className="py-2">
          <div className="text-sm font-bold text-green-600">{data.online_count}</div>
          <div className="text-[9px] text-muted-foreground uppercase">Aktiv</div>
        </div>
        <div className="py-2">
          <div className="text-sm font-bold text-amber-600">{pauseDrivers.length}</div>
          <div className="text-[9px] text-muted-foreground uppercase">Pause</div>
        </div>
        <div className="py-2">
          <div className="text-sm font-bold">{data.avg_speed_kmh} km/h</div>
          <div className="text-[9px] text-muted-foreground uppercase">Ø Tempo</div>
        </div>
      </div>

      {/* Driver list */}
      <div className="divide-y divide-border">
        {[...activeDrivers, ...pauseDrivers, ...offlineDrivers].map((d) => {
          const cfg = STATUS_CFG[d.status];
          const stale = (Date.now() - new Date(d.last_update).getTime()) > 5 * 60000;
          return (
            <div key={d.driver_id} className={cn(
              'flex items-center gap-3 px-3 py-2.5',
              d.status === 'offline' && 'opacity-50',
            )}>
              {/* Direction + status */}
              <div className={cn('shrink-0', cfg.text)}>
                <DirectionArrow heading={d.heading} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold truncate">{d.driver_name}</span>
                  <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold', cfg.text)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                    {cfg.label}
                  </span>
                  {stale && <AlertTriangle className="h-3 w-3 text-amber-400" />}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                  {d.zone && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" />{d.zone}
                    </span>
                  )}
                  {d.status === 'aktiv' && (
                    <>
                      <span className="flex items-center gap-0.5">
                        <Zap className="h-2.5 w-2.5" />{d.speed_kmh} km/h
                      </span>
                      {d.stops_remaining > 0 && (
                        <span className="flex items-center gap-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5" />{d.stops_remaining} Stopps
                        </span>
                      )}
                    </>
                  )}
                  <span className="flex items-center gap-0.5 ml-auto">
                    <Clock className="h-2.5 w-2.5" />{timeSince(d.last_update)}
                  </span>
                </div>
              </div>

              {/* Battery */}
              <BatteryBar pct={d.battery_pct} />
            </div>
          );
        })}
      </div>

      {data.drivers.length === 0 && (
        <div className="py-6 text-center text-xs text-muted-foreground">
          <Bike className="h-6 w-6 mx-auto mb-1 opacity-30" />
          Keine Fahrer aktiv
        </div>
      )}
    </div>
  );
}
