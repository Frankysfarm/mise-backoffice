'use client';

/**
 * Phase 2380 — Dynamische ETA Live Tracker V2
 * Farbkodierter ETA-Countdown, Fahrer-Annäherungs-Indikator,
 * Bestellphasen-Leiste, Live-Status-Badge. 30-Sek-Polling.
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Clock, CheckCircle2, Bike, Flame, MapPin, Navigation2,
  AlertTriangle, Package, Star,
} from 'lucide-react';

type OrderPhase =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'on_way'
  | 'delivered';

interface EtaTrackData {
  status: OrderPhase;
  etaMin: number | null;
  etaConfidencePct: number;
  fahrerName: string | null;
  fahrerDistanzM: number | null;
  delayReason: string | null;
  updatedAt: string | null;
}

const PHASES: { key: OrderPhase; label: string; icon: React.ReactNode }[] = [
  { key: 'confirmed',  label: 'Bestätigt', icon: <CheckCircle2 className="h-3 w-3" /> },
  { key: 'preparing',  label: 'Zubereitung', icon: <Flame className="h-3 w-3" /> },
  { key: 'ready',      label: 'Bereit', icon: <Package className="h-3 w-3" /> },
  { key: 'on_way',     label: 'Unterwegs', icon: <Bike className="h-3 w-3" /> },
  { key: 'delivered',  label: 'Geliefert', icon: <Star className="h-3 w-3" /> },
];

const PHASE_ORDER: OrderPhase[] = ['placed', 'confirmed', 'preparing', 'ready', 'picked_up', 'on_way', 'delivered'];

function phaseIndex(p: OrderPhase) {
  return PHASE_ORDER.indexOf(p);
}

function etaColor(min: number | null, confidence: number) {
  if (min === null) return { text: 'text-muted-foreground', bg: 'bg-muted', border: 'border-muted' };
  if (min <= 5) return { text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-300' };
  if (min <= 15) return { text: 'text-matcha-700', bg: 'bg-matcha-50 dark:bg-matcha-950/20', border: 'border-matcha-300' };
  if (min <= 30) return { text: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-300' };
  return { text: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-300' };
}

function CountdownRing({ etaMin }: { etaMin: number | null }) {
  if (etaMin === null) return null;
  const max = 45;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, (max - etaMin) / max));
  const offset = circ * (1 - pct);
  const col = etaMin <= 5 ? '#22c55e' : etaMin <= 15 ? '#4d7c0f' : etaMin <= 30 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={68} height={68}>
        <circle cx={34} cy={34} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
        <circle
          cx={34} cy={34} r={r} fill="none"
          stroke={col} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 34 34)"
          className="transition-all duration-1000"
        />
        <text x={34} y={30} textAnchor="middle" fontSize={16} fontWeight="900" fill={col} fontFamily="monospace">
          {etaMin}
        </text>
        <text x={34} y={44} textAnchor="middle" fontSize={9} fill="#9ca3af" fontFamily="sans-serif">
          min
        </text>
      </svg>
      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">ETA</span>
    </div>
  );
}

function DriverProximity({ distanzM }: { distanzM: number | null }) {
  if (distanzM === null) return null;
  const km = (distanzM / 1000).toFixed(1);
  const isNear = distanzM < 500;
  return (
    <div className={cn(
      'flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold',
      isNear ? 'bg-emerald-100 text-emerald-700 animate-pulse' : 'bg-muted text-muted-foreground'
    )}>
      <Navigation2 className="h-3 w-3" />
      {isNear ? `Fahrer ist nur ${distanzM}m entfernt!` : `Fahrer: ~${km} km entfernt`}
    </div>
  );
}

export function StorefrontPhase2380DynamischeETALiveTrackerV2({
  orderId,
  initialStatus = 'confirmed',
  initialEtaMin = null,
}: {
  orderId: string;
  initialStatus?: OrderPhase;
  initialEtaMin?: number | null;
}) {
  const [data, setData] = useState<EtaTrackData>({
    status: initialStatus,
    etaMin: initialEtaMin,
    etaConfidencePct: 80,
    fahrerName: null,
    fahrerDistanzM: null,
    delayReason: null,
    updatedAt: null,
  });
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/tracking/${orderId}`);
      if (res.ok) {
        const json = await res.json();
        setData(prev => ({
          ...prev,
          status: json.status ?? prev.status,
          etaMin: json.eta_min ?? prev.etaMin,
          etaConfidencePct: json.confidence_pct ?? prev.etaConfidencePct,
          fahrerName: json.fahrer_name ?? prev.fahrerName,
          fahrerDistanzM: json.fahrer_distanz_m ?? prev.fahrerDistanzM,
          delayReason: json.delay_reason ?? prev.delayReason,
          updatedAt: json.updated_at ?? prev.updatedAt,
        }));
      }
    } catch {
      // Silently degrade — show stale data
    }
  }, [orderId]);

  useEffect(() => {
    load();
    const pollIv = setInterval(load, 30_000);
    const tickIv = setInterval(() => {
      setTick(t => t + 1);
      setData(prev => ({
        ...prev,
        etaMin: prev.etaMin !== null && prev.etaMin > 0 ? prev.etaMin - 1 : prev.etaMin,
      }));
    }, 60_000);
    return () => {
      clearInterval(pollIv);
      clearInterval(tickIv);
    };
  }, [load]);

  const curPhaseIdx = phaseIndex(data.status);
  const col = etaColor(data.etaMin, data.etaConfidencePct);
  const isDelivered = data.status === 'delivered';

  return (
    <div className={cn('rounded-2xl border-2 overflow-hidden', col.border, col.bg)}>
      {/* Status banner */}
      <div className={cn('px-4 py-2 flex items-center gap-2', col.bg)}>
        {isDelivered
          ? <Star className="h-4 w-4 text-emerald-600" />
          : data.status === 'on_way'
          ? <Bike className={cn('h-4 w-4', col.text)} />
          : data.status === 'preparing'
          ? <Flame className={cn('h-4 w-4', col.text)} />
          : <Clock className={cn('h-4 w-4', col.text)} />
        }
        <span className={cn('text-sm font-black', col.text)}>
          {isDelivered
            ? 'Deine Bestellung ist angekommen!'
            : data.status === 'on_way'
            ? 'Fahrer ist unterwegs zu dir'
            : data.status === 'preparing'
            ? 'Deine Bestellung wird zubereitet'
            : data.status === 'ready'
            ? 'Bestellung wartet auf den Fahrer'
            : 'Bestellung bestätigt'
          }
        </span>
        {data.etaConfidencePct > 0 && !isDelivered && (
          <span className="ml-auto text-[9px] text-muted-foreground">
            {data.etaConfidencePct}% sicher
          </span>
        )}
      </div>

      <div className="px-4 py-4">
        <div className="flex items-center gap-4">
          {/* Countdown ring */}
          {!isDelivered && <CountdownRing etaMin={data.etaMin} />}
          {isDelivered && (
            <div className="flex flex-col items-center gap-1">
              <CheckCircle2 className="h-14 w-14 text-emerald-500" />
              <span className="text-[9px] font-bold text-emerald-600 uppercase">Fertig</span>
            </div>
          )}

          {/* Info column */}
          <div className="flex-1 min-w-0 space-y-1">
            {data.fahrerName && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Bike className="h-3.5 w-3.5" />
                Fahrer: <span className="text-foreground">{data.fahrerName}</span>
              </div>
            )}
            {data.fahrerDistanzM !== null && (
              <DriverProximity distanzM={data.fahrerDistanzM} />
            )}
            {data.delayReason && (
              <div className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-2 py-1 border border-amber-200">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {data.delayReason}
              </div>
            )}
            {data.etaMin !== null && !isDelivered && (
              <div className="text-[10px] text-muted-foreground">
                Ankunft in ca. <strong>{data.etaMin} Minuten</strong>
              </div>
            )}
          </div>
        </div>

        {/* Phase progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            {PHASES.map((ph, i) => {
              const phIdx = phaseIndex(ph.key);
              const active = curPhaseIdx === phIdx;
              const past = curPhaseIdx > phIdx;
              return (
                <div key={ph.key} className="flex flex-col items-center gap-1 flex-1">
                  <div className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center transition-all duration-500',
                    past ? 'bg-emerald-500 text-white' :
                    active ? 'bg-matcha-600 text-white scale-110 shadow-md' :
                    'bg-stone-100 dark:bg-stone-800 text-stone-400'
                  )}>
                    {ph.icon}
                  </div>
                  <span className={cn(
                    'text-[8px] font-semibold text-center leading-tight',
                    active ? 'text-matcha-700 font-black' :
                    past ? 'text-emerald-600' : 'text-muted-foreground'
                  )}>
                    {ph.label}
                  </span>
                  {i < PHASES.length - 1 && (
                    <div className="absolute" />
                  )}
                </div>
              );
            })}
          </div>
          {/* Connecting line */}
          <div className="relative h-1 rounded-full bg-stone-200 dark:bg-stone-700 -mt-5 mx-3 mb-6">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-emerald-400 transition-all duration-700"
              style={{ width: `${Math.min(100, (curPhaseIdx - 1) / (PHASES.length - 1) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
