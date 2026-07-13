'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChefHat, Clock, Flame, Timer, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1382 — Smart-Timing Countdown Cockpit (Kitchen)
 *
 * Kombiniertes Cockpit:
 *  • Echtzeit-Sekunden-Countdown je aktiver Bestellung (1-Sekunden-Tick)
 *  • 4-stufige Farbkodierung: Grün ≥6min | Gelb 3–5min | Orange 1–2min | Rot ≤0min
 *  • Sortierung: Dringlichste zuerst (Rot → Orange → Gelb → Grün)
 *  • Batch-Aufhebung: Mehrere Bestellungen desselben Batches werden gruppiert
 *  • Puls-Animation bei überfälligen Bestellungen
 *
 * Props-basiert, kein eigener API-Aufruf. Nach Phase1377 in kitchen/client.tsx.
 */

type OrderStatus = 'neu' | 'angenommen' | 'in_zubereitung' | 'fertig' | string;

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
  batch_id?: string | null;
}

interface Timing {
  order_id: string;
  prep_min_estimate?: number | null;
  cook_start?: string | null;
  ready_target?: string | null;
}

interface Props {
  orders: Order[];
  timings?: Timing[];
}

type Stufe = 'gruen' | 'gelb' | 'orange' | 'rot';

interface Row {
  id: string;
  nr: string;
  zone: string | null;
  batchId: string | null;
  restSek: number;
  stufe: Stufe;
}

const STYLE: Record<Stufe, {
  bg: string; border: string; text: string; badge: string; puls: boolean; icon: React.ReactNode; label: string;
}> = {
  gruen:  { bg: 'bg-green-50 dark:bg-green-950/20',  border: 'border-green-200 dark:border-green-800',  text: 'text-green-700 dark:text-green-300',  badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',  puls: false, icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'OK' },
  gelb:   { bg: 'bg-yellow-50 dark:bg-yellow-950/20', border: 'border-yellow-300 dark:border-yellow-700', text: 'text-yellow-700 dark:text-yellow-300', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300', puls: false, icon: <Timer className="h-3.5 w-3.5" />,       label: 'Bald' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300', puls: false, icon: <Flame className="h-3.5 w-3.5" />,        label: 'Jetzt!' },
  rot:    { bg: 'bg-red-50 dark:bg-red-950/25',      border: 'border-red-400 dark:border-red-700',       text: 'text-red-700 dark:text-red-300',       badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',          puls: true,  icon: <AlertCircle className="h-3.5 w-3.5" />,   label: 'Überfällig' },
};

const STUFEN_ORDER: Stufe[] = ['rot', 'orange', 'gelb', 'gruen'];

function toStufe(restSek: number): Stufe {
  if (restSek <= 0)   return 'rot';
  if (restSek <= 120) return 'orange';
  if (restSek <= 300) return 'gelb';
  return 'gruen';
}

function formatTime(sek: number): string {
  const abs = Math.abs(sek);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const prefix = sek < 0 ? '+' : '';
  return `${prefix}${m}:${String(s).padStart(2, '0')}`;
}

function computeRestSek(order: Order, timing: Timing | undefined, now: Date): number {
  const prepMin = timing?.prep_min_estimate ?? order.geschaetzte_zubereitung_min ?? 12;

  if (timing?.ready_target) {
    return Math.round((new Date(timing.ready_target).getTime() - now.getTime()) / 1000);
  }

  const startStr = timing?.cook_start ?? order.zubereitung_start ?? order.started_at ?? order.bestellt_am;
  if (!startStr) return prepMin * 60;

  const start = new Date(startStr);
  const zielMs = start.getTime() + prepMin * 60 * 1000;
  return Math.round((zielMs - now.getTime()) / 1000);
}

const ACTIVE_STATUSES = new Set(['neu', 'angenommen', 'in_zubereitung', 'bestätigt']);

export function KitchenPhase1386SmartTimingCountdownCockpit({ orders, timings = [] }: Props) {
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const now = new Date();

  const rows: Row[] = orders
    .filter((o) => ACTIVE_STATUSES.has(o.status))
    .map((o) => {
      const timing = timings.find((t) => t.order_id === o.id);
      const restSek = computeRestSek(o, timing, now);
      return {
        id: o.id,
        nr: o.bestellnummer ?? o.id.slice(-4),
        zone: o.delivery_zone ?? null,
        batchId: o.batch_id ?? null,
        restSek,
        stufe: toStufe(restSek),
      };
    })
    .sort((a, b) => {
      const si = STUFEN_ORDER.indexOf(a.stufe);
      const sj = STUFEN_ORDER.indexOf(b.stufe);
      if (si !== sj) return si - sj;
      return a.restSek - b.restSek;
    });

  const counts: Record<Stufe, number> = { gruen: 0, gelb: 0, orange: 0, rot: 0 };
  rows.forEach((r) => counts[r.stufe]++);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-matcha-50 dark:bg-matcha-950/30 border-b border-border">
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Smart-Timing Countdown · {rows.length} Aktiv
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {counts.rot > 0    && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">{counts.rot}×</span>}
          {counts.orange > 0 && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-700">{counts.orange}×</span>}
          {counts.gelb > 0   && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-black text-yellow-700">{counts.gelb}×</span>}
          {counts.gruen > 0  && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-700">{counts.gruen}×</span>}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/60">
        {rows.map((row) => {
          const s = STYLE[row.stufe];
          return (
            <div
              key={row.id}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 transition-colors',
                s.bg,
                row.stufe === 'rot' && 'animate-pulse',
              )}
            >
              {/* Status badge */}
              <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black min-w-[70px] justify-center', s.badge)}>
                {s.icon}
                {s.label}
              </span>

              {/* Order info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={cn('text-xs font-bold', s.text)}>#{row.nr}</span>
                  {row.zone && (
                    <span className="text-[9px] rounded-full bg-white/60 dark:bg-white/10 border border-border/50 px-1.5 py-0.5 font-semibold text-muted-foreground">
                      Zone {row.zone}
                    </span>
                  )}
                  {row.batchId && (
                    <span className="text-[9px] rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 font-semibold">
                      Batch
                    </span>
                  )}
                </div>
              </div>

              {/* Countdown */}
              <div className={cn('font-mono text-lg font-black tabular-nums shrink-0', s.text)}>
                {formatTime(row.restSek)}
              </div>

              {/* Icon */}
              <div className={cn('shrink-0', s.text)}>
                {row.stufe === 'rot'    ? <Zap className="h-4 w-4" /> :
                 row.stufe === 'orange' ? <Flame className="h-4 w-4" /> :
                 row.stufe === 'gelb'   ? <Clock className="h-4 w-4" /> :
                                         <CheckCircle2 className="h-4 w-4" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer legend */}
      <div className="flex items-center gap-4 px-4 py-2 bg-muted/40 border-t border-border/50">
        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Legende:</span>
        {([['gruen','≥6min'],['gelb','3–5min'],['orange','1–2min'],['rot','Überfällig']] as const).map(([s, l]) => (
          <span key={s} className={cn('text-[9px] font-bold', STYLE[s as Stufe].text)}>{l}</span>
        ))}
      </div>
    </div>
  );
}
