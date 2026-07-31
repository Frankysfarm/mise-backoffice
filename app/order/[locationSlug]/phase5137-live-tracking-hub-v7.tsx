'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Bike, CheckCircle2, Clock, MapPin, Star, Package, Zap, Navigation } from 'lucide-react';

interface TrackingData {
  order_id: string;
  bestellnummer: string;
  status: 'bestellt' | 'zubereitung' | 'abholung' | 'unterwegs' | 'geliefert';
  eta_min?: number | null;
  fahrer_name?: string | null;
  fahrer_rating?: number | null;
  prep_start?: string | null;
  estimated_prep_min?: number | null;
  distance_km?: number | null;
  position_pct?: number | null;
}

const PHASES: { key: TrackingData['status']; label: string; icon: React.ReactNode }[] = [
  { key: 'bestellt',   label: 'Bestellt',    icon: <Package className="w-4 h-4" /> },
  { key: 'zubereitung',label: 'Zubereitung', icon: <ChefHat className="w-4 h-4" /> },
  { key: 'abholung',   label: 'Abholung',    icon: <Zap className="w-4 h-4" /> },
  { key: 'unterwegs',  label: 'Unterwegs',   icon: <Bike className="w-4 h-4" /> },
  { key: 'geliefert',  label: 'Geliefert',   icon: <CheckCircle2 className="w-4 h-4" /> },
];

const PHASE_ORDER: TrackingData['status'][] = ['bestellt', 'zubereitung', 'abholung', 'unterwegs', 'geliefert'];

const MOCK: TrackingData = {
  order_id: 'ord_1042',
  bestellnummer: '#1042',
  status: 'unterwegs',
  eta_min: 8,
  fahrer_name: 'Marco R.',
  fahrer_rating: 4.9,
  prep_start: new Date(Date.now() - 18 * 60_000).toISOString(),
  estimated_prep_min: 12,
  distance_km: 2.3,
  position_pct: 62,
};

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

export function StorefrontPhase5137LiveTrackingHubV7({
  orderId,
  locationSlug,
}: {
  orderId?: string | null;
  locationSlug?: string | null;
}) {
  const now = useNow();
  const [data, setData] = useState<TrackingData | null>(null);

  useEffect(() => {
    if (!orderId) { setData(MOCK); return; }
    async function load() {
      try {
        const url = `/api/delivery/tracking?order_id=${orderId}${locationSlug ? `&slug=${locationSlug}` : ''}`;
        const res = await fetch(url);
        if (res.ok) setData(await res.json());
        else setData(MOCK);
      } catch { setData(MOCK); }
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [orderId, locationSlug]);

  if (!data) return null;

  const currentIdx = PHASE_ORDER.indexOf(data.status);

  // ETA countdown
  const etaSec = data.eta_min != null ? data.eta_min * 60 : null;
  const elapsedSec = data.prep_start ? (now - new Date(data.prep_start).getTime()) / 1000 : 0;
  const prepPct = data.estimated_prep_min
    ? Math.min(100, Math.round((elapsedSec / (data.estimated_prep_min * 60)) * 100))
    : null;

  const etaDisplay = data.eta_min != null
    ? data.eta_min <= 1 ? 'Gleich da!' : `${data.eta_min} min`
    : null;

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-bold text-white">Live-Tracking</div>
          <div className="text-xs text-slate-400">Bestellung {data.bestellnummer}</div>
        </div>
        {etaDisplay && (
          <div className="text-right">
            <div className="text-2xl font-bold text-white tabular-nums">{etaDisplay}</div>
            <div className="text-xs text-slate-400 flex items-center gap-1 justify-end">
              <Clock className="w-3 h-3" /> Ankunft
            </div>
          </div>
        )}
      </div>

      {/* ETA Ring Visual */}
      {data.status === 'unterwegs' && data.position_pct != null && (
        <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
          <div className="relative w-12 h-12 shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#1e3a5f" strokeWidth="4" />
              <circle
                cx="24" cy="24" r="20"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="4"
                strokeDasharray={`${(data.position_pct / 100) * 125.6} 125.6`}
                strokeLinecap="round"
              />
            </svg>
            <Bike className="w-5 h-5 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Fahrer ist unterwegs</div>
            {data.fahrer_name && (
              <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>{data.fahrer_name}</span>
                {data.fahrer_rating != null && (
                  <span className="flex items-center gap-0.5 text-amber-400">
                    <Star className="w-3 h-3 fill-amber-400" />{data.fahrer_rating.toFixed(1)}
                  </span>
                )}
              </div>
            )}
            {data.distance_km != null && (
              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />{data.distance_km}km entfernt
              </div>
            )}
          </div>
          <div className="ml-auto text-xs text-blue-400">{data.position_pct}%</div>
        </div>
      )}

      {/* Phase Timeline */}
      <div className="flex items-start justify-between relative">
        {/* Progress line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-700">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${(currentIdx / (PHASE_ORDER.length - 1)) * 100}%` }}
          />
        </div>
        {PHASES.map((phase, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const future = i > currentIdx;
          return (
            <div key={phase.key} className="flex flex-col items-center gap-1.5 z-10" style={{ width: '20%' }}>
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all',
                done   ? 'bg-emerald-500 border-emerald-500 text-white' :
                active ? 'bg-blue-600 border-blue-400 text-white animate-pulse' :
                         'bg-slate-800 border-slate-700 text-slate-600'
              )}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : phase.icon}
              </div>
              <span className={cn('text-[10px] text-center leading-tight',
                done ? 'text-emerald-400' : active ? 'text-blue-300 font-semibold' : 'text-slate-600'
              )}>
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Prep Progress */}
      {data.status === 'zubereitung' && prepPct !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1"><ChefHat className="w-3 h-3" /> Zubereitung</span>
            <span>{prepPct}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${prepPct}%` }} />
          </div>
        </div>
      )}

      {/* Status Message */}
      <div className={cn(
        'rounded-xl px-3 py-2.5 text-sm font-medium text-center',
        data.status === 'geliefert' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
        data.status === 'unterwegs' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
        'bg-slate-800 text-slate-300'
      )}>
        {data.status === 'bestellt'    && '✅ Bestellung eingegangen – wird bald zubereitet'}
        {data.status === 'zubereitung' && '👨‍🍳 Dein Essen wird frisch zubereitet'}
        {data.status === 'abholung'    && '🚴 Fahrer holt dein Essen ab'}
        {data.status === 'unterwegs'   && `🛵 ${data.fahrer_name ?? 'Fahrer'} ist auf dem Weg zu dir`}
        {data.status === 'geliefert'   && '🎉 Geliefert! Guten Appetit!'}
      </div>

      <div className="text-[10px] text-slate-700 text-right">15-Sek-Polling · Live-Tracking</div>
    </div>
  );
}
