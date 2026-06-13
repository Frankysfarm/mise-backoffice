'use client';

import { useEffect, useState } from 'react';
import { Activity, Bike, Clock, Package, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type OpsData = {
  ordersActive: number;
  driversOnline: number;
  etaMin: number;
  load: 'quiet' | 'normal' | 'busy';
  queueSignal: string | null;
  etaExtension: number;
};

const LOAD_META = {
  quiet:  { label: 'Ruhig',         cls: 'bg-matcha-50 border-matcha-200 text-matcha-800',  dot: 'bg-matcha-500' },
  normal: { label: 'Normal',        cls: 'bg-blue-50 border-blue-200 text-blue-800',         dot: 'bg-blue-500' },
  busy:   { label: 'Viel los',      cls: 'bg-amber-50 border-amber-300 text-amber-900',      dot: 'bg-amber-500' },
};

export function LiveOpsHeader({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<OpsData | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/eta/live?location_id=${locationId}`);
        if (!res.ok) return;
        const d = await res.json();
        setData({
          ordersActive: d.active_orders ?? 0,
          driversOnline: d.drivers_online ?? 0,
          etaMin: d.eta_min ?? 0,
          load: (d.load ?? 'normal') as OpsData['load'],
          queueSignal: d.queue_signal ?? null,
          etaExtension: d.eta_extension_min ?? 0,
        });
      } catch {}
    };
    load();
    const iv = setInterval(load, 30_000);
    const tick = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => { clearInterval(iv); clearInterval(tick); };
  }, [locationId]);

  if (!data) return null;

  const meta = LOAD_META[data.load] ?? LOAD_META.normal;
  const isSurge = data.queueSignal === 'surge' || data.etaExtension > 5;
  const isPaused = data.queueSignal === 'pause';
  const totalEta = data.etaMin + (data.etaExtension > 0 ? data.etaExtension : 0);

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 flex items-center gap-4 flex-wrap',
      isSurge ? 'bg-red-50 border-red-300 text-red-900' :
      isPaused ? 'bg-stone-50 border-stone-300 text-stone-700' :
      meta.cls,
    )}>
      {/* Status-Dot + Label */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="relative flex h-2.5 w-2.5">
          <span className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
            isSurge ? 'bg-red-400' : isPaused ? 'bg-stone-400' : meta.dot,
          )} />
          <span className={cn(
            'relative inline-flex h-2.5 w-2.5 rounded-full',
            isSurge ? 'bg-red-500' : isPaused ? 'bg-stone-400' : meta.dot,
          )} />
        </span>
        <Activity className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-wider">
          {isSurge ? 'Hohe Nachfrage' : isPaused ? 'Pause / Warteschlange' : meta.label}
        </span>
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs">
          <Package className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="font-bold tabular-nums">{data.ordersActive}</span>
          <span className="opacity-70">aktiv</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Bike className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className={cn('font-bold tabular-nums', data.driversOnline === 0 && 'text-red-600')}>
            {data.driversOnline}
          </span>
          <span className="opacity-70">Fahrer online</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="font-bold tabular-nums">~{totalEta} Min</span>
          <span className="opacity-70">ETA</span>
          {data.etaExtension > 0 && (
            <span className="rounded-full bg-amber-200 text-amber-800 px-1.5 py-0.5 text-[9px] font-bold">
              +{data.etaExtension} Verzögerung
            </span>
          )}
        </div>
      </div>

      {/* Surge badge */}
      {isSurge && (
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <Zap className="h-3.5 w-3.5 text-red-600" />
          <span className="text-[10px] font-black text-red-700">Surge aktiv</span>
        </div>
      )}

      {/* No drivers warning */}
      {data.driversOnline === 0 && (
        <div className="ml-auto">
          <span className="rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-[10px] font-black text-red-700 animate-pulse">
            Keine Fahrer online!
          </span>
        </div>
      )}

      {/* Trending indicator: drivers vs active orders */}
      {data.driversOnline > 0 && data.ordersActive > 0 && !isSurge && (
        <div className="ml-auto flex items-center gap-1 text-[10px] opacity-70">
          <TrendingUp className="h-3 w-3" />
          {(data.ordersActive / data.driversOnline).toFixed(1)} Orders/Fahrer
        </div>
      )}
    </div>
  );
}
