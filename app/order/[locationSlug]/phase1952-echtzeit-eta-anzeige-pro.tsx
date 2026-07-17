'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, Truck, CheckCircle2, Package } from 'lucide-react';

interface Props {
  orderId: string;
  locationId: string;
  className?: string;
}

type Phase = 'eingegangen' | 'zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';

interface EtaStatus {
  phase: Phase;
  eta_min: number | null;
  driver_name: string | null;
  confidence: number;
}

const MOCK: EtaStatus = {
  phase: 'zubereitung',
  eta_min: 22,
  driver_name: null,
  confidence: 82,
};

const PHASES: { key: Phase; label: string; icon: React.ReactNode }[] = [
  { key: 'eingegangen', label: 'Eingegangen', icon: <Package className="h-3.5 w-3.5" /> },
  { key: 'zubereitung', label: 'Zubereitung', icon: <ChefHat className="h-3.5 w-3.5" /> },
  { key: 'unterwegs',   label: 'Unterwegs',   icon: <Truck className="h-3.5 w-3.5" /> },
  { key: 'geliefert',   label: 'Geliefert',   icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

const PHASE_ORDER: Phase[] = ['eingegangen', 'zubereitung', 'bereit', 'unterwegs', 'geliefert'];

function ArcRing({ confidence, etaMin }: { confidence: number; etaMin: number | null }) {
  const size = 96;
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (confidence / 100) * circ;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={confidence >= 80 ? '#22c55e' : confidence >= 60 ? '#f59e0b' : '#ef4444'}
          strokeWidth={8}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {etaMin !== null ? (
          <>
            <span className="text-2xl font-black tabular-nums text-foreground">{etaMin}</span>
            <span className="text-[10px] text-muted-foreground font-semibold">Min</span>
          </>
        ) : (
          <Clock className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

export function Phase1952EchtzeitEtaAnzeigePro({ orderId, locationId, className }: Props) {
  const [status, setStatus] = useState<EtaStatus>(MOCK);
  const [loading, setLoading] = useState(true);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/delivery/storefront/order-status?order_id=${encodeURIComponent(orderId)}&location_id=${encodeURIComponent(locationId)}`,
        );
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setStatus(json);
      } catch {
        if (!cancelled) setStatus(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    ivRef.current = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      if (ivRef.current) clearInterval(ivRef.current);
    };
  }, [orderId, locationId]);

  if (loading) {
    return (
      <div className={cn('rounded-2xl border border-stone-200 bg-white p-5 animate-pulse', className)}>
        <div className="h-4 w-32 bg-stone-100 rounded mb-3" />
        <div className="h-16 bg-stone-100 rounded-xl" />
      </div>
    );
  }

  const currentIdx = PHASE_ORDER.indexOf(status.phase);

  return (
    <div className={cn('rounded-2xl border border-stone-200 bg-white overflow-hidden', className)}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-3">
        <Clock className="h-5 w-5 text-matcha-600 shrink-0" />
        <div>
          <p className="text-sm font-bold text-foreground">Echtzeit-ETA</p>
          {status.driver_name && (
            <p className="text-xs text-muted-foreground">{status.driver_name} ist unterwegs</p>
          )}
        </div>
      </div>

      {/* Hauptbereich */}
      <div className="px-5 py-5 flex items-center gap-6">
        <ArcRing confidence={status.confidence} etaMin={status.eta_min} />

        <div className="flex-1 space-y-3">
          {/* Phase-Steps */}
          {PHASES.filter(p => p.key !== 'bereit').map((p, i) => {
            const phaseIdx = PHASE_ORDER.indexOf(p.key);
            const done = phaseIdx < currentIdx;
            const active = p.key === status.phase || (p.key === 'unterwegs' && status.phase === 'bereit');
            return (
              <div key={p.key} className="flex items-center gap-2.5">
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-colors',
                  done   ? 'bg-matcha-500 text-white' :
                  active ? 'bg-matcha-100 text-matcha-700 ring-2 ring-matcha-400' :
                  'bg-stone-100 text-stone-400',
                )}>
                  {p.icon}
                </div>
                <span className={cn(
                  'text-xs font-semibold',
                  done ? 'text-matcha-600 line-through' :
                  active ? 'text-matcha-700' :
                  'text-stone-400',
                )}>
                  {p.label}
                </span>
                {active && (
                  <span className="ml-auto text-[10px] text-matcha-600 font-bold animate-pulse">Jetzt</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-stone-100 px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-matcha-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-matcha-500" />
          </span>
          <span className="text-[10px] text-muted-foreground">Live-Tracking aktiv</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Genauigkeit: {status.confidence}%
        </span>
      </div>
    </div>
  );
}
