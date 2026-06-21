'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, ChefHat, Package, Truck, Bike, MapPin, Loader2 } from 'lucide-react';

interface TrackingPayload {
  status: string | null;
  etaLabel: string | null;
  etaMinRemaining: number | null;
  driverName: string | null;
  distanceM: number | null;
  almostThere: boolean;
  confidence: number | null;
  stopsBefore: number | null;
}

interface Props {
  orderId: string;
  initialEtaMin?: number | null;
  initialStatus?: string | null;
  compact?: boolean;
}

const STATUS_STEPS = [
  { key: 'bestätigt',      icon: CheckCircle2, label: 'Angenommen'  },
  { key: 'in_zubereitung', icon: ChefHat,      label: 'Zubereitung' },
  { key: 'fertig',         icon: Package,      label: 'Fertig'      },
  { key: 'unterwegs',      icon: Truck,        label: 'Unterwegs'   },
  { key: 'geliefert',      icon: CheckCircle2, label: 'Geliefert'   },
] as const;

function stepIdx(status: string | null): number {
  if (!status) return 0;
  const i = STATUS_STEPS.findIndex(s => s.key === status || status.includes(s.key));
  return i >= 0 ? i : 0;
}

function ConfidenceRing({ pct }: { pct: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(1, pct / 100)));
  const color = pct >= 80 ? '#2d6b45' : pct >= 60 ? '#d97706' : '#ef4444';
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx="22" cy="22" r={r}
        fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        className="transition-all duration-700"
      />
      <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="800" fill={color}>{pct}%</text>
    </svg>
  );
}

export function EtaDetailKarte({ orderId, initialEtaMin, initialStatus, compact = false }: Props) {
  const [data, setData] = useState<TrackingPayload>({
    status: initialStatus ?? null,
    etaLabel: initialEtaMin ? `~${initialEtaMin} Min` : null,
    etaMinRemaining: initialEtaMin ?? null,
    driverName: null,
    distanceM: null,
    almostThere: false,
    confidence: null,
    stopsBefore: null,
  });
  const [secsLeft, setSecsLeft] = useState((initialEtaMin ?? 35) * 60);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Countdown-Ticker
  useEffect(() => {
    const iv = setInterval(() => {
      setSecsLeft(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Tracking-Poll
  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    const load = () => {
      fetch(`/api/delivery/orders/${orderId}/tracking`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!mountedRef.current || !d) return;
          setData({
            status: d.status ?? null,
            etaLabel: d.etaLabel ?? null,
            etaMinRemaining: d.etaMinRemaining ?? null,
            driverName: d.driverName ?? d.driver_name ?? null,
            distanceM: d.distanceM ?? d.distance_m ?? null,
            almostThere: d.almostThere ?? false,
            confidence: d.confidence ?? d.eta_confidence ?? null,
            stopsBefore: d.stopsBefore ?? d.stops_before ?? null,
          });
          if (d.etaMinRemaining != null) {
            setSecsLeft(d.etaMinRemaining * 60);
          }
        })
        .catch(() => {})
        .finally(() => { if (mountedRef.current) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [orderId]);

  const idx = stepIdx(data.status);
  const mm = Math.floor(secsLeft / 60);
  const ss = secsLeft % 60;
  const isDelivered = data.status === 'geliefert' || data.status === 'delivered';
  const isUnderway  = data.status === 'unterwegs' || data.status === 'out_for_delivery';

  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-3 rounded-xl border px-3 py-2.5',
        data.almostThere ? 'border-matcha-400 bg-matcha-50' : 'border-stone-200 bg-white',
      )}>
        {data.almostThere
          ? <Bike className="h-4 w-4 text-matcha-600 animate-bounce" />
          : <Clock className="h-4 w-4 text-stone-400" />}
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-stone-700">
            {isDelivered ? 'Geliefert! 🎉'
              : data.almostThere ? 'Fast da!'
              : data.etaLabel ?? `~${mm} Min`}
          </span>
          {data.driverName && <div className="text-[10px] text-stone-400">{data.driverName}</div>}
        </div>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-stone-300 shrink-0" />}
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      data.almostThere ? 'border-matcha-400 shadow-sm shadow-matcha-200' : 'border-stone-200',
    )}>
      {/* Header */}
      <div className={cn(
        'px-4 py-3 flex items-center justify-between',
        isDelivered ? 'bg-matcha-600' : data.almostThere ? 'bg-matcha-500' : 'bg-stone-800',
      )}>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-white/70" />
          <span className="text-xs font-black uppercase tracking-wider text-white/80">Live-Status</span>
        </div>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />}
      </div>

      {/* Countdown + Info */}
      <div className="bg-white px-4 py-4">
        {isDelivered ? (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-matcha-600" />
            <div>
              <div className="text-lg font-black text-matcha-700">Geliefert! 🎉</div>
              <div className="text-xs text-stone-500">Guten Appetit!</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {data.confidence != null
              ? <ConfidenceRing pct={Math.round(data.confidence * 100)} />
              : (
                <div className="flex flex-col items-center justify-center w-11 shrink-0">
                  <span className="text-3xl font-black text-stone-800 tabular-nums font-mono leading-none">{mm}</span>
                  <span className="text-[10px] text-stone-400">Min</span>
                </div>
              )
            }
            <div className="flex-1 min-w-0">
              <div className="text-2xl font-black text-stone-800 tabular-nums font-mono">
                {mm}:{String(ss).padStart(2, '0')}
              </div>
              <div className="text-xs text-stone-500 mt-0.5">
                {data.almostThere ? '🚴 Fast bei dir!' : data.etaLabel ?? 'Geschätzte Ankunft'}
              </div>
              {data.driverName && (
                <div className="flex items-center gap-1 mt-1 text-[10px] text-stone-400">
                  <Bike size={10} />
                  {data.driverName}
                  {isUnderway && data.distanceM != null && (
                    <span>· {data.distanceM >= 1000 ? `${(data.distanceM / 1000).toFixed(1)} km` : `${Math.round(data.distanceM)} m`}</span>
                  )}
                </div>
              )}
              {data.stopsBefore != null && data.stopsBefore > 0 && (
                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-amber-600">
                  <MapPin size={10} />
                  {data.stopsBefore} Stopp{data.stopsBefore > 1 ? 's' : ''} vor dir
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Statusleiste */}
      <div className="bg-stone-50 border-t border-stone-100 px-4 py-3">
        <div className="flex items-center justify-between">
          {STATUS_STEPS.map((step, i) => {
            const Icon = step.icon;
            const done = i <= idx;
            const active = i === idx;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center transition-all',
                  done ? (active ? 'bg-matcha-600 ring-2 ring-matcha-300 scale-110' : 'bg-matcha-500') : 'bg-stone-200',
                )}>
                  <Icon size={12} className={done ? 'text-white' : 'text-stone-400'} />
                </div>
                <span className={cn('text-[9px] font-bold text-center leading-tight hidden sm:block', active ? 'text-matcha-700' : done ? 'text-matcha-500' : 'text-stone-400')}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
        {/* Verbindungslinie */}
        <div className="relative -mt-6 mx-3 h-0.5 bg-stone-200 -z-10" style={{ top: '-12px' }}>
          <div
            className="h-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${(idx / (STATUS_STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
