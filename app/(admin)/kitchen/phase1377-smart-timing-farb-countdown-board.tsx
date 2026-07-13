'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Flame, Timer, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1377 — Smart-Timing Farb-Countdown-Board (Kitchen)
 *
 * Echtzeit-Countdown aller aktiven Bestellungen mit 4-stufiger Farbkodierung:
 *   Grün   ≥ 6 Min  → OK, Zeit vorhanden
 *   Amber  3–5 Min  → Bald fertig, Aufmerksamkeit nötig
 *   Orange 1–2 Min  → Jetzt starten!
 *   Rot    ≤ 0 Min  → Überfällig — sofort handeln
 *
 * Sekunden-genaues Polling. Keine API erforderlich — rein props-basiert.
 * Nach Phase1372 in kitchen/client.tsx einbinden.
 */

type OrderStatus = 'neu' | 'angenommen' | 'zubereitung' | 'fertig' | 'unterwegs' | 'geliefert' | string;

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: OrderStatus;
  bestellt_am?: string | null;
  zubereitung_start?: string | null;
  started_at?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  kunde_name?: string | null;
  delivery_zone?: string | null;
}

interface Timing {
  order_id: string;
  prep_min_estimate?: number | null;
  cook_start?: string | null;
}

interface Props {
  orders: Order[];
  timings?: Timing[];
}

type FarbStufe = 'gruen' | 'amber' | 'orange' | 'rot';

interface OrderCountdown {
  id: string;
  bestellnummer: string;
  zone: string | null;
  restMinuten: number;
  restSekunden: number;
  stufe: FarbStufe;
  label: string;
}

const STUFEN_STYLE: Record<FarbStufe, {
  bg: string;
  border: string;
  text: string;
  badge: string;
  icon: React.ReactNode;
  label: string;
}> = {
  gruen: {
    bg: 'bg-green-50 dark:bg-green-950/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: 'OK',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-700',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    icon: <Timer className="h-3.5 w-3.5" />,
    label: 'Bald',
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-950/20',
    border: 'border-orange-300 dark:border-orange-700',
    text: 'text-orange-700 dark:text-orange-300',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
    icon: <Zap className="h-3.5 w-3.5" />,
    label: 'Jetzt!',
  },
  rot: {
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-300 dark:border-red-700',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    icon: <AlertCircle className="h-3.5 w-3.5 animate-pulse" />,
    label: 'Überfällig',
  },
};

function getStufe(restMinuten: number): FarbStufe {
  if (restMinuten < 0) return 'rot';
  if (restMinuten < 2) return 'orange';
  if (restMinuten < 6) return 'amber';
  return 'gruen';
}

function formatCountdown(restSek: number): string {
  const absS = Math.abs(restSek);
  const m = Math.floor(absS / 60);
  const s = absS % 60;
  const prefix = restSek < 0 ? '+' : '';
  return `${prefix}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const AKTIVE_STATUS: Set<string> = new Set(['angenommen', 'zubereitung', 'neu']);

export function KitchenPhase1377SmartTimingFarbCountdownBoard({ orders, timings = [] }: Props) {
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const countdowns = useMemo<OrderCountdown[]>(() => {
    const now = Date.now();
    const timingMap = new Map(timings.map((t) => [t.order_id, t]));

    return orders
      .filter((o) => AKTIVE_STATUS.has(o.status))
      .map((o) => {
        const timing = timingMap.get(o.id);
        const startStr = o.zubereitung_start ?? o.started_at ?? timing?.cook_start ?? o.bestellt_am;
        const startMs = startStr ? new Date(startStr).getTime() : now - 5 * 60 * 1000;
        const prepMin = timing?.prep_min_estimate ?? o.geschaetzte_zubereitung_min ?? 12;
        const fertigMs = startMs + prepMin * 60 * 1000;
        const restSek = Math.round((fertigMs - now) / 1000);
        const restMin = Math.floor(restSek / 60);
        const stufe = getStufe(restMin);
        return {
          id: o.id,
          bestellnummer: o.bestellnummer ?? o.id.slice(-4).toUpperCase(),
          zone: o.delivery_zone ?? null,
          restMinuten: restMin,
          restSekunden: restSek,
          stufe,
          label: o.kunde_name ?? 'Bestellung',
        };
      })
      .sort((a, b) => a.restSekunden - b.restSekunden);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, timings, tick]);

  if (countdowns.length === 0) return null;

  const ueberfaellig = countdowns.filter((c) => c.stufe === 'rot').length;
  const kritisch = countdowns.filter((c) => c.stufe === 'orange').length;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-matcha-600" />
        <h3 className="font-semibold text-sm text-foreground">Smart-Timing Farb-Countdown</h3>
        <div className="ml-auto flex items-center gap-2">
          {ueberfaellig > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <AlertCircle className="h-3 w-3 animate-pulse" />
              {ueberfaellig} überfällig
            </span>
          )}
          {kritisch > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              <Flame className="h-3 w-3" />
              {kritisch} jetzt
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">{countdowns.length} aktiv</span>
        </div>
      </div>

      {/* Countdown-Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {countdowns.map((c) => {
          const style = STUFEN_STYLE[c.stufe];
          const pct = Math.max(0, Math.min(100, c.restSekunden > 0
            ? (c.restSekunden / (12 * 60)) * 100
            : 0));
          return (
            <div
              key={c.id}
              className={cn(
                'relative overflow-hidden rounded-xl border px-3 py-2.5 space-y-1.5 transition-all duration-300',
                style.bg, style.border,
                c.stufe === 'rot' && 'ring-1 ring-red-400 dark:ring-red-600',
              )}
            >
              {/* Fortschrittsbalken (Hintergrund) */}
              <div
                className="absolute inset-0 opacity-10 transition-all duration-1000"
                style={{
                  background: c.stufe === 'rot' ? '#ef4444' :
                    c.stufe === 'orange' ? '#f97316' :
                    c.stufe === 'amber' ? '#f59e0b' : '#22c55e',
                  width: `${pct}%`,
                }}
              />

              {/* Inhalt */}
              <div className="relative flex items-center justify-between">
                <span className={cn('text-[10px] font-black tabular-nums', style.text)}>
                  #{c.bestellnummer}
                </span>
                <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold', style.badge)}>
                  {style.icon}
                  {style.label}
                </span>
              </div>

              {/* Countdown */}
              <div className={cn('relative font-mono text-xl font-black tabular-nums leading-none', style.text)}>
                {c.restSekunden < 0 && <span className="text-base">+</span>}
                {formatCountdown(c.restSekunden)}
              </div>

              {/* Zone */}
              {c.zone && (
                <div className="relative text-[10px] text-muted-foreground truncate">
                  Zone {c.zone}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legende */}
      <div className="flex flex-wrap items-center gap-3 border-t pt-2 text-[10px] text-muted-foreground">
        {(Object.entries(STUFEN_STYLE) as [FarbStufe, typeof STUFEN_STYLE[FarbStufe]][]).map(([key, s]) => (
          <span key={key} className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5', s.badge)}>
            {s.icon}
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
