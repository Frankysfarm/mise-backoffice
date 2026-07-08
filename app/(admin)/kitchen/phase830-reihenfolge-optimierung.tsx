'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Clock, MapPin, Users, ArrowUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  status?: string | null;
  created_at?: string | null;
  delivery_zone?: string | null;
  bestellnummer?: string | null;
  kunde_name?: string | null;
  eta_minutes?: number | null;
  prep_minutes?: number | null;
}

interface Props {
  orders: Order[];
  locationId: string | null;
}

interface ScoredOrder {
  id: string;
  bestellnummer: string;
  zone: string;
  score: number;
  alter_min: number;
  eta_min: number;
  grund: string;
  prioritaet: 'kritisch' | 'hoch' | 'normal';
}

function scoreOrder(o: Order, availableDrivers: number): ScoredOrder {
  const now = Date.now();
  const alter_ms = o.created_at ? now - new Date(o.created_at).getTime() : 0;
  const alter_min = Math.round(alter_ms / 60_000);
  const eta_min = o.eta_minutes ?? o.prep_minutes ?? 20;
  const zone = (o.delivery_zone ?? 'A').toUpperCase();

  // Score: 0–100, höher = dringlicher
  let score = 0;
  // Alter-Gewichtung: max 40 Punkte (>30 Min = voll)
  score += Math.min(40, (alter_min / 30) * 40);
  // ETA-Gewichtung: kürzere ETA = dringlicher, max 30 Punkte
  score += Math.max(0, 30 - eta_min);
  // Zone-Distanz: A=0, B=5, C=10, D=15 — weiter = dringlicher früher starten
  const zoneBonus: Record<string, number> = { A: 0, B: 5, C: 10, D: 15 };
  score += zoneBonus[zone] ?? 0;
  // Fahrer-Knappheit: je weniger Fahrer, desto kritischer
  score += Math.max(0, 15 - availableDrivers * 3);

  score = Math.min(100, Math.round(score));

  const prioritaet: ScoredOrder['prioritaet'] =
    score >= 70 ? 'kritisch' :
    score >= 45 ? 'hoch' : 'normal';

  const gründe: string[] = [];
  if (alter_min >= 20) gründe.push(`${alter_min} Min gewartet`);
  if (zone === 'C' || zone === 'D') gründe.push(`Zone ${zone} — früh starten`);
  if (availableDrivers <= 1) gründe.push('Fahrermangel');
  if (eta_min <= 10) gründe.push('kurze ETA');

  return {
    id: o.id,
    bestellnummer: o.bestellnummer ?? o.id.slice(0, 6),
    zone,
    score,
    alter_min,
    eta_min,
    grund: gründe.join(', ') || 'Standard-Reihenfolge',
    prioritaet,
  };
}

const PRIO_COLORS = {
  kritisch: 'bg-red-100 border-red-300 text-red-700 dark:bg-red-950 dark:border-red-700 dark:text-red-300',
  hoch:     'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-300',
  normal:   'bg-matcha-50 border-matcha-200 text-matcha-700 dark:bg-matcha-950 dark:border-matcha-700 dark:text-matcha-300',
};

const PRIO_DOT = {
  kritisch: 'bg-red-500',
  hoch:     'bg-amber-500',
  normal:   'bg-matcha-500',
};

export function KitchenPhase830ReihenfolgeOptimierung({ orders, locationId }: Props) {
  const [drivers, setDrivers] = useState<number>(2);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/fahrer-verfuegbarkeit-prognose?location_id=${locationId}`)
      .then(r => r.json())
      .then(d => {
        if (typeof d.verfuegbar === 'number') setDrivers(d.verfuegbar);
        else if (d.freiefahrer) setDrivers(d.freiefahrer);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  const activeOrders = orders.filter(
    o => o.status && !['delivered', 'cancelled', 'storniert', 'geliefert'].includes(o.status)
  );

  if (activeOrders.length === 0) return null;

  const sorted = activeOrders
    .map(o => scoreOrder(o, drivers))
    .sort((a, b) => b.score - a.score);

  const kritischCount = sorted.filter(o => o.prioritaet === 'kritisch').length;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold">KI-Reihenfolge-Optimierung</span>
          {kritischCount > 0 && (
            <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
              {kritischCount} kritisch
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t divide-y">
          {/* Kontext-Info */}
          <div className="px-4 py-2 flex items-center gap-4 bg-muted/30 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {drivers} Fahrer verfügbar
            </span>
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3" />
              Score-Sortierung
            </span>
          </div>

          {sorted.slice(0, 8).map((o, idx) => (
            <div
              key={o.id}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5',
                idx === 0 && 'bg-red-50/50 dark:bg-red-950/20'
              )}
            >
              {/* Rang */}
              <span className="w-5 shrink-0 text-xs font-bold text-muted-foreground tabular-nums">
                #{idx + 1}
              </span>

              {/* Prioritäts-Dot */}
              <span className={cn('h-2 w-2 rounded-full shrink-0', PRIO_DOT[o.prioritaet])} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums">#{o.bestellnummer}</span>
                  <span className={cn(
                    'rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-none',
                    PRIO_COLORS[o.prioritaet]
                  )}>
                    {o.prioritaet}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5" />
                    Zone {o.zone}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {o.alter_min} Min alt
                  </span>
                  {o.grund && (
                    <span className="truncate opacity-75">{o.grund}</span>
                  )}
                </div>
              </div>

              {/* Score */}
              <div className="shrink-0 text-right">
                <div className={cn(
                  'text-sm font-black tabular-nums',
                  o.score >= 70 ? 'text-red-600 dark:text-red-400' :
                  o.score >= 45 ? 'text-amber-600 dark:text-amber-400' :
                  'text-matcha-600 dark:text-matcha-400'
                )}>
                  {o.score}
                </div>
                <div className="text-[9px] text-muted-foreground">Score</div>
              </div>
            </div>
          ))}

          {sorted.length > 8 && (
            <div className="px-4 py-2 text-[11px] text-muted-foreground text-center">
              +{sorted.length - 8} weitere Bestellungen
            </div>
          )}
        </div>
      )}
    </div>
  );
}
