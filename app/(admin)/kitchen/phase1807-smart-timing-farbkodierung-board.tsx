'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock, Flame, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Phase 1807 — Smart-Timing Farbkodierung Board (Kitchen)
 *
 * Echtzeit-Farbkodierung aller aktiven Bestellungen nach Zubereitungszeit:
 * Grün (<10 Min), Amber (10–20 Min), Rot (>20 Min / überfällig).
 * Countdown je Bestellung. Props-basiert; 10s-Tick; Collapsible.
 */

interface Order {
  id: string;
  bestellnummer?: string;
  status?: string;
  bestellt_am?: string | null;
  created_at?: string | null;
  typ?: string;
  kunde_name?: string;
}

interface Props {
  orders: Order[];
  className?: string;
  zielMinuten?: number;
}

type Ampel = 'gruen' | 'amber' | 'rot';

function getAmpel(elapsedMin: number, ziel: number): Ampel {
  const ratio = elapsedMin / ziel;
  if (ratio < 0.6) return 'gruen';
  if (ratio < 1.0) return 'amber';
  return 'rot';
}

const AMPEL_STYLE: Record<Ampel, { bg: string; border: string; badge: string; label: string }> = {
  gruen: {
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    border: 'border-matcha-200 dark:border-matcha-800',
    badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/50 dark:text-matcha-300',
    label: 'Pünktlich',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    label: 'Eilt',
  },
  rot: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    label: 'Überfällig',
  },
};

function aktiveBestellungen(orders: Order[]): Order[] {
  const aktiv = new Set(['neu', 'angenommen', 'in_zubereitung', 'bereit', 'in_progress', 'accepted', 'preparing', 'ready']);
  return orders.filter(o => !o.status || aktiv.has(o.status));
}

export function KitchenPhase1807SmartTimingFarbkodierungBoard({ orders, className, zielMinuten = 20 }: Props) {
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const bestellungen = useMemo(() => {
    const aktiv = aktiveBestellungen(orders);
    return aktiv.map(o => {
      const raw = o.bestellt_am ?? o.created_at ?? null;
      const elapsedMin = raw ? (now - new Date(raw).getTime()) / 60_000 : 0;
      const ampel = getAmpel(elapsedMin, zielMinuten);
      const verbleibend = Math.max(0, zielMinuten - elapsedMin);
      return { ...o, elapsedMin, ampel, verbleibend };
    }).sort((a, b) => b.elapsedMin - a.elapsedMin);
  }, [orders, now, zielMinuten]);

  const zusammenfassung = useMemo(() => {
    const counts: Record<Ampel, number> = { gruen: 0, amber: 0, rot: 0 };
    for (const b of bestellungen) counts[b.ampel]++;
    return counts;
  }, [bestellungen]);

  if (bestellungen.length === 0) return null;

  return (
    <div className={cn('rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-4 w-4 shrink-0 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider truncate">
            Timing-Farbkodierung
          </span>
          <div className="flex items-center gap-1">
            {zusammenfassung.gruen > 0 && (
              <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300 px-1.5 py-0.5 text-[10px] font-bold">
                {zusammenfassung.gruen}✓
              </span>
            )}
            {zusammenfassung.amber > 0 && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-bold">
                {zusammenfassung.amber}⚡
              </span>
            )}
            {zusammenfassung.rot > 0 && (
              <span className="rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 text-[10px] font-bold">
                {zusammenfassung.rot}🔥
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-3 py-3 space-y-2">
          {/* Ampel-Übersicht */}
          <div className="grid grid-cols-3 gap-2 mb-1">
            {(['gruen', 'amber', 'rot'] as Ampel[]).map(a => {
              const s = AMPEL_STYLE[a];
              const count = zusammenfassung[a];
              return (
                <div key={a} className={cn('rounded-lg border p-2 text-center', s.bg, s.border)}>
                  <div className="text-[9px] text-muted-foreground mb-0.5">{s.label}</div>
                  <div className="text-xl font-black tabular-nums">{count}</div>
                </div>
              );
            })}
          </div>

          {/* Bestellungs-Liste */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {bestellungen.map(b => {
              const s = AMPEL_STYLE[b.ampel];
              const Icon = b.ampel === 'gruen' ? CheckCircle2 : b.ampel === 'amber' ? Flame : AlertTriangle;
              return (
                <div key={b.id} className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', s.bg, s.border)}>
                  <Icon className={cn('h-4 w-4 shrink-0', b.ampel === 'gruen' ? 'text-matcha-600' : b.ampel === 'amber' ? 'text-amber-500' : 'text-red-500')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold truncate">#{b.bestellnummer ?? b.id.slice(-4)}</span>
                      {b.kunde_name && (
                        <span className="text-[10px] text-muted-foreground truncate">{b.kunde_name}</span>
                      )}
                    </div>
                    {/* Fortschrittsbalken */}
                    <div className="mt-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-1000',
                          b.ampel === 'gruen' ? 'bg-matcha-500' : b.ampel === 'amber' ? 'bg-amber-400' : 'bg-red-500',
                        )}
                        style={{ width: `${Math.min(100, (b.elapsedMin / zielMinuten) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={cn('font-mono text-sm font-black tabular-nums',
                      b.ampel === 'gruen' ? 'text-matcha-700 dark:text-matcha-300' :
                      b.ampel === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300',
                    )}>
                      {b.ampel === 'rot' ? `+${(b.elapsedMin - zielMinuten).toFixed(0)}m` : `${b.verbleibend.toFixed(0)}m`}
                    </div>
                    <div className="text-[8px] text-muted-foreground">
                      {b.ampel === 'rot' ? 'überfällig' : 'verbleibend'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[10px] text-muted-foreground text-right">
            Ziel: {zielMinuten} Min · {bestellungen.length} aktiv
          </div>
        </div>
      )}
    </div>
  );
}
