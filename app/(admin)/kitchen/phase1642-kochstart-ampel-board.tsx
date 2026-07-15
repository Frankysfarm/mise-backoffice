'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface OrderInput {
  id: string;
  bestellnummer?: string;
  status: string;
  bestellt_am?: string | null;
  prep_time?: number | null;
  zone?: string | null;
}

interface Props {
  orders: OrderInput[];
}

type Ampel = 'gruen' | 'gelb' | 'rot';

interface AmpelEntry {
  id: string;
  bestellnummer: string;
  status: string;
  ampel: Ampel;
  countdown_s: number;
  dringlichkeit: number;
  zone: string | null;
}

const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'in_zubereitung']);
const DEFAULT_PREP_MIN = 15;

function calcAmpel(countdown_s: number): Ampel {
  if (countdown_s > 5 * 60) return 'gruen';
  if (countdown_s > 0) return 'gelb';
  return 'rot';
}

function fmtCountdown(s: number): string {
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  const sign = s < 0 ? '-' : '';
  return `${sign}${m}:${sec.toString().padStart(2, '0')}`;
}

const AMPEL_STYLE: Record<Ampel, { dot: string; ring: string; label: string; text: string }> = {
  gruen: { dot: 'bg-emerald-500', ring: 'ring-emerald-200', label: 'Kochstart-Fenster offen', text: 'text-emerald-700' },
  gelb:  { dot: 'bg-amber-400',   ring: 'ring-amber-200',   label: 'Bald starten!',           text: 'text-amber-700' },
  rot:   { dot: 'bg-red-500',     ring: 'ring-red-200',     label: 'Sofort starten!',          text: 'text-red-700' },
};

export function KitchenPhase1642KochstartAmpelBoard({ orders }: Props) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(iv);
  }, []);

  const entries = useMemo<AmpelEntry[]>(() => {
    return orders
      .filter((o) => ACTIVE_STATUSES.has(o.status))
      .map((o): AmpelEntry => {
        const ordered = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
        const prepMin = o.prep_time ?? DEFAULT_PREP_MIN;
        const cookDeadline = ordered + prepMin * 60_000;
        const countdown_s = Math.round((cookDeadline - now) / 1_000);
        const ampel = calcAmpel(countdown_s);
        const dringlichkeit = ampel === 'rot' ? 0 : ampel === 'gelb' ? 1 : 2;
        return {
          id: o.id,
          bestellnummer: o.bestellnummer ?? `#${o.id.slice(0, 4)}`,
          status: o.status,
          ampel,
          countdown_s,
          dringlichkeit,
          zone: o.zone ?? null,
        };
      })
      .sort((a, b) => a.dringlichkeit - b.dringlichkeit || a.countdown_s - b.countdown_s);
  }, [orders, now]);

  if (entries.length === 0) return null;

  const rot   = entries.filter((e) => e.ampel === 'rot').length;
  const gelb  = entries.filter((e) => e.ampel === 'gelb').length;
  const gruen = entries.filter((e) => e.ampel === 'gruen').length;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Live-Kochstart-Ampel</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />{rot}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />{gelb}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />{gruen}</span>
        </div>
      </div>

      <div className="space-y-2">
        {entries.map((e) => {
          const style = AMPEL_STYLE[e.ampel];
          return (
            <div
              key={e.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2 ring-1',
                style.ring,
                e.ampel === 'rot' ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900' :
                e.ampel === 'gelb' ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900' :
                'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900',
              )}
            >
              <span className={cn('h-3 w-3 shrink-0 rounded-full', style.dot, e.ampel === 'rot' && 'animate-pulse')} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums">{e.bestellnummer}</span>
                  {e.zone && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Zone {e.zone}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground capitalize">{e.status.replace('_', ' ')}</span>
                </div>
                <div className={cn('text-[11px] font-medium', style.text)}>{style.label}</div>
              </div>
              <div className={cn('font-mono text-sm font-bold tabular-nums shrink-0', style.text)}>
                {fmtCountdown(e.countdown_s)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
