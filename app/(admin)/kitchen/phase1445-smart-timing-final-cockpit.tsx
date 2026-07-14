'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Flame, CheckCircle2, AlertTriangle, ChefHat, Zap, Timer, BarChart2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
  typ?: string;
  items?: { name: string; menge: number }[];
}

interface KitchenTiming {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
}

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

type TimingColor = 'gruen' | 'gelb' | 'orange' | 'rot' | 'fertig';

interface TimingInfo {
  color: TimingColor;
  remainSec: number;
  pct: number;
  label: string;
}

function getTimingInfo(order: Order, timing: KitchenTiming | undefined, now: number): TimingInfo {
  if (['fertig', 'unterwegs', 'geliefert'].includes(order.status)) {
    return { color: 'fertig', remainSec: 0, pct: 100, label: 'Fertig' };
  }

  const prepMin = timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 15;

  if (timing?.cook_start_at && timing.ready_target) {
    const startMs = new Date(timing.cook_start_at).getTime();
    const targetMs = new Date(timing.ready_target).getTime();
    const totalSec = Math.max(1, (targetMs - startMs) / 1000);
    const elapsedSec = (now - startMs) / 1000;
    const remainSec = Math.round((targetMs - now) / 1000);
    const pct = Math.min(100, Math.max(0, (elapsedSec / totalSec) * 100));

    if (remainSec < -120) return { color: 'rot', remainSec, pct: 100, label: 'Überfällig' };
    if (remainSec < 60)   return { color: 'rot', remainSec, pct, label: 'Kritisch' };
    if (remainSec < 180)  return { color: 'orange', remainSec, pct, label: 'Eilt' };
    if (pct >= 65)        return { color: 'gelb', remainSec, pct, label: 'Aufgepasst' };
    return { color: 'gruen', remainSec, pct, label: 'Im Plan' };
  }

  if (order.bestellt_am) {
    const orderMs = new Date(order.bestellt_am).getTime();
    const totalMs = prepMin * 60_000;
    const elapsedMs = now - orderMs;
    const remainSec = Math.round((orderMs + totalMs - now) / 1000);
    const pct = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));

    if (remainSec < -120) return { color: 'rot', remainSec, pct: 100, label: 'Überfällig' };
    if (remainSec < 60)   return { color: 'rot', remainSec, pct, label: 'Kritisch' };
    if (pct >= 85)        return { color: 'orange', remainSec, pct, label: 'Eilt' };
    if (pct >= 65)        return { color: 'gelb', remainSec, pct, label: 'Aufgepasst' };
    return { color: 'gruen', remainSec, pct, label: 'Im Plan' };
  }

  return { color: 'gruen', remainSec: prepMin * 60, pct: 0, label: 'Im Plan' };
}

const COLOR_STYLES: Record<TimingColor, { tile: string; ring: string; badge: string; bar: string; icon: string }> = {
  gruen:  { tile: 'bg-green-50 border-green-200',   ring: 'stroke-green-500',  badge: 'bg-green-500 text-white',   bar: 'bg-green-500',  icon: 'text-green-600'  },
  gelb:   { tile: 'bg-yellow-50 border-yellow-300', ring: 'stroke-yellow-400', badge: 'bg-yellow-400 text-black',  bar: 'bg-yellow-400', icon: 'text-yellow-600' },
  orange: { tile: 'bg-orange-50 border-orange-300', ring: 'stroke-orange-500', badge: 'bg-orange-500 text-white',  bar: 'bg-orange-500', icon: 'text-orange-600' },
  rot:    { tile: 'bg-red-50 border-red-300',       ring: 'stroke-red-500',    badge: 'bg-red-500 text-white',     bar: 'bg-red-500',    icon: 'text-red-600'    },
  fertig: { tile: 'bg-matcha-50 border-matcha-200', ring: 'stroke-matcha-500', badge: 'bg-matcha-500 text-white',  bar: 'bg-matcha-500', icon: 'text-matcha-600' },
};

function fmtCountdown(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const prefix = sec < 0 ? '+' : '';
  return `${prefix}${m}:${String(s).padStart(2, '0')}`;
}

function CountdownRing({ pct, color, sec }: { pct: number; color: TimingColor; sec: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct / 100);
  const styles = COLOR_STYLES[color];
  return (
    <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56" fill="none">
        <circle cx="28" cy="28" r={r} stroke="currentColor" strokeWidth="4" className="text-black/10" />
        <circle
          cx="28" cy="28" r={r}
          stroke="currentColor"
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
          className={cn('transition-all duration-700', styles.ring)}
        />
      </svg>
      <span className={cn('relative z-10 font-mono text-[10px] font-black tabular-nums', styles.icon)}>
        {color === 'fertig' ? '✓' : fmtCountdown(sec)}
      </span>
    </div>
  );
}

export function KitchenPhase1445SmartTimingFinalCockpit({ orders, timings }: Props) {
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const active = orders.filter(o => ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status));
  if (active.length === 0) return null;

  const rows = active.map(o => {
    const timing = timings.find(t => t.order_id === o.id);
    const info = getTimingInfo(o, timing, now);
    return { order: o, timing, info };
  }).sort((a, b) => {
    const order: TimingColor[] = ['rot', 'orange', 'gelb', 'gruen', 'fertig'];
    const diff = order.indexOf(a.info.color) - order.indexOf(b.info.color);
    if (diff !== 0) return diff;
    return a.info.remainSec - b.info.remainSec;
  });

  const counts = rows.reduce((acc, r) => {
    acc[r.info.color] = (acc[r.info.color] ?? 0) + 1;
    return acc;
  }, {} as Record<TimingColor, number>);

  const criticalCount = (counts.rot ?? 0);
  const urgentCount = (counts.orange ?? 0);

  return (
    <Card className={cn('overflow-hidden border', criticalCount > 0 ? 'border-red-200' : urgentCount > 0 ? 'border-orange-200' : 'border-matcha-200')}>
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition"
        onClick={() => setOpen(v => !v)}
      >
        <Timer className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-black uppercase tracking-wider text-foreground flex-1 text-left">
          Smart-Timing · Farbkodierung v1445
        </span>
        <div className="flex items-center gap-1.5">
          {criticalCount > 0 && (
            <span className="rounded-full bg-red-500 text-white px-2 py-0.5 text-[9px] font-black animate-pulse">
              {criticalCount} kritisch
            </span>
          )}
          {urgentCount > 0 && (
            <span className="rounded-full bg-orange-500 text-white px-2 py-0.5 text-[9px] font-black">
              {urgentCount} eilt
            </span>
          )}
          <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <>
          {/* Statistik-Leiste */}
          <div className="grid grid-cols-4 divide-x border-t border-b bg-muted/20">
            {([
              { color: 'gruen' as TimingColor, label: 'Im Plan', icon: CheckCircle2 },
              { color: 'gelb' as TimingColor, label: 'Aufgepasst', icon: Clock },
              { color: 'orange' as TimingColor, label: 'Eilt', icon: Flame },
              { color: 'rot' as TimingColor, label: 'Überfällig', icon: AlertTriangle },
            ]).map(({ color, label, icon: Icon }) => (
              <div key={color} className="flex flex-col items-center py-2 gap-0.5">
                <Icon className={cn('h-3.5 w-3.5', COLOR_STYLES[color].icon)} />
                <span className={cn('text-lg font-black tabular-nums leading-none', COLOR_STYLES[color].icon)}>
                  {counts[color] ?? 0}
                </span>
                <span className="text-[9px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          {/* Countdown-Grid */}
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {rows.map(({ order, info }) => {
              const styles = COLOR_STYLES[info.color];
              return (
                <div
                  key={order.id}
                  className={cn('flex items-center gap-3 rounded-xl border p-3', styles.tile)}
                >
                  <CountdownRing pct={info.pct} color={info.color} sec={info.remainSec} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-black">#{order.bestellnummer.replace('FF-', '')}</span>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', styles.badge)}>
                        {info.label}
                      </span>
                      {order.typ === 'lieferung' && (
                        <span className="text-[9px] text-muted-foreground">🚴</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate mb-1">{order.kunde_name}</div>
                    {/* Progress Bar */}
                    <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', styles.bar)}
                        style={{ width: `${info.pct}%` }}
                      />
                    </div>
                    {order.items && order.items.length > 0 && (
                      <div className="mt-1 text-[9px] text-muted-foreground truncate">
                        {order.items.slice(0, 3).map(i => `${i.menge}× ${i.name}`).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
