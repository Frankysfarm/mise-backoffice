'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Flame, Loader2, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1185 — Smart-Timing Farbkodierung Cockpit (Kitchen)
// Echtzeit-Countdown + Ampel-Farbkodierung für jede aktive Bestellung

interface Order {
  id: string;
  bestellnummer?: string;
  created_at?: string;
  geschaetzte_zubereitung_min?: number | null;
  status?: string;
  items_count?: number;
}

interface Props {
  orders: Order[];
}

type Ampel = 'gruen' | 'gelb' | 'orange' | 'rot';

interface CountdownEntry {
  id: string;
  nr: string;
  restSec: number;
  totalSec: number;
  ampel: Ampel;
  itemsCount: number;
}

const AMPEL_CFG: Record<Ampel, { bg: string; border: string; text: string; bar: string; label: string; pulse?: boolean }> = {
  gruen:  { bg: 'bg-matcha-50',  border: 'border-matcha-300',  text: 'text-matcha-700',  bar: 'bg-matcha-500',  label: 'Auf Kurs' },
  gelb:   { bg: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-700',   bar: 'bg-amber-400',   label: 'Bald fällig' },
  orange: { bg: 'bg-orange-50',  border: 'border-orange-300',  text: 'text-orange-700',  bar: 'bg-orange-500',  label: 'Dringend' },
  rot:    { bg: 'bg-red-50',     border: 'border-red-300',     text: 'text-red-700',     bar: 'bg-red-500',     label: 'Überfällig', pulse: true },
};

function buildEntries(orders: Order[]): CountdownEntry[] {
  const now = Date.now();
  return orders
    .filter(o => ['accepted', 'preparing'].includes(o.status ?? ''))
    .map(o => {
      const prepMin = o.geschaetzte_zubereitung_min ?? 18;
      const totalSec = prepMin * 60;
      const startMs = o.created_at ? new Date(o.created_at).getTime() : now;
      const elapsedSec = (now - startMs) / 1000;
      const restSec = Math.round(totalSec - elapsedSec);
      const pct = Math.max(0, Math.min(1, elapsedSec / totalSec));
      let ampel: Ampel = 'gruen';
      if (restSec < 0) ampel = 'rot';
      else if (restSec < 120) ampel = 'orange';
      else if (pct > 0.6) ampel = 'gelb';
      return {
        id: o.id,
        nr: o.bestellnummer ?? o.id.slice(-4),
        restSec,
        totalSec,
        ampel,
        itemsCount: o.items_count ?? 1,
      };
    })
    .sort((a, b) => a.restSec - b.restSec);
}

function fmt(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '-' : '';
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

export function KitchenPhase1185SmartTimingFarbkodierungCockpit({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const [entries, setEntries] = useState<CountdownEntry[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setEntries(buildEntries(orders));
  }, [orders, tick]);

  const rotCount = entries.filter(e => e.ampel === 'rot').length;
  const orangeCount = entries.filter(e => e.ampel === 'orange').length;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-bold">Smart-Timing Farbkodierung</span>
          {rotCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
              {rotCount} überfällig
            </span>
          )}
          {orangeCount > 0 && rotCount === 0 && (
            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black text-white">
              {orangeCount} dringend
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground">{entries.length} aktiv</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {entries.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-3">
              Keine aktiven Bestellungen
            </div>
          )}
          {entries.map(e => {
            const cfg = AMPEL_CFG[e.ampel];
            const pct = Math.max(0, Math.min(100, (1 - e.restSec / e.totalSec) * 100));
            return (
              <div
                key={e.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2.5',
                  cfg.bg, cfg.border,
                  cfg.pulse && 'animate-pulse',
                )}
              >
                {/* Nummer + Items */}
                <div className="shrink-0 w-12 text-center">
                  <div className={cn('text-xs font-black', cfg.text)}>#{e.nr}</div>
                  <div className="text-[9px] text-muted-foreground">{e.itemsCount} Pos.</div>
                </div>

                {/* Progress bar + countdown */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn('text-[10px] font-semibold', cfg.text)}>{cfg.label}</span>
                    <span className={cn('font-mono text-xs font-black tabular-nums', cfg.text)}>
                      {e.restSec < 0 ? '−' : ''}{fmt(Math.abs(e.restSec))}
                    </span>
                  </div>
                </div>

                {/* Ampel dot */}
                <div className={cn('shrink-0 h-3 w-3 rounded-full', cfg.bar)} />
              </div>
            );
          })}

          {/* Legende */}
          {entries.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {(['gruen', 'gelb', 'orange', 'rot'] as Ampel[]).map(a => (
                <span key={a} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className={cn('h-2 w-2 rounded-full', AMPEL_CFG[a].bar)} />
                  {AMPEL_CFG[a].label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
