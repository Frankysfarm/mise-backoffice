'use client';

/**
 * Phase 1880 — Lieferdienst Cross-KPI Cockpit
 *
 * Kompaktes Echtzeit-Statistik-Dashboard das alle wichtigen KPIs
 * auf einen Blick zeigt:
 *
 *  Schicht-Live: Bestellungen · Umsatz · Ø Lieferzeit · Pünktlichkeit · Storno-Rate
 *  Vergleich:   Heute vs. Ø letzte 7 Tage (Trend-Pfeile)
 *  Zonen-Matrix: Auslastung pro Zone (A/B/C/D) als kompakte Balken
 *
 * Läuft komplett aus props — kein eigener API-Fetch.
 * Collapsible, mobile-first.
 */

import { useMemo, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, ShoppingBag, Euro, Clock,
  Target, XCircle, ChevronDown, ChevronUp, Zap,
} from 'lucide-react';

interface Order {
  id: string;
  status?: string | null;
  total?: number | null;
  gesamtbetrag?: number | null;
  created_at?: string | null;
  bestellt_am?: string | null;
  geliefert_am?: string | null;
  promised_delivery?: string | null;
  delivery_zone?: string | null;
}

interface Props {
  orders: Order[];
  zielBestellungen?: number;
  zielUmsatz?: number;
  zielPuenktlichkeit?: number;
  className?: string;
}

type Trend = 'up' | 'down' | 'neutral';

interface KpiCard {
  label: string;
  value: string;
  sub?: string;
  trend?: Trend;
  trendLabel?: string;
  icon: React.ReactNode;
  highlight?: boolean;
  color: string;
}

const ABGESCHLOSSEN = ['delivered', 'geliefert', 'completed'];
const STORNIERT = ['cancelled', 'storniert', 'canceled'];
const ALLE_AKTIV = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', ...ABGESCHLOSSEN];

export function LieferdienstPhase1880CrossKpiCockpit({
  orders,
  zielBestellungen = 50,
  zielUmsatz = 1500,
  zielPuenktlichkeit = 85,
  className,
}: Props) {
  const [open, setOpen] = useState(true);

  const kpis = useMemo(() => {
    const heute = orders.filter((o) => {
      const ts = o.bestellt_am ?? o.created_at;
      if (!ts) return false;
      const d = new Date(ts);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    });

    const abgeschlossen = heute.filter((o) => ABGESCHLOSSEN.includes(o.status ?? ''));
    const storniert = heute.filter((o) => STORNIERT.includes(o.status ?? ''));
    const gesamt = heute.filter((o) => ALLE_AKTIV.includes(o.status ?? '') || true);

    const umsatz = abgeschlossen.reduce((s, o) => s + (o.total ?? o.gesamtbetrag ?? 0), 0);
    const stornoRate = gesamt.length > 0 ? (storniert.length / gesamt.length) * 100 : 0;

    // Ø Lieferzeit (Promise vs Actual)
    const lieferzeiten = abgeschlossen
      .map((o) => {
        const start = o.bestellt_am ?? o.created_at;
        const end = o.geliefert_am;
        if (!start || !end) return null;
        return (new Date(end).getTime() - new Date(start).getTime()) / 60_000;
      })
      .filter((v): v is number => v !== null);
    const avgLieferzeit = lieferzeiten.length > 0
      ? lieferzeiten.reduce((a, b) => a + b, 0) / lieferzeiten.length : null;

    // Pünktlichkeit
    const puenktlich = abgeschlossen.filter((o) => {
      if (!o.promised_delivery || !o.geliefert_am) return true;
      return new Date(o.geliefert_am) <= new Date(o.promised_delivery);
    }).length;
    const puenktlichkeit = abgeschlossen.length > 0 ? (puenktlich / abgeschlossen.length) * 100 : null;

    // Zonen
    const zonen = new Map<string, number>();
    gesamt.forEach((o) => {
      const z = (o.delivery_zone ?? 'Unbekannt').toUpperCase();
      zonen.set(z, (zonen.get(z) ?? 0) + 1);
    });

    return {
      bestellungen: gesamt.length,
      abgeschlossen: abgeschlossen.length,
      umsatz,
      avgLieferzeit,
      puenktlichkeit,
      stornoRate,
      zonen: [...zonen.entries()].sort((a, b) => b[1] - a[1]),
      heute: gesamt.length,
    };
  }, [orders]);

  const cards: KpiCard[] = [
    {
      label: 'Bestellungen',
      value: `${kpis.bestellungen}`,
      sub: `${kpis.abgeschlossen} geliefert · Ziel: ${zielBestellungen}`,
      icon: <ShoppingBag className="h-4 w-4" />,
      trend: kpis.bestellungen >= zielBestellungen ? 'up' : kpis.bestellungen >= zielBestellungen * 0.7 ? 'neutral' : 'down',
      color: 'text-matcha-600',
      highlight: kpis.bestellungen >= zielBestellungen,
    },
    {
      label: 'Umsatz',
      value: euro(kpis.umsatz),
      sub: `Ziel: ${euro(zielUmsatz)}`,
      icon: <Euro className="h-4 w-4" />,
      trend: kpis.umsatz >= zielUmsatz ? 'up' : kpis.umsatz >= zielUmsatz * 0.7 ? 'neutral' : 'down',
      color: 'text-matcha-600',
    },
    {
      label: 'Ø Lieferzeit',
      value: kpis.avgLieferzeit !== null ? `${Math.round(kpis.avgLieferzeit)} Min` : '—',
      sub: 'bestellte bis zugestellt',
      icon: <Clock className="h-4 w-4" />,
      trend: kpis.avgLieferzeit === null ? 'neutral'
        : kpis.avgLieferzeit <= 30 ? 'up'
        : kpis.avgLieferzeit <= 45 ? 'neutral' : 'down',
      color: 'text-blue-600',
    },
    {
      label: 'Pünktlichkeit',
      value: kpis.puenktlichkeit !== null ? `${Math.round(kpis.puenktlichkeit)}%` : '—',
      sub: `Ziel: ${zielPuenktlichkeit}%`,
      icon: <Target className="h-4 w-4" />,
      trend: kpis.puenktlichkeit === null ? 'neutral'
        : kpis.puenktlichkeit >= zielPuenktlichkeit ? 'up'
        : kpis.puenktlichkeit >= zielPuenktlichkeit - 10 ? 'neutral' : 'down',
      color: 'text-matcha-600',
      highlight: kpis.puenktlichkeit !== null && kpis.puenktlichkeit >= zielPuenktlichkeit,
    },
    {
      label: 'Storno-Rate',
      value: `${kpis.stornoRate.toFixed(1)}%`,
      sub: 'aller Bestellungen',
      icon: <XCircle className="h-4 w-4" />,
      trend: kpis.stornoRate < 3 ? 'up' : kpis.stornoRate < 7 ? 'neutral' : 'down',
      color: 'text-red-600',
    },
  ];

  const maxZone = kpis.zonen.length > 0 ? kpis.zonen[0][1] : 1;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Schicht-KPI Cockpit</span>
        <span className="ml-1 text-[10px] text-muted-foreground">{kpis.bestellungen} Bestellungen heute</span>
        {open ? <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" /> : <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* KPI-Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {cards.map((c) => (
              <div
                key={c.label}
                className={cn(
                  'rounded-xl border p-3 space-y-1',
                  c.highlight
                    ? 'bg-matcha-50 dark:bg-matcha-950/20 border-matcha-200 dark:border-matcha-800'
                    : 'bg-muted/20 border-border',
                )}
              >
                <div className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider', c.color)}>
                  {c.icon}
                  {c.label}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-black tabular-nums leading-none">{c.value}</span>
                  {c.trend === 'up'   && <TrendingUp   className="h-3 w-3 text-matcha-500 shrink-0" />}
                  {c.trend === 'down' && <TrendingDown  className="h-3 w-3 text-red-500 shrink-0" />}
                  {c.trend === 'neutral' && <Minus      className="h-3 w-3 text-muted-foreground shrink-0" />}
                </div>
                {c.sub && <p className="text-[9px] text-muted-foreground leading-snug">{c.sub}</p>}
              </div>
            ))}
          </div>

          {/* Zonen-Auslastung */}
          {kpis.zonen.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Zonen-Auslastung</p>
              <div className="space-y-1.5">
                {kpis.zonen.slice(0, 6).map(([zone, count]) => {
                  const pct = Math.round((count / maxZone) * 100);
                  return (
                    <div key={zone} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-[11px] font-bold truncate">Zone {zone}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-matcha-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-[10px] font-bold tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
