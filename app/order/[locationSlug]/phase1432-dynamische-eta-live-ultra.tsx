'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, Truck, CheckCircle2, MapPin, Zap } from 'lucide-react';

type Phase = 'kitchen' | 'dispatch' | 'delivery' | 'delivered';

interface ETAStatus {
  phase: Phase;
  etaMin: number | null;
  etaUpdatedAt: string | null;
  kitchenDoneAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  driverName: string | null;
  isSurge: boolean;
}

const PHASES: { key: Phase; label: string; icon: typeof Clock }[] = [
  { key: 'kitchen',  label: 'Küche',    icon: ChefHat   },
  { key: 'dispatch', label: 'Abholung', icon: Truck     },
  { key: 'delivery', label: 'Unterwegs',icon: MapPin    },
  { key: 'delivered',label: 'Geliefert',icon: CheckCircle2 },
];

function phaseIndex(p: Phase): number {
  return PHASES.findIndex((ph) => ph.key === p);
}

export function StorefrontPhase1432DynamischeEtaLiveUltra({
  orderId,
  locationId,
  initialEta,
}: {
  orderId: string | null;
  locationId: string | null;
  initialEta?: number | null;
}) {
  const [status, setStatus] = useState<ETAStatus>({
    phase: 'kitchen',
    etaMin: initialEta ?? null,
    etaUpdatedAt: null,
    kitchenDoneAt: null,
    dispatchedAt: null,
    deliveredAt: null,
    driverName: null,
    isSurge: false,
  });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch live ETA
  useEffect(() => {
    if (!orderId && !locationId) { setLoading(false); return; }
    let cancelled = false;

    async function load() {
      try {
        const url = orderId
          ? `/api/delivery/tracking?order_id=${orderId}`
          : locationId
          ? `/api/delivery/eta/live?location_id=${locationId}`
          : null;
        if (!url) return;
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const d = await res.json();
          if (!cancelled && d) {
            setStatus({
              phase: d.phase ?? d.status ?? 'kitchen',
              etaMin: d.eta_min ?? d.etaMin ?? initialEta ?? null,
              etaUpdatedAt: d.updated_at ?? null,
              kitchenDoneAt: d.kitchen_done_at ?? null,
              dispatchedAt: d.dispatched_at ?? null,
              deliveredAt: d.delivered_at ?? null,
              driverName: d.driver_name ?? null,
              isSurge: d.queue_signal === 'surge' || d.is_surge === true,
            });
          }
        }
      } catch {
        // API nicht verfügbar — Anzeige mit initialEta
      }
      if (!cancelled) setLoading(false);
    }

    load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [orderId, locationId, initialEta]);

  // Countdown timer
  useEffect(() => {
    if (status.etaMin === null || status.phase === 'delivered') {
      setCountdown(null);
      return;
    }
    setCountdown(status.etaMin * 60);
    const iv = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [status.etaMin, status.phase]);

  function fmtCountdown(sec: number | null): string {
    if (sec === null) return '—';
    if (sec <= 0) return 'Gleich!';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  }

  const activeIdx = phaseIndex(status.phase);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 flex items-center gap-2">
        <div className="h-4 w-4 rounded-full border-2 border-stone-400 border-t-transparent animate-spin" />
        <span className="text-sm text-stone-500">ETA wird geladen…</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-stone-50 border-b">
        <Clock className="h-4 w-4 text-stone-500 shrink-0" />
        <span className="text-sm font-bold text-stone-700">Live-Lieferstatus</span>
        {status.isSurge && (
          <div className="ml-auto flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5">
            <Zap className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] font-bold text-amber-700">Stoßzeit</span>
          </div>
        )}
      </div>

      {/* Phase stepper */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center">
          {PHASES.map((ph, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            const Icon = ph.icon;
            return (
              <div key={ph.key} className="flex-1 flex items-center">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-500',
                    done   && 'bg-matcha-600 border-matcha-600 text-white',
                    active && 'bg-white border-matcha-600 text-matcha-600 shadow-md shadow-matcha-200',
                    !done && !active && 'bg-stone-50 border-stone-200 text-stone-300',
                    active && 'scale-110',
                  )}>
                    {done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className={cn('h-4 w-4', active && 'animate-pulse')} />
                    )}
                  </div>
                  <span className={cn(
                    'text-[9px] font-bold text-center leading-tight',
                    done && 'text-matcha-600',
                    active && 'text-matcha-700',
                    !done && !active && 'text-stone-300',
                  )}>
                    {ph.label}
                  </span>
                </div>
                {i < PHASES.length - 1 && (
                  <div className={cn(
                    'flex-none h-0.5 w-4 -mt-4 mx-1 rounded-full transition-all duration-500',
                    i < activeIdx ? 'bg-matcha-500' : 'bg-stone-200',
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ETA countdown */}
      {status.phase !== 'delivered' && (
        <div className="px-4 py-3 flex items-center justify-between border-t mt-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              {status.phase === 'kitchen' ? 'Zubereitung läuft' :
               status.phase === 'dispatch' ? 'Fahrer kommt' :
               'Unterwegs zu dir'}
            </div>
            {status.driverName && (
              <div className="text-[11px] text-stone-500 mt-0.5">
                Fahrer: {status.driverName}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className={cn(
              'font-mono text-2xl font-black tabular-nums leading-none',
              countdown !== null && countdown < 120 ? 'text-amber-600' :
              countdown !== null && countdown < 300 ? 'text-matcha-700' : 'text-stone-800',
            )}>
              {fmtCountdown(countdown)}
            </div>
            {status.etaMin !== null && (
              <div className="text-[9px] text-stone-400 mt-0.5">
                ~{status.etaMin} Min gesamt
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delivered state */}
      {status.phase === 'delivered' && (
        <div className="px-4 py-4 flex items-center gap-3 border-t mt-2">
          <div className="h-10 w-10 shrink-0 rounded-full bg-matcha-100 border border-matcha-300 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-matcha-600" />
          </div>
          <div>
            <div className="font-bold text-matcha-700 text-sm">Bestellung geliefert!</div>
            <div className="text-xs text-stone-500 mt-0.5">Guten Appetit!</div>
          </div>
        </div>
      )}
    </div>
  );
}
