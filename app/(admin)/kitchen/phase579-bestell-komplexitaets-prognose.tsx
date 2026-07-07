'use client';

/**
 * Phase 579 — Kitchen: Bestellungs-Komplexitäts-Prognose
 *
 * Live-Einschätzung der Küchenbelastung durch Artikel-Komplexität.
 * Kategorisiert aktive Bestellungen in einfach/mittel/komplex
 * und warnt wenn viele komplexe Bestellungen parallel laufen.
 *
 * Komplexitäts-Heuristik (Artikel-Anzahl je Bestellung):
 *   einfach  → 1–2 Positionen
 *   mittel   → 3–4 Positionen
 *   komplex  → 5+ Positionen
 *
 * Ticker: 30s
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronDown, ChevronUp, Layers, Zap } from 'lucide-react';

interface OrderItem {
  id: string;
  menge?: number;
}

interface Order {
  id: string;
  status: string;
  typ: string;
  created_at?: string;
  items?: OrderItem[] | null;
  positionen?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
}

type Complexity = 'einfach' | 'mittel' | 'komplex';

const COMPLEXITY_CFG: Record<Complexity, { label: string; color: string; bg: string; border: string; badge: string }> = {
  einfach: { label: 'Einfach',  color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', badge: 'bg-emerald-500 text-white'  },
  mittel:  { label: 'Mittel',   color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   badge: 'bg-amber-500 text-white'    },
  komplex: { label: 'Komplex',  color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     badge: 'bg-red-600 text-white'      },
};

const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'in_zubereitung', 'bereit']);

function getItemCount(order: Order): number {
  const src = order.items ?? order.positionen ?? [];
  return src.reduce((sum, it) => sum + (it.menge ?? 1), 0);
}

function classify(itemCount: number): Complexity {
  if (itemCount >= 5) return 'komplex';
  if (itemCount >= 3) return 'mittel';
  return 'einfach';
}

export function KitchenPhase579BestellKomplexitaetsPrognose({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const active = orders.filter(o =>
      ACTIVE_STATUSES.has(o.status) &&
      (o.typ === 'delivery' || o.typ === 'lieferung'),
    );

    const classified = active.map(o => ({
      id: o.id,
      itemCount: getItemCount(o),
      complexity: classify(getItemCount(o)),
    }));

    const counts: Record<Complexity, number> = { einfach: 0, mittel: 0, komplex: 0 };
    for (const c of classified) counts[c.complexity]++;

    const total = classified.length;
    const complexLoad = total > 0 ? Math.round((counts.komplex / total) * 100) : 0;
    const avgItems = total > 0
      ? Math.round((classified.reduce((s, c) => s + c.itemCount, 0) / total) * 10) / 10
      : 0;

    const alertLevel: 'ok' | 'warn' | 'critical' =
      counts.komplex >= 4 ? 'critical' :
      counts.komplex >= 2 ? 'warn'     : 'ok';

    return { counts, total, complexLoad, avgItems, alertLevel };
  }, [orders, tick]);

  const alertColor =
    stats.alertLevel === 'critical' ? 'text-red-700'    :
    stats.alertLevel === 'warn'     ? 'text-amber-700'  : 'text-emerald-700';

  const alertBg =
    stats.alertLevel === 'critical' ? 'bg-red-50 border-red-200'     :
    stats.alertLevel === 'warn'     ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200';

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Layers className={cn('h-4 w-4', alertColor)} />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Komplexitäts-Prognose</span>
          <Badge className={cn('text-[10px] px-2 py-0.5',
            stats.alertLevel === 'critical' ? 'bg-red-600 text-white' :
            stats.alertLevel === 'warn'     ? 'bg-amber-500 text-white' :
                                              'bg-emerald-500 text-white',
          )}>
            {stats.counts.komplex} komplex
          </Badge>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className={cn('border-t px-4 py-3 space-y-3', alertBg)}>
          {/* Summary row */}
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-lg border border-slate-200 bg-white/70 p-2 text-center">
              <div className="text-lg font-black tabular-nums text-slate-700">{stats.total}</div>
              <div className="text-[10px] text-muted-foreground">Aktiv</div>
            </div>
            {(['einfach', 'mittel', 'komplex'] as Complexity[]).map(c => {
              const cfg = COMPLEXITY_CFG[c];
              return (
                <div key={c} className={cn('rounded-lg border p-2 text-center', cfg.border, 'bg-white/70')}>
                  <div className={cn('text-lg font-black tabular-nums', cfg.color)}>{stats.counts[c]}</div>
                  <div className="text-[10px] text-muted-foreground">{cfg.label}</div>
                </div>
              );
            })}
          </div>

          {/* Load bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Komplex-Anteil</span>
              <span className={cn('text-xs font-bold tabular-nums', alertColor)}>{stats.complexLoad}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-black/10 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500',
                  stats.alertLevel === 'critical' ? 'bg-red-500' :
                  stats.alertLevel === 'warn'     ? 'bg-amber-400' : 'bg-emerald-500',
                )}
                style={{ width: `${Math.min(100, stats.complexLoad)}%` }}
              />
            </div>
          </div>

          {/* Avg items */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Ø Artikel/Bestellung</span>
            <span className="font-bold tabular-nums text-foreground">{stats.avgItems || '—'}</span>
          </div>

          {/* Alert */}
          {stats.alertLevel !== 'ok' && (
            <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2',
              stats.alertLevel === 'critical' ? 'bg-red-100 border-red-300' : 'bg-amber-100 border-amber-300',
            )}>
              {stats.alertLevel === 'critical'
                ? <Zap className="h-4 w-4 text-red-600 shrink-0" />
                : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
              <span className={cn('text-xs font-bold',
                stats.alertLevel === 'critical' ? 'text-red-700' : 'text-amber-700',
              )}>
                {stats.alertLevel === 'critical'
                  ? `${stats.counts.komplex} komplexe Bestellungen — alle Stationen priorisieren!`
                  : `${stats.counts.komplex} komplexe Bestellungen — erhöhte Aufmerksamkeit!`}
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
