'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle, CheckCircle2, Flame, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 2856 — Smart-Timing Farbkodierung Live Master
 *
 * Echtzeit-Farbkodierung aller aktiven Bestellungen nach verbleibender Zubereitungszeit.
 * Ampel grün/gelb/rot basierend auf Prep-Fortschritt + Fahrer-Sync.
 * Sekunden-genaue Countdowns + Überfälligkeits-Alert + 1-Sek-Tick.
 */

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
  prep_time_min?: number | null;
  items?: Array<{ name?: string; title?: string }> | null;
}

interface Props {
  orders: Order[];
}

type Ampel = 'gruen' | 'gelb' | 'rot' | 'kritisch';

interface Row {
  id: string;
  nr: string;
  elapsedSec: number;
  targetSec: number;
  remainSec: number;
  pct: number;
  ampel: Ampel;
  itemCount: number;
}

const AMPEL_CONFIG: Record<Ampel, { bg: string; border: string; text: string; badge: string; label: string }> = {
  gruen:   { bg: 'bg-matcha-50 dark:bg-matcha-900/20',   border: 'border-matcha-200 dark:border-matcha-700', text: 'text-matcha-700 dark:text-matcha-300',   badge: 'bg-matcha-500 text-white', label: 'Pünktlich' },
  gelb:    { bg: 'bg-amber-50 dark:bg-amber-900/20',     border: 'border-amber-200 dark:border-amber-700',   text: 'text-amber-700 dark:text-amber-300',     badge: 'bg-amber-400 text-white',  label: 'Knapp' },
  rot:     { bg: 'bg-red-50 dark:bg-red-900/20',         border: 'border-red-200 dark:border-red-700',       text: 'text-red-700 dark:text-red-300',         badge: 'bg-red-500 text-white',    label: 'Spät' },
  kritisch:{ bg: 'bg-red-100 dark:bg-red-900/40',        border: 'border-red-400 dark:border-red-600',       text: 'text-red-800 dark:text-red-200',         badge: 'bg-red-700 text-white',    label: 'Überfällig' },
};

function fmtTime(sec: number): string {
  if (sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function computeAmpel(pct: number, remainSec: number): Ampel {
  if (remainSec < 0) return 'kritisch';
  if (pct >= 90) return 'rot';
  if (pct >= 70) return 'gelb';
  return 'gruen';
}

export function KitchenPhase2856SmartTimingFarbkodierungLiveMaster({ orders }: Props) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const rows = useMemo((): Row[] => {
    const now = Date.now();
    const active = orders.filter(o =>
      ['bestätigt', 'confirmed', 'in_zubereitung', 'preparing', 'in_preparation'].includes(o.status),
    );
    return active.map(o => {
      const startMs = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
      const targetMin = o.prep_time_min ?? 15;
      const targetSec = targetMin * 60;
      const elapsedSec = Math.floor((now - startMs) / 1000);
      const remainSec = targetSec - elapsedSec;
      const pct = Math.min(100, Math.round((elapsedSec / Math.max(targetSec, 1)) * 100));
      return {
        id: o.id,
        nr: (o.bestellnummer ?? o.id).replace(/^[A-Z]+-/, '').slice(-4),
        elapsedSec,
        targetSec,
        remainSec,
        pct,
        ampel: computeAmpel(pct, remainSec),
        itemCount: (o.items ?? []).length,
      };
    }).sort((a, b) => b.pct - a.pct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tick]);

  const kritisch = rows.filter(r => r.ampel === 'kritisch').length;
  const rot = rows.filter(r => r.ampel === 'rot').length;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition border-b"
      >
        <Flame className="h-4 w-4 text-red-500 shrink-0" />
        <span className="font-display text-sm font-bold flex-1 text-left">Smart-Timing Farbkodierung Live</span>
        {kritisch > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full">
            <AlertTriangle className="h-3 w-3" />{kritisch} überfällig
          </span>
        )}
        {rot > 0 && kritisch === 0 && (
          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
            {rot} spät
          </span>
        )}
        <span className="text-[10px] text-muted-foreground tabular-nums ml-1">{rows.length} aktiv</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {rows.length === 0 ? (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-4 justify-center">
              <CheckCircle2 className="h-4 w-4 text-matcha-500" />
              Keine aktiven Bestellungen
            </div>
          ) : (
            rows.map(row => {
              const cfg = AMPEL_CONFIG[row.ampel];
              const isOverdue = row.ampel === 'kritisch';
              return (
                <div
                  key={row.id}
                  className={cn(
                    'rounded-lg border px-3 py-2 transition-all',
                    cfg.bg, cfg.border,
                    isOverdue && 'animate-pulse',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', cfg.badge)}>
                      #{row.nr}
                    </span>
                    <span className={cn('text-[10px] font-semibold', cfg.text)}>{cfg.label}</span>
                    <span className="ml-auto text-[9px] text-muted-foreground">
                      {row.itemCount} Pos.
                    </span>
                    <div className={cn(
                      'font-mono text-sm font-bold tabular-nums',
                      isOverdue ? 'text-red-600 dark:text-red-400' : cfg.text,
                    )}>
                      {isOverdue ? '+' : ''}{fmtTime(Math.abs(row.remainSec))}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        row.ampel === 'gruen' ? 'bg-matcha-500' :
                        row.ampel === 'gelb' ? 'bg-amber-400' : 'bg-red-500',
                      )}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
                    <span>{fmtTime(row.elapsedSec)} vergangen</span>
                    <span>Ziel {fmtTime(row.targetSec)}</span>
                  </div>
                </div>
              );
            })
          )}
          <div className="flex gap-2 pt-1 flex-wrap">
            {(['gruen', 'gelb', 'rot', 'kritisch'] as Ampel[]).map(a => {
              const count = rows.filter(r => r.ampel === a).length;
              const cfg = AMPEL_CONFIG[a];
              return (
                <div key={a} className={cn('flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border', cfg.bg, cfg.border, cfg.text)}>
                  <span className={cn('inline-block h-1.5 w-1.5 rounded-full', cfg.badge.split(' ')[0])} />
                  {cfg.label}: {count}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
