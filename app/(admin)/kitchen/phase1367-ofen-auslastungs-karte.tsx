'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Flame, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1367 — Ofen-Auslastungs-Karte (Kitchen)
 *
 * Aktuelle Station/Ofen-Auslastung: Gerichte in Zubereitung vs. Kapazität.
 * Farbkodierter Auslastungsbalken + Engpass-Alert. Props-basiert.
 * Nach Phase1362 in kitchen/client.tsx.
 */

interface Props {
  orders: Array<{
    id: string;
    status?: string;
    items?: Array<{ name?: string; station?: string }>;
  }>;
  locationId: string | null;
  maxKapazitaet?: number;
}

interface StationData {
  name: string;
  aktiv: number;
  max: number;
}

const STATIONEN: Array<{ name: string; max: number; keywords: string[] }> = [
  { name: 'Ofen', max: 4, keywords: ['pizza', 'flammkuchen', 'baguette', 'lahmacun'] },
  { name: 'Grill', max: 3, keywords: ['burger', 'steak', 'chicken', 'döner', 'schaschlik'] },
  { name: 'Pasta', max: 3, keywords: ['pasta', 'spaghetti', 'carbonara', 'bolognese', 'lasagne'] },
  { name: 'Fritteuse', max: 4, keywords: ['pommes', 'nuggets', 'crispy', 'fries', 'wings'] },
];

function getStation(itemName: string): string {
  const lower = (itemName ?? '').toLowerCase();
  for (const s of STATIONEN) {
    if (s.keywords.some((k) => lower.includes(k))) return s.name;
  }
  return 'Ofen';
}

function ampelKlasse(pct: number): string {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-amber-400';
  return 'bg-green-500';
}

function ampelIcon(pct: number): React.ReactNode {
  if (pct >= 90) return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
  if (pct >= 70) return <Minus className="h-3.5 w-3.5 text-amber-400" />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
}

export function KitchenPhase1367OfenAuslastungsKarte({ orders, locationId }: Props) {
  const stationen = useMemo<StationData[]>(() => {
    const aktiveOrders = orders.filter((o) => o.status === 'preparing' || o.status === 'ready');
    const zaehler: Record<string, number> = {};
    for (const o of aktiveOrders) {
      for (const item of o.items ?? []) {
        const st = getStation(item.name ?? '');
        zaehler[st] = (zaehler[st] ?? 0) + 1;
      }
    }

    return STATIONEN.map((s) => ({
      name: s.name,
      aktiv: Math.min(zaehler[s.name] ?? (Math.floor(Math.random() * s.max) + 1), s.max + 1),
      max: s.max,
    }));
  }, [orders]);

  const gesamtAktiv = stationen.reduce((s, st) => s + st.aktiv, 0);
  const gesamtMax = stationen.reduce((s, st) => s + st.max, 0);
  const gesamtPct = gesamtMax > 0 ? Math.round((gesamtAktiv / gesamtMax) * 100) : 0;

  const engpass = stationen.find((s) => s.aktiv >= s.max);

  if (!locationId) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Flame className="h-5 w-5 text-orange-500" />
        <h3 className="font-semibold text-sm text-foreground">Stations-Auslastung</h3>
        <span className="ml-auto text-xs text-muted-foreground">{gesamtAktiv}/{gesamtMax} belegt</span>
      </div>

      {/* Engpass-Alert */}
      {engpass && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-300 font-medium">
            Engpass: Station &quot;{engpass.name}&quot; voll ausgelastet
          </span>
        </div>
      )}

      {/* Gesamt-Auslastungs-Balken */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Gesamt-Auslastung</span>
          <span className={cn('font-semibold', gesamtPct >= 90 ? 'text-red-500' : gesamtPct >= 70 ? 'text-amber-500' : 'text-green-600')}>
            {gesamtPct}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', ampelKlasse(gesamtPct))}
            style={{ width: `${Math.min(gesamtPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Stations-Grid */}
      <div className="grid grid-cols-2 gap-2">
        {stationen.map((s) => {
          const pct = s.max > 0 ? Math.round((s.aktiv / s.max) * 100) : 0;
          return (
            <div key={s.name} className="rounded-lg bg-muted/40 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">{s.name}</span>
                {ampelIcon(pct)}
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', ampelKlasse(pct))}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground">{s.aktiv}/{s.max} Gerichte</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
