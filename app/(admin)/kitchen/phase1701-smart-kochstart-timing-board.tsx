'use client';

import { useEffect, useState } from 'react';
import { Flame, Clock, CheckCircle2, AlertTriangle, ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items?: { name: string }[];
};

type Props = { orders: Order[] };

type UrgencyLevel = 'ok' | 'knapp' | 'kritisch' | 'ueberfaellig';

const URGENCY: Record<UrgencyLevel, { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{className?: string}> }> = {
  ok:          { label: 'OK',          bg: 'bg-matcha-50',  text: 'text-matcha-700',  border: 'border-matcha-200', icon: CheckCircle2 },
  knapp:       { label: 'Knapp',       bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  icon: Clock },
  kritisch:    { label: 'Kritisch',    bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200', icon: AlertTriangle },
  ueberfaellig:{ label: 'Überfällig',  bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',    icon: Flame },
};

function getUrgency(elapsedSec: number, targetSec: number): UrgencyLevel {
  const ratio = elapsedSec / (targetSec || 1);
  if (elapsedSec > targetSec + 120) return 'ueberfaellig';
  if (ratio >= 0.9) return 'kritisch';
  if (ratio >= 0.7) return 'knapp';
  return 'ok';
}

function fmtRemain(remainSec: number) {
  if (remainSec <= 0) {
    const over = Math.abs(remainSec);
    return `+${Math.floor(over / 60)}:${String(Math.floor(over % 60)).padStart(2, '0')}`;
  }
  return `${Math.floor(remainSec / 60)}:${String(Math.floor(remainSec % 60)).padStart(2, '0')}`;
}

export function KitchenPhase1701SmartKochstartTimingBoard({ orders }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const active = orders
    .filter((o) => ['bestätigt', 'in_zubereitung', 'confirmed'].includes(o.status))
    .map((o) => {
      const startMs = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
      const targetSec = (o.geschaetzte_zubereitung_min ?? 20) * 60;
      const elapsedSec = (now - startMs) / 1000;
      const remainSec = targetSec - elapsedSec;
      const urgency = getUrgency(elapsedSec, targetSec);
      const pct = Math.min(100, (elapsedSec / targetSec) * 100);
      return { ...o, elapsedSec, targetSec, remainSec, urgency, pct };
    })
    .sort((a, b) => a.remainSec - b.remainSec);

  const counts: Record<UrgencyLevel, number> = { ok: 0, knapp: 0, kritisch: 0, ueberfaellig: 0 };
  active.forEach((o) => counts[o.urgency]++);

  if (active.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Kochstatus-Timing-Board
          </span>
          <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            {active.length} aktiv
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {(Object.entries(counts) as [UrgencyLevel, number][])
            .filter(([, n]) => n > 0)
            .map(([k, n]) => {
              const cfg = URGENCY[k];
              return (
                <span key={k} className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', cfg.bg, cfg.text)}>
                  {n} {cfg.label}
                </span>
              );
            })}
        </div>
      </div>

      {/* Order rows */}
      <div className="divide-y">
        {active.map((o) => {
          const cfg = URGENCY[o.urgency];
          const Icon = cfg.icon;
          const barColor =
            o.urgency === 'ueberfaellig' ? 'bg-red-500' :
            o.urgency === 'kritisch'     ? 'bg-orange-500' :
            o.urgency === 'knapp'        ? 'bg-amber-400' :
                                           'bg-matcha-500';
          return (
            <div key={o.id} className={cn('flex items-center gap-3 px-4 py-2.5', cfg.bg)}>
              <Icon className={cn('h-4 w-4 shrink-0', cfg.text)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-sm font-bold tabular-nums">#{o.bestellnummer}</span>
                  {o.items && o.items.length > 0 && (
                    <span className="truncate text-[11px] text-muted-foreground">
                      {o.items.slice(0, 2).map((i) => i.name).join(', ')}
                      {o.items.length > 2 ? ` +${o.items.length - 2}` : ''}
                    </span>
                  )}
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
                  <div
                    className={cn('h-full rounded-full transition-all duration-1000', barColor)}
                    style={{ width: `${o.pct}%` }}
                  />
                </div>
              </div>
              <div className={cn('shrink-0 text-right')}>
                <div className={cn('font-mono text-base font-black tabular-nums', cfg.text)}>
                  {fmtRemain(o.remainSec)}
                </div>
                <div className="text-[10px] text-muted-foreground">{cfg.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
