'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Navigation, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1184 — ETA Live-Tracking Board (Storefront)
// Dynamische ETA-Anzeige + Fahrer-Tracking-Status + Phasen-Fortschritt für Kunden

interface Props {
  orderId: string;
  locationId?: string;
}

type Phase = 'bestaetigt' | 'zubereitung' | 'fahrer_unterwegs' | 'in_zustellung' | 'geliefert';

interface TrackingData {
  phase: Phase;
  etaMin: number | null;
  fahrername: string | null;
  fahrerDistanzKm: number | null;
  zubPhaseMin: number | null;
  totalMin: number | null;
}

const PHASES: { key: Phase; label: string; icon: string }[] = [
  { key: 'bestaetigt',       label: 'Bestätigt',        icon: '✓' },
  { key: 'zubereitung',      label: 'In Zubereitung',   icon: '👨‍🍳' },
  { key: 'fahrer_unterwegs', label: 'Fahrer unterwegs', icon: '🚴' },
  { key: 'in_zustellung',    label: 'Wird geliefert',   icon: '📦' },
  { key: 'geliefert',        label: 'Geliefert',        icon: '🎉' },
];

const PHASE_ORDER: Phase[] = ['bestaetigt', 'zubereitung', 'fahrer_unterwegs', 'in_zustellung', 'geliefert'];

const MOCK: TrackingData = {
  phase: 'zubereitung',
  etaMin: 22,
  fahrername: null,
  fahrerDistanzKm: null,
  zubPhaseMin: 14,
  totalMin: 30,
};

function statusToPhase(status: string): Phase {
  if (status === 'delivered') return 'geliefert';
  if (status === 'delivering') return 'in_zustellung';
  if (status === 'ready') return 'fahrer_unterwegs';
  if (status === 'preparing') return 'zubereitung';
  return 'bestaetigt';
}

export function Phase1184EtaLiveTrackingBoard({ orderId, locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<TrackingData>(MOCK);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const r = await fetch(`/api/order/track?order_id=${orderId}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setData({
        phase: statusToPhase(d.status ?? ''),
        etaMin: d.eta_min ?? d.estimated_delivery_min ?? null,
        fahrername: d.driver_name ?? null,
        fahrerDistanzKm: d.driver_distance_km ?? null,
        zubPhaseMin: d.prep_remaining_min ?? null,
        totalMin: d.total_eta_min ?? null,
      });
    } catch {
      // Keep mock / last data
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { setTick(t => t + 1); load(); }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const currentPhaseIdx = PHASE_ORDER.indexOf(data.phase);

  const etaColor = data.etaMin !== null
    ? data.etaMin <= 10 ? 'text-matcha-700' : data.etaMin <= 20 ? 'text-amber-600' : 'text-foreground'
    : 'text-foreground';

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="text-sm font-bold">Echtzeit-Tracking</span>
          {data.etaMin !== null && (
            <span className={cn('rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-black text-blue-700')}>
              ~{data.etaMin} Min
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* ETA Anzeige */}
          {data.etaMin !== null && (
            <div className="text-center py-2">
              <div className={cn('text-4xl font-black tabular-nums', etaColor)}>
                ~{data.etaMin}
              </div>
              <div className="text-sm text-muted-foreground">Minuten bis zur Lieferung</div>
            </div>
          )}

          {/* Phasen-Fortschritt */}
          <div className="space-y-1">
            {PHASES.map((p, i) => {
              const done = i < currentPhaseIdx;
              const active = i === currentPhaseIdx;
              return (
                <div
                  key={p.key}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 transition-all',
                    active && 'bg-blue-50 border border-blue-200',
                    done && 'opacity-60',
                    !active && !done && 'opacity-40',
                  )}
                >
                  <div className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0',
                    done ? 'bg-matcha-500 text-white' : active ? 'bg-blue-500 text-white animate-pulse' : 'bg-muted text-muted-foreground',
                  )}>
                    {done ? '✓' : p.icon}
                  </div>
                  <span className={cn(
                    'text-sm',
                    active ? 'font-bold text-foreground' : done ? 'text-muted-foreground' : 'text-muted-foreground',
                  )}>
                    {p.label}
                  </span>
                  {active && (
                    <span className="ml-auto text-[10px] rounded-full bg-blue-500 text-white px-2 py-0.5 font-bold animate-pulse">
                      Jetzt
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Fahrer-Info */}
          {data.fahrername && (
            <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 flex items-center gap-2">
              <span className="text-lg">🚴</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate">{data.fahrername}</div>
                {data.fahrerDistanzKm !== null && (
                  <div className="text-[10px] text-muted-foreground">
                    {data.fahrerDistanzKm.toFixed(1)} km entfernt
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
