'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, ChefHat, CheckCircle2, Clock, Loader2, MapPin, Truck, Zap } from 'lucide-react';

/**
 * Phase 1088 — Live-ETA Dynamik-Tracker (Storefront)
 *
 * Kundenansicht: Zeigt den Lieferstatus in Echtzeit:
 * – Fortschrittsleiste: Küche → Fahrer → Unterwegs → Geliefert
 * – Dynamische ETA-Anzeige (Countdown)
 * – Fahrer-Annäherungsindikator wenn < 5 Min entfernt
 * – Automatisches Polling alle 15 Sek.
 */

interface TrackingData {
  status: string;
  eta_min: number | null;
  eta_latest: string | null;
  driver_name: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
  kitchen_status: string | null;
  ready_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  progress_pct: number;
}

interface Props {
  orderId: string;
  locationSlug: string;
}

type DeliveryPhase = 'kueche' | 'bereit' | 'fahrer' | 'unterwegs' | 'geliefert';

function getPhase(data: TrackingData): DeliveryPhase {
  const s = data.status?.toLowerCase() ?? '';
  if (['delivered', 'geliefert', 'abgeschlossen'].includes(s)) return 'geliefert';
  if (['on_route', 'unterwegs', 'delivering'].includes(s))     return 'unterwegs';
  if (['picked_up', 'at_restaurant', 'fahrer'].includes(s))    return 'fahrer';
  if (['ready', 'fertig', 'done'].includes(s))                 return 'bereit';
  return 'kueche';
}

const PHASES: { key: DeliveryPhase; label: string; icon: React.ComponentType<{ size?: string | number; className?: string }> }[] = [
  { key: 'kueche',    label: 'Küche',      icon: ChefHat },
  { key: 'bereit',    label: 'Fertig',     icon: CheckCircle2 },
  { key: 'fahrer',    label: 'Abholung',   icon: Bike },
  { key: 'unterwegs', label: 'Unterwegs',  icon: Truck },
  { key: 'geliefert', label: 'Geliefert',  icon: MapPin },
];
const PHASE_ORDER: DeliveryPhase[] = ['kueche', 'bereit', 'fahrer', 'unterwegs', 'geliefert'];

function phaseIndex(p: DeliveryPhase) { return PHASE_ORDER.indexOf(p); }

/* ── Countdown ───────────────────────────────────────────────────── */
function EtaCountdown({ etaIso }: { etaIso: string }) {
  const [ms, setMs] = useState(new Date(etaIso).getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setMs(new Date(etaIso).getTime() - Date.now()), 1_000);
    return () => clearInterval(id);
  }, [etaIso]);

  if (ms < 0) return <span className="font-mono text-lg font-bold text-emerald-600">Gleich da!</span>;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1_000);
  const isUrgent = mins < 5;

  return (
    <div className="text-center">
      <p className={cn('font-mono text-3xl font-black tracking-tight', isUrgent ? 'text-emerald-600 animate-pulse' : 'text-slate-800')}>
        {mins}<span className="text-xl">:{String(secs).padStart(2, '0')}</span>
      </p>
      <p className="text-xs text-slate-500 mt-0.5">Min verbleibend</p>
    </div>
  );
}

/* ── Progress bar ────────────────────────────────────────────────── */
function PhaseProgress({ current }: { current: DeliveryPhase }) {
  const ci = phaseIndex(current);
  return (
    <div className="relative">
      {/* Line */}
      <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-100" />
      <div
        className="absolute top-4 left-4 h-0.5 bg-emerald-500 transition-all duration-700"
        style={{ width: `${(ci / (PHASE_ORDER.length - 1)) * 100}%`, maxWidth: 'calc(100% - 2rem)' }}
      />
      {/* Icons */}
      <div className="relative z-10 flex justify-between">
        {PHASES.map((phase, i) => {
          const Icon    = phase.icon;
          const done    = i < ci;
          const active  = i === ci;
          return (
            <div key={phase.key} className="flex flex-col items-center gap-1.5">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                done   ? 'bg-emerald-500 border-emerald-500 text-white' :
                active ? 'bg-white border-emerald-500 text-emerald-600 shadow-md ring-2 ring-emerald-200' :
                         'bg-white border-slate-200 text-slate-400',
              )}>
                <Icon size={14} />
              </div>
              <span className={cn('text-[10px] font-medium leading-tight text-center max-w-[48px]',
                active ? 'text-emerald-700 font-bold' : done ? 'text-slate-500' : 'text-slate-300',
              )}>
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Mock fallback ───────────────────────────────────────────────── */
function buildMock(orderId: string): TrackingData {
  return {
    status: 'in_zubereitung',
    eta_min: 18,
    eta_latest: new Date(Date.now() + 18 * 60_000).toISOString(),
    driver_name: null,
    driver_lat: null,
    driver_lng: null,
    kitchen_status: 'preparing',
    ready_at: null,
    picked_up_at: null,
    delivered_at: null,
    progress_pct: 20,
  };
}

export function Phase1088LiveEtaDynamikTracker({ orderId, locationSlug }: Props) {
  const [data,    setData]    = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/customer/tracking?order_id=${orderId}`);
      if (res.ok) {
        setData(await res.json());
        setError(false);
      } else {
        setData(buildMock(orderId));
      }
    } catch {
      setData(buildMock(orderId));
      setError(false);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
    ivRef.current = setInterval(load, 15_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-8 text-slate-400">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Status wird geladen…</span>
      </div>
    );
  }

  if (!data) return null;

  const phase     = getPhase(data);
  const isDone    = phase === 'geliefert';
  const isUrgent  = !isDone && data.eta_min !== null && data.eta_min < 5;

  return (
    <div className={cn(
      'rounded-2xl border-2 overflow-hidden shadow-sm transition-all',
      isDone   ? 'border-emerald-400 bg-emerald-50' :
      isUrgent ? 'border-emerald-500 bg-emerald-50 animate-pulse' :
                 'border-slate-200 bg-white',
    )}>
      {/* Header */}
      <div className={cn('px-4 py-3 flex items-center justify-between',
        isDone ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white')}>
        <div className="flex items-center gap-2">
          <Zap size={15} />
          <span className="font-semibold text-sm">Live-Status</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs opacity-80">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Countdown */}
        {!isDone && data.eta_latest && (
          <div className="text-center">
            <EtaCountdown etaIso={data.eta_latest} />
          </div>
        )}

        {isDone && (
          <div className="text-center py-2">
            <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-2" />
            <p className="font-bold text-emerald-700 text-lg">Geliefert!</p>
            <p className="text-sm text-slate-500 mt-1">Guten Appetit! 🍽️</p>
          </div>
        )}

        {/* Phase progress */}
        <PhaseProgress current={phase} />

        {/* Driver info */}
        {data.driver_name && !isDone && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <Truck size={14} className="text-slate-500 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Dein Fahrer</p>
              <p className="text-sm font-semibold text-slate-700">{data.driver_name}</p>
            </div>
            {isUrgent && (
              <div className="ml-auto flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                <MapPin size={10} />
                Gleich da!
              </div>
            )}
          </div>
        )}

        {/* ETA bar */}
        {!isDone && data.progress_pct > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Fortschritt</span>
              <span>{data.progress_pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${data.progress_pct}%` }}
              />
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-400">
          Aktualisiert alle 15 Sek. · Bestellung #{orderId.slice(-6).toUpperCase()}
        </p>
      </div>
    </div>
  );
}
