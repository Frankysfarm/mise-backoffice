'use client';

// Phase 1308 — Smart-Kochstart-Countdown (Kitchen)
// Optimaler Kochstart je Bestellung basierend auf ETA des Fahrers:
// Farb-Ampel (grün/gelb/orange/rot) + Sekunden-Countdown + Kochstart-Button
// Props: orders[] · isOnline-Guard · kein API-Call nötig (berechnet aus Bestelldaten)

import { useEffect, useRef, useState, useMemo } from 'react';
import { ChefHat, Clock, Play, CheckCircle2, AlertTriangle, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderRow {
  id: string;
  bestellnummer?: string | null;
  status?: string | null;
  geschaetzte_lieferung_min?: number | null;
  zubereitungszeit_min?: number | null;
  created_at?: string | null;
}

interface Props {
  orders: OrderRow[];
  onKochstart?: (orderId: string) => void;
}

type Phase = 'optimal' | 'normal' | 'dringend' | 'kritisch' | 'ueberfaellig';

const PHASE_CONFIG: Record<Phase, { label: string; bg: string; badge: string; text: string; icon: React.ReactNode }> = {
  optimal: {
    label: 'Optimal',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  normal: {
    label: 'Normal',
    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-300',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  dringend: {
    label: 'Dringend',
    bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  kritisch: {
    label: 'Kritisch',
    bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    badge: 'bg-orange-500',
    text: 'text-orange-700 dark:text-orange-300',
    icon: <Flame className="h-3.5 w-3.5" />,
  },
  ueberfaellig: {
    label: 'Überfällig',
    bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    badge: 'bg-red-500 animate-pulse',
    text: 'text-red-700 dark:text-red-300',
    icon: <Flame className="h-3.5 w-3.5" />,
  },
};

function getPhase(restSek: number): Phase {
  if (restSek > 600) return 'optimal';
  if (restSek > 300) return 'normal';
  if (restSek > 120) return 'dringend';
  if (restSek > 0) return 'kritisch';
  return 'ueberfaellig';
}

function formatSek(s: number): string {
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  const prefix = s < 0 ? '+' : '';
  return `${prefix}${m}:${sec.toString().padStart(2, '0')}`;
}

export function KitchenPhase1308SmartKochstartCountdown({ orders, onKochstart }: Props) {
  const [tick, setTick] = useState(0);
  const [started, setStarted] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const relevant = useMemo(() => {
    const now = Date.now();
    return orders
      .filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status ?? ''))
      .map(o => {
        const etaMin = o.geschaetzte_lieferung_min ?? 30;
        const prepMin = o.zubereitungszeit_min ?? 12;
        const createdMs = o.created_at ? new Date(o.created_at).getTime() : now;
        // Kochstart = ETA - Zubereitungszeit; Rest bis idealem Kochstart
        const kochstartMs = createdMs + (etaMin - prepMin) * 60_000;
        const restSek = Math.round((kochstartMs - now) / 1000);
        return { ...o, restSek, phase: getPhase(restSek) };
      })
      .sort((a, b) => a.restSek - b.restSek)
      .slice(0, 8);
  }, [orders, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (relevant.length === 0) return null;

  const handleStart = (id: string) => {
    setStarted(s => new Set(s).add(id));
    onKochstart?.(id);
  };

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden mb-4">
      <div className="flex items-center gap-2 px-4 py-3 bg-stone-800 dark:bg-stone-950 text-white">
        <ChefHat className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-bold">Smart-Kochstart-Countdown</span>
        <span className="ml-auto text-[10px] bg-white/10 px-2 py-0.5 rounded-full">{relevant.length} Bestellungen</span>
      </div>

      <div className="divide-y divide-stone-100 dark:divide-stone-800">
        {relevant.map(order => {
          const cfg = PHASE_CONFIG[order.phase];
          const isStarted = started.has(order.id);

          return (
            <div key={order.id} className={cn('flex items-center gap-3 px-4 py-3 border-l-4', cfg.bg, `border-l-${cfg.badge.split(' ')[0].replace('bg-', '')}`)}>
              <div className={cn('flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white', cfg.badge)}>
                {cfg.icon}
                {cfg.label}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-stone-700 dark:text-stone-200 truncate">
                  #{order.bestellnummer ?? order.id.slice(-6)}
                </p>
                <p className="text-[10px] text-stone-500 dark:text-stone-400">
                  ETA {order.geschaetzte_lieferung_min ?? 30} Min · Prep {order.zubereitungszeit_min ?? 12} Min
                </p>
              </div>

              <div className={cn('font-mono text-base font-black min-w-[52px] text-right', cfg.text)}>
                {formatSek(order.restSek)}
              </div>

              {isStarted ? (
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-[10px] font-semibold">Gestartet</span>
                </div>
              ) : (
                <button
                  onClick={() => handleStart(order.id)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-colors',
                    order.phase === 'ueberfaellig' || order.phase === 'kritisch'
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                      : 'bg-stone-700 hover:bg-stone-800 dark:bg-stone-600 dark:hover:bg-stone-500',
                  )}
                >
                  <Play className="h-3 w-3" />
                  Starten
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
