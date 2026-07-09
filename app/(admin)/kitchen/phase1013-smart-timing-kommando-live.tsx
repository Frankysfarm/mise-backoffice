'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Flame, AlertTriangle, ChevronDown, ChevronUp, CheckCircle2, Zap } from 'lucide-react';

/**
 * Phase 1013 — Smart-Timing-Kommando-Live (Kitchen)
 *
 * Konsolidiertes Echtzeit-Timing-Cockpit:
 * - Alle aktiven Bestellungen als farbkodierte Kacheln (Grün/Amber/Rot/Schwarz)
 * - Live-Countdown in Sekunden je Bestellung
 * - Urgency-Score und Gruppen-Priorisierung
 * - Kochstation-Zuordnung (Grill/Friteuse/Salat/Pasta/Sonstige)
 * - Kein API-Call: rein clientseitig auf Basis der Order-Props
 */

interface OrderItem {
  name?: string | null;
  title?: string | null;
  menge?: number;
}

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  items?: OrderItem[] | null;
  typ?: string;
}

interface Props {
  orders: Order[];
}

type ColorBand = 'gruen' | 'amber' | 'rot' | 'schwarz';

interface OrderTile {
  id: string;
  bestellnummer: string;
  elapsedSec: number;
  targetSec: number;
  remainSec: number;
  band: ColorBand;
  urgency: number;
  station: string;
  stationEmoji: string;
  itemCount: number;
}

const STATION_MAP: { label: string; emoji: string; keywords: string[] }[] = [
  { label: 'Grill',    emoji: '🥩', keywords: ['burger', 'steak', 'grill', 'hähnchen', 'schnitzel', 'bratwurst', 'beef', 'chicken'] },
  { label: 'Friteuse', emoji: '🍟', keywords: ['fries', 'pommes', 'nuggets', 'wings', 'onion', 'frittiert'] },
  { label: 'Salat',    emoji: '🥗', keywords: ['salat', 'wrap', 'bowl', 'veggie', 'vegan', 'caesar'] },
  { label: 'Pasta',    emoji: '🍝', keywords: ['pasta', 'nudeln', 'spaghetti', 'pizza', 'penne', 'carbonara'] },
  { label: 'Suppe',    emoji: '🍲', keywords: ['suppe', 'eintopf', 'curry', 'ramen', 'pho', 'brühe'] },
];

function detectStation(items: OrderItem[]): { label: string; emoji: string } {
  const text = items.map(i => (i.name ?? i.title ?? '').toLowerCase()).join(' ');
  for (const s of STATION_MAP) {
    if (s.keywords.some(k => text.includes(k))) return s;
  }
  return { label: 'Sonstige', emoji: '🍽️' };
}

function colorBand(remainSec: number, targetSec: number): ColorBand {
  if (remainSec <= 0) return 'schwarz';
  const pct = remainSec / targetSec;
  if (pct > 0.5) return 'gruen';
  if (pct > 0.2) return 'amber';
  return 'rot';
}

const BAND_STYLE: Record<ColorBand, { bg: string; ring: string; text: string; badge: string; badgeText: string }> = {
  gruen:  { bg: 'bg-matcha-50 dark:bg-matcha-900/20',   ring: 'border-matcha-300 dark:border-matcha-600', text: 'text-matcha-700 dark:text-matcha-300',   badge: 'bg-matcha-100 dark:bg-matcha-800',  badgeText: 'text-matcha-700 dark:text-matcha-300' },
  amber:  { bg: 'bg-amber-50 dark:bg-amber-900/20',     ring: 'border-amber-300 dark:border-amber-600',   text: 'text-amber-700 dark:text-amber-300',     badge: 'bg-amber-100 dark:bg-amber-800',    badgeText: 'text-amber-700 dark:text-amber-300' },
  rot:    { bg: 'bg-red-50 dark:bg-red-900/20',         ring: 'border-red-400 dark:border-red-600',       text: 'text-red-700 dark:text-red-300',         badge: 'bg-red-100 dark:bg-red-800',        badgeText: 'text-red-700 dark:text-red-300' },
  schwarz:{ bg: 'bg-zinc-100 dark:bg-zinc-800',         ring: 'border-zinc-400 dark:border-zinc-600',     text: 'text-zinc-700 dark:text-zinc-300',       badge: 'bg-zinc-200 dark:bg-zinc-700',      badgeText: 'text-zinc-600 dark:text-zinc-300' },
};

function fmtSec(s: number): string {
  if (s <= 0) return '00:00';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'confirmed', 'in_zubereitung', 'preparing', 'in_preparation']);

export function KitchenPhase1013SmartTimingKommandoLive({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const tiles = useMemo<OrderTile[]>(() => {
    const now = Date.now();
    return orders
      .filter(o => ACTIVE_STATUSES.has(o.status))
      .map(o => {
        const bestelltMs = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
        const elapsedSec = Math.floor((now - bestelltMs) / 1000);
        const targetSec = (o.geschaetzte_zubereitung_min ?? 20) * 60;
        const remainSec = Math.max(0, targetSec - elapsedSec);
        const band = colorBand(remainSec, targetSec);
        const urgency = band === 'schwarz' ? 4 : band === 'rot' ? 3 : band === 'amber' ? 2 : 1;
        const station = detectStation(o.items ?? []);
        return {
          id: o.id,
          bestellnummer: o.bestellnummer,
          elapsedSec,
          targetSec,
          remainSec,
          band,
          urgency,
          station: station.label,
          stationEmoji: station.emoji,
          itemCount: (o.items ?? []).reduce((s, i) => s + (i.menge ?? 1), 0),
        };
      })
      .sort((a, b) => b.urgency - a.urgency || a.remainSec - b.remainSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tick]);

  const counts = useMemo(() => ({
    schwarz: tiles.filter(t => t.band === 'schwarz').length,
    rot:     tiles.filter(t => t.band === 'rot').length,
    amber:   tiles.filter(t => t.band === 'amber').length,
    gruen:   tiles.filter(t => t.band === 'gruen').length,
  }), [tiles]);

  if (tiles.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />
          <span className="text-sm font-bold">Smart-Timing-Kommando Live</span>
          <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 font-mono tabular-nums text-muted-foreground">
            {tiles.length} aktiv
          </span>
          {counts.schwarz > 0 && (
            <span className="text-[10px] rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 font-bold text-zinc-700 dark:text-zinc-300">
              {counts.schwarz}× überfällig
            </span>
          )}
          {counts.rot > 0 && (
            <span className="text-[10px] rounded-full bg-red-100 dark:bg-red-900 px-2 py-0.5 font-bold text-red-700 dark:text-red-300 flex items-center gap-1">
              <AlertTriangle className="h-2.5 w-2.5" /> {counts.rot}× kritisch
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Ampel-Leiste */}
          <div className="hidden sm:flex items-center gap-1">
            {(['gruen', 'amber', 'rot', 'schwarz'] as ColorBand[]).map(b => (
              counts[b] > 0 && (
                <span key={b} className={cn(
                  'text-[9px] font-black rounded-full px-1.5 py-0.5 tabular-nums',
                  BAND_STYLE[b].badge, BAND_STYLE[b].badgeText,
                )}>
                  {counts[b]}
                </span>
              )
            ))}
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {/* Legende */}
          <div className="flex flex-wrap gap-2 text-[9px] font-bold py-1">
            {(['gruen', 'amber', 'rot', 'schwarz'] as ColorBand[]).map(b => {
              const label = b === 'gruen' ? 'Grün >50%' : b === 'amber' ? 'Amber 20–50%' : b === 'rot' ? 'Rot <20%' : 'Überfällig';
              return (
                <span key={b} className={cn('rounded-full px-2 py-0.5', BAND_STYLE[b].badge, BAND_STYLE[b].badgeText)}>
                  {label}
                </span>
              );
            })}
          </div>

          {/* Kacheln */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {tiles.map(tile => {
              const style = BAND_STYLE[tile.band];
              const pct = tile.targetSec > 0 ? Math.min(100, (tile.remainSec / tile.targetSec) * 100) : 0;
              return (
                <div
                  key={tile.id}
                  className={cn('rounded-xl border-2 p-3 flex flex-col gap-1.5 transition-all', style.bg, style.ring)}
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black tracking-wide text-muted-foreground">
                      #{tile.bestellnummer}
                    </span>
                    <span className="text-base">{tile.stationEmoji}</span>
                  </div>

                  {/* Countdown */}
                  <div className={cn('font-mono text-2xl font-black tabular-nums leading-none', style.text)}>
                    {tile.band === 'schwarz' ? (
                      <span className="flex items-center gap-1">
                        <Flame className="h-5 w-5" /> ÜBER
                      </span>
                    ) : (
                      fmtSec(tile.remainSec)
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-1000',
                        tile.band === 'gruen' ? 'bg-matcha-500' : tile.band === 'amber' ? 'bg-amber-500' : tile.band === 'rot' ? 'bg-red-500' : 'bg-zinc-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Station + items */}
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                    <span>{tile.station}</span>
                    <span>{tile.itemCount} Artikel</span>
                  </div>

                  {/* Elapsed */}
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    {Math.floor(tile.elapsedSec / 60)} Min vergangen
                  </div>
                </div>
              );
            })}
          </div>

          {/* Station-Zusammenfassung */}
          <div className="mt-2 flex flex-wrap gap-2">
            {STATION_MAP.map(s => {
              const n = tiles.filter(t => t.station === s.label).length;
              if (n === 0) return null;
              return (
                <span key={s.label} className="text-[10px] font-bold rounded-lg border bg-muted px-2 py-1">
                  {s.emoji} {s.label}: {n}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
