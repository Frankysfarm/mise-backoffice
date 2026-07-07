'use client';

/**
 * Phase 599 — Kitchen: Station-Auslastungs-Ring
 *
 * SVG-Fortschrittsring je Küchen-Station mit % Auslastung.
 * Leitet Stationen aus den aktiven Bestellungen ab (Typ-basiert):
 *   Grill   — burger, grill, steak
 *   Friteuse — fries, pommes, nuggets
 *   Salat    — salat, bowl
 *   Getränke — drink, getraenk, saft
 *   Sonstiges — alles andere
 *
 * Zählt Bestellungen je Station, berechnet Auslastung relativ zur Kapazität (max 5 je Station).
 * Ticker: 3s
 */

import { useEffect, useState } from 'react';

interface OrderItem {
  name: string;
  quantity?: number;
}

interface Order {
  id: string;
  status: string;
  items?: OrderItem[];
}

interface Props {
  orders: Order[];
}

const ACTIVE = new Set(['bestätigt', 'in_zubereitung']);
const STATION_CAPACITY = 5; // max gleichzeitige Bestellungen je Station

interface Station {
  key: string;
  label: string;
  emoji: string;
  keywords: string[];
}

const STATIONS: Station[] = [
  { key: 'grill',     label: 'Grill',     emoji: '🥩', keywords: ['burger', 'grill', 'steak', 'pattie', 'hackfleisch'] },
  { key: 'friteuse',  label: 'Friteuse',  emoji: '🍟', keywords: ['fries', 'pommes', 'nugget', 'wings', 'fritier'] },
  { key: 'salat',     label: 'Salat',     emoji: '🥗', keywords: ['salat', 'bowl', 'wrap', 'caesar'] },
  { key: 'getraenke', label: 'Getränke',  emoji: '🥤', keywords: ['drink', 'getränk', 'saft', 'cola', 'limo', 'wasser', 'kaffee'] },
  { key: 'sonstiges', label: 'Sonstiges', emoji: '🍽️', keywords: [] },
];

function classifyOrder(order: Order): string {
  const text = (order.items ?? [])
    .map((i) => i.name.toLowerCase())
    .join(' ');

  for (const station of STATIONS.slice(0, -1)) {
    if (station.keywords.some((kw) => text.includes(kw))) return station.key;
  }
  return 'sonstiges';
}

function Ring({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6} className="stroke-muted" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" strokeWidth={6}
        stroke={color}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

function ringColor(pct: number): string {
  if (pct < 60) return '#22c55e';
  if (pct < 90) return '#f59e0b';
  return '#ef4444';
}

export function KitchenPhase599StationAuslastungsRing({ orders }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  void tick;

  const active = orders.filter((o) => ACTIVE.has(o.status));

  // Count per station
  const counts: Record<string, number> = {};
  for (const o of active) {
    const k = classifyOrder(o);
    counts[k] = (counts[k] ?? 0) + 1;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Stationen-Auslastung
      </div>
      <div className="grid grid-cols-5 gap-2">
        {STATIONS.map((station) => {
          const count = counts[station.key] ?? 0;
          const pct = Math.min(100, Math.round((count / STATION_CAPACITY) * 100));
          const color = ringColor(pct);
          return (
            <div key={station.key} className="flex flex-col items-center gap-1.5">
              <div className="relative flex items-center justify-center">
                <Ring pct={pct} color={color} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-base leading-none">{station.emoji}</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold tabular-nums" style={{ color }}>
                  {pct}%
                </div>
                <div className="text-[9px] text-muted-foreground leading-tight">{station.label}</div>
                <div className="text-[9px] text-muted-foreground">{count}/{STATION_CAPACITY}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
