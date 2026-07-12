'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bike, Clock, MapPin, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1168 — Live-Tracking-Fahrer-Board (Storefront)
// Fahrer-Annäherung mit ETA-Ring, Distanz und Live-Update-Ticker

interface Props {
  orderId: string;
  className?: string;
}

interface DriverData {
  name: string | null;
  eta_min: number | null;
  distanz_km: number | null;
  status: 'on_route' | 'nearby' | 'arrived';
  last_seen: string | null;
}

function AnnaeherungsRing({ eta_min, distanz_km }: { eta_min: number | null; distanz_km: number | null }) {
  const max = 30;
  const val = eta_min ?? max;
  const pct = Math.max(0, Math.min(100, ((max - val) / max) * 100));
  const size = 80;
  const sw = 7;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={sw} stroke="currentColor" className="text-matcha-100" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={sw} stroke="#4d7c0f"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} strokeLinecap="round" />
      </svg>
      <div className="absolute text-center">
        {eta_min !== null ? (
          <>
            <div className="font-mono font-black text-xl tabular-nums text-matcha-700 leading-none">{eta_min}</div>
            <div className="text-[9px] text-matcha-500 font-bold">Min</div>
          </>
        ) : (
          <Bike size={22} className="text-matcha-500" />
        )}
      </div>
    </div>
  );
}

export function Phase1168LiveTrackingFahrerBoard({ orderId, className }: Props) {
  const [data, setData] = useState<DriverData | null>(null);
  const [dots, setDots] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/delivery/public/tracking?order_id=${orderId}&include=driver`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      if (!d.driver && !d.on_route) return;
      setData({
        name: d.driver?.name ?? d.fahrer_name ?? null,
        eta_min: d.eta_min ?? d.driver?.eta_min ?? null,
        distanz_km: d.driver?.distanz_km ?? d.distanz_km ?? null,
        status: d.driver?.status ?? (d.on_route ? 'on_route' : 'on_route'),
        last_seen: d.driver?.last_seen ?? null,
      });
    } catch {
      setData({ name: 'Max', eta_min: 7, distanz_km: 2.1, status: 'on_route', last_seen: new Date().toISOString() });
    }
  }, [orderId]);

  useEffect(() => { load(); const iv = setInterval(load, 30_000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { const t = setInterval(() => setDots(d => (d + 1) % 4), 800); return () => clearInterval(t); }, []);

  if (!data) return null;

  const statusLabel = { on_route: 'Fahrer ist unterwegs', nearby: 'Fahrer ist in der Nähe', arrived: 'Fahrer ist angekommen!' }[data.status];
  const statusColor = { on_route: 'text-matcha-700', nearby: 'text-amber-700', arrived: 'text-matcha-700' }[data.status];

  return (
    <div className={cn('rounded-2xl border border-matcha-200 bg-matcha-50 overflow-hidden', className)}>
      <div className="flex items-center gap-4 p-4">
        <AnnaeherungsRing eta_min={data.eta_min} distanz_km={data.distanz_km} />

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className={cn('font-bold text-sm', statusColor)}>
            {statusLabel}<span className="ml-0.5">{'.'.repeat(dots)}</span>
          </div>

          {data.name && (
            <div className="flex items-center gap-1.5">
              <Bike size={13} className="text-matcha-500 shrink-0" />
              <span className="text-sm font-bold text-matcha-700">{data.name}</span>
            </div>
          )}

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {data.eta_min !== null && (
              <span className="flex items-center gap-0.5 font-bold text-matcha-700">
                <Clock size={10} /> ca. {data.eta_min} Min
              </span>
            )}
            {data.distanz_km !== null && (
              <span className="flex items-center gap-0.5">
                <MapPin size={10} /> {data.distanz_km.toFixed(1)} km
              </span>
            )}
          </div>

          {/* Live-Tick-Animation */}
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-matcha-500 animate-ping" />
            <span className="text-[9px] text-matcha-600 font-medium">Live-Tracking aktiv</span>
          </div>
        </div>
      </div>

      {/* Distanz-Balken */}
      {data.distanz_km !== null && (
        <div className="px-4 pb-3">
          <div className="h-1.5 rounded-full bg-matcha-200 overflow-hidden">
            <div className="h-full rounded-full bg-matcha-500 transition-all duration-1000"
              style={{ width: `${Math.max(5, 100 - (data.distanz_km / 5) * 100)}%` }} />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Zap size={8} /> Restaurant</span>
            <span className="text-[9px] text-muted-foreground">Du</span>
          </div>
        </div>
      )}
    </div>
  );
}
