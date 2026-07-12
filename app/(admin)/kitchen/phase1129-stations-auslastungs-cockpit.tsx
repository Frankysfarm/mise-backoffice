'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1129 — Stations-Auslastungs-Cockpit (Kitchen)
// Welche Kochstation ist gerade überlastet? Live-Balken + Umverteilungs-Empfehlung

interface Item { name?: string; title?: string; category?: string }
interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  items?: Item[] | null;
}
interface Props { orders: Order[] }

type Station = {
  name: string;
  emoji: string;
  keywords: string[];
};

const STATIONS: Station[] = [
  { name: 'Grill',    emoji: '🔥', keywords: ['burger', 'steak', 'grill', 'fleisch', 'chicken', 'hähnchen', 'würstchen'] },
  { name: 'Friteuse', emoji: '🍟', keywords: ['pommes', 'frites', 'frittiert', 'chicken strips', 'nuggets', 'onion'] },
  { name: 'Salat',    emoji: '🥗', keywords: ['salat', 'bowl', 'wrap', 'veggie', 'vegan'] },
  { name: 'Getränke', emoji: '🥤', keywords: ['cola', 'wasser', 'saft', 'shake', 'milch', 'bier', 'getränk', 'drink'] },
  { name: 'Dessert',  emoji: '🍰', keywords: ['dessert', 'kuchen', 'eis', 'waffel', 'brownie', 'torte'] },
];

const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'in_preparation', 'preparing', 'ready']);
const CAPACITY_PER_STATION = 8; // max items being processed

type StationLoad = {
  station: Station;
  load: number;
  pct: number;
  level: 'ok' | 'hoch' | 'überlastet';
  empfehlung: string | null;
};

function assignItems(orders: Order[]): StationLoad[] {
  const active = orders.filter(o => ACTIVE_STATUSES.has(o.status));
  const counts: Record<string, number> = {};
  for (const s of STATIONS) counts[s.name] = 0;

  for (const o of active) {
    for (const it of o.items ?? []) {
      const name = ((it.name ?? it.title ?? it.category ?? '') as string).toLowerCase();
      let matched = false;
      for (const s of STATIONS) {
        if (s.keywords.some(kw => name.includes(kw))) {
          counts[s.name] += 1;
          matched = true;
          break;
        }
      }
      if (!matched) counts['Grill'] += 1; // fallback
    }
  }

  const sorted = [...STATIONS].sort((a, b) => (counts[b.name] ?? 0) - (counts[a.name] ?? 0));

  return STATIONS.map(s => {
    const load = counts[s.name] ?? 0;
    const pct = Math.min(Math.round((load / CAPACITY_PER_STATION) * 100), 100);
    const level: StationLoad['level'] = pct >= 90 ? 'überlastet' : pct >= 65 ? 'hoch' : 'ok';
    let empfehlung: string | null = null;
    if (level === 'überlastet') {
      const underloaded = sorted.find(x => x.name !== s.name && (counts[x.name] ?? 0) < CAPACITY_PER_STATION * 0.5);
      empfehlung = underloaded ? `→ Umverteilen zu ${underloaded.name}` : '→ Zusätzliche Kraft einsetzen';
    } else if (level === 'hoch') {
      empfehlung = 'Beobachten — nahe Kapazität';
    }
    return { station: s, load, pct, level, empfehlung };
  });
}

const LEVEL_BAR: Record<StationLoad['level'], string> = {
  ok:           'bg-emerald-500',
  hoch:         'bg-amber-500',
  überlastet:   'bg-red-500',
};

const LEVEL_TEXT: Record<StationLoad['level'], string> = {
  ok:           'text-emerald-600 dark:text-emerald-400',
  hoch:         'text-amber-600 dark:text-amber-400',
  überlastet:   'text-red-600 dark:text-red-400',
};

export function KitchenPhase1129StationsAuslastungsCockpit({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const stations = useMemo(() => assignItems(orders), [orders]);
  const maxLevel = stations.some(s => s.level === 'überlastet') ? 'überlastet'
    : stations.some(s => s.level === 'hoch') ? 'hoch' : 'ok';

  const headerColor = {
    ok:         'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40',
    hoch:       'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40',
    überlastet: 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/40',
  }[maxLevel];

  const headerIcon = maxLevel === 'überlastet'
    ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
    : <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />;

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', headerColor)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {headerIcon}
          <span className={cn('font-bold text-sm', LEVEL_TEXT[maxLevel])}>
            Stations-Cockpit
          </span>
          {maxLevel === 'überlastet' && (
            <span className="rounded-full bg-red-500 text-white text-[10px] font-black px-2 py-0.5 animate-pulse">
              Überlastet!
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {stations.map(({ station, load, pct, level, empfehlung }) => (
            <div key={station.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <span>{station.emoji}</span> {station.name}
                </span>
                <span className={cn('text-xs font-semibold', LEVEL_TEXT[level])}>
                  {load} / {CAPACITY_PER_STATION} Artikel
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', LEVEL_BAR[level])}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {empfehlung && (
                <p className={cn('text-[11px] font-medium', LEVEL_TEXT[level])}>
                  {empfehlung}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
