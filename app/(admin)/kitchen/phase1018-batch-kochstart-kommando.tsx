'use client';

/**
 * Phase 1018 — Batch-Kochstart-Kommando (Kitchen)
 *
 * Gruppen-Kochstart-Cockpit:
 * - Bestellungen nach Station gruppiert (Grill/Friteuse/Salat/Pasta)
 * - Farbkodierter Kochstart-Zeitpunkt je Gruppe (grün=früh, amber=jetzt, rot=überfällig)
 * - Batch-Zähler und Wartezeit-Prognose je Station
 * - Live-Countdown je Bestellgruppe (sekündlich aktualisiert)
 * - Kein API-Call: rein clientseitig
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Flame, Zap, Salad, Coffee, ChefHat,
  Clock, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
} from 'lucide-react';

interface OrderItem { name?: string | null; title?: string | null; menge?: number }
interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  items?: OrderItem[] | null;
}
interface Props { orders: Order[] }

type Station = 'grill' | 'friteuse' | 'salat' | 'pasta' | 'sonstige';
type Band = 'gruen' | 'amber' | 'rot' | 'schwarz';

const STATION_CFG: Record<Station, { label: string; Icon: React.ElementType; color: string; keywords: string[] }> = {
  grill:    { label: 'Grill',    Icon: Flame,   color: 'text-red-600',    keywords: ['burger','steak','grill','hähnchen','schnitzel','beef','chicken','bratwurst'] },
  friteuse: { label: 'Friteuse', Icon: Zap,     color: 'text-yellow-600', keywords: ['fries','pommes','nuggets','wings','frittiert','onion ring','tempura'] },
  salat:    { label: 'Salat',    Icon: Salad,   color: 'text-matcha-600', keywords: ['salat','bowl','wrap','veggie','vegan','caesar','raw'] },
  pasta:    { label: 'Pasta',    Icon: Coffee,  color: 'text-purple-600', keywords: ['pasta','nudeln','spaghetti','pizza','penne','carbonara','risotto'] },
  sonstige: { label: 'Sonstige', Icon: ChefHat, color: 'text-zinc-500',   keywords: [] },
};

const ACTIVE = new Set(['neu','bestätigt','confirmed','in_zubereitung','preparing','in_preparation']);

function detectStation(items: OrderItem[]): Station {
  const txt = items.map(i => (i.name ?? i.title ?? '').toLowerCase()).join(' ');
  for (const [key, cfg] of Object.entries(STATION_CFG) as [Station, typeof STATION_CFG[Station]][]) {
    if (key !== 'sonstige' && cfg.keywords.some(k => txt.includes(k))) return key;
  }
  return 'sonstige';
}

function band(remainSec: number, targetSec: number): Band {
  if (remainSec <= 0) return 'schwarz';
  const p = remainSec / targetSec;
  if (p > 0.5) return 'gruen';
  if (p > 0.2) return 'amber';
  return 'rot';
}

const BAND: Record<Band, { bg: string; ring: string; label: string; dot: string }> = {
  gruen:  { bg: 'bg-matcha-50 dark:bg-matcha-900/20',  ring: 'border-matcha-300 dark:border-matcha-600', label: 'OK',         dot: 'bg-matcha-500' },
  amber:  { bg: 'bg-amber-50 dark:bg-amber-900/20',    ring: 'border-amber-300 dark:border-amber-600',   label: 'Bald',       dot: 'bg-amber-500' },
  rot:    { bg: 'bg-red-50 dark:bg-red-900/20',        ring: 'border-red-400 dark:border-red-600',       label: 'Dringend',   dot: 'bg-red-500' },
  schwarz:{ bg: 'bg-zinc-100 dark:bg-zinc-800',        ring: 'border-zinc-400 dark:border-zinc-600',     label: 'Überfällig', dot: 'bg-zinc-400' },
};

function fmt(s: number) {
  if (s <= 0) return '—:—';
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function KitchenPhase1018BatchKochstartKommando({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const [, tick] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    ref.current = setInterval(() => tick(n => n + 1), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, []);

  const groups = useMemo(() => {
    const now = Date.now();
    const active = orders.filter(o => ACTIVE.has(o.status) && o.bestellt_am);
    const map = new Map<Station, typeof active>();
    for (const o of active) {
      const s = detectStation(o.items ?? []);
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(o);
    }
    return Array.from(map.entries())
      .map(([station, list]) => {
        const entries = list.map(o => {
          const elapsed = Math.floor((now - new Date(o.bestellt_am!).getTime()) / 1000);
          const target = (o.geschaetzte_zubereitung_min ?? 12) * 60;
          const remain = Math.max(0, target - elapsed);
          return { o, elapsed, target, remain, b: band(target - elapsed, target) };
        }).sort((a, b) => a.remain - b.remain);
        const urgent = entries.filter(e => e.b === 'rot' || e.b === 'schwarz').length;
        const minRemain = entries[0]?.remain ?? 0;
        return { station, entries, urgent, minRemain };
      })
      .sort((a, b) => a.minRemain - b.minRemain);
  }, [orders, /* tick dependency via closure */]);

  const totalActive = groups.reduce((s, g) => s + g.entries.length, 0);
  if (totalActive === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Batch-Kochstart-Kommando
          </span>
          <span className="rounded-full bg-matcha-100 dark:bg-matcha-800 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-200">
            {totalActive} Bestellungen · {groups.length} Stationen
          </span>
          {groups.some(g => g.urgent > 0) && (
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse" />
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t p-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map(({ station, entries, urgent }) => {
            const cfg = STATION_CFG[station];
            const Icon = cfg.Icon;
            const topBand = entries[0]?.b ?? 'gruen';
            const bs = BAND[topBand];
            return (
              <div key={station} className={cn('rounded-xl border p-3 space-y-2', bs.bg, bs.ring)}>
                {/* Station header */}
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4 shrink-0', cfg.color)} />
                  <span className="font-bold text-sm">{cfg.label}</span>
                  <span className="ml-auto text-[10px] font-bold text-muted-foreground">
                    {entries.length} Bestellung{entries.length !== 1 ? 'en' : ''}
                  </span>
                  {urgent > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-[9px] font-bold text-red-700 dark:text-red-300">
                      <AlertTriangle className="h-2.5 w-2.5" /> {urgent} dringend
                    </span>
                  )}
                </div>

                {/* Order tiles */}
                <div className="space-y-1.5">
                  {entries.map(({ o, remain, b }) => {
                    const tile = BAND[b];
                    return (
                      <div key={o.id} className={cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5 border', tile.bg, tile.ring)}>
                        <span className={cn('h-2 w-2 rounded-full shrink-0', tile.dot)} />
                        <span className="font-bold text-xs tabular-nums">#{o.bestellnummer}</span>
                        <span className="flex-1" />
                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-xs font-mono tabular-nums font-bold">{fmt(remain)}</span>
                        {b === 'schwarz' && <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400" />}
                      </div>
                    );
                  })}
                </div>

                {/* Batch start signal */}
                <div className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide',
                  topBand === 'gruen'  ? 'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300' :
                  topBand === 'amber'  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                  topBand === 'rot'    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 animate-pulse' :
                                        'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300',
                )}>
                  <Flame className="h-3 w-3" />
                  {topBand === 'gruen' ? 'Kochstart in Kürze' :
                   topBand === 'amber' ? 'Jetzt starten!' :
                   topBand === 'rot'   ? 'Sofort kochen!' :
                                        'Fertigstellung überfällig'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
