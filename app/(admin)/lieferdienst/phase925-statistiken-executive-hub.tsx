'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, BarChart2, Clock, Euro, Loader2,
  Package, Star, TrendingUp, TrendingDown, Users,
} from 'lucide-react';

/**
 * Phase 925 — Statistiken Executive Hub (Lieferdienst)
 *
 * Umfassendes Statistiken-Dashboard mit:
 * - 6 Live-KPIs (Bestellungen, Umsatz, Pünktlichkeit, Lieferzeit, Bewertung, Storno)
 * - Vergleich Vortag (Delta mit Pfeil)
 * - Stunden-Sparkline der Bestellungen
 * - Fahrer-Performance-Rangliste (Top 3)
 *
 * Polling alle 3 Min. Fallback auf Mock-Daten.
 */

interface KpiData {
  bestellungen_heute: number;
  bestellungen_delta_pct: number;
  umsatz_eur: number;
  umsatz_delta_pct: number;
  puenktlichkeit_pct: number;
  puenktlichkeit_delta: number;
  avg_lieferzeit_min: number;
  lieferzeit_delta: number;
  avg_bewertung: number;
  bewertung_delta: number;
  storno_rate_pct: number;
  storno_delta: number;
  stunden_verlauf: number[];
  top_fahrer: { name: string; score: number }[];
}

interface Props {
  locationId: string | null;
}

const MOCK: KpiData = {
  bestellungen_heute: 47,
  bestellungen_delta_pct: 12,
  umsatz_eur: 1284.50,
  umsatz_delta_pct: 8.5,
  puenktlichkeit_pct: 87,
  puenktlichkeit_delta: 3,
  avg_lieferzeit_min: 28,
  lieferzeit_delta: -2,
  avg_bewertung: 4.6,
  bewertung_delta: 0.1,
  storno_rate_pct: 3.2,
  storno_delta: -0.8,
  stunden_verlauf: [2, 3, 5, 8, 12, 9, 7, 5, 4, 3, 4, 6],
  top_fahrer: [
    { name: 'Tarkan A.', score: 96 },
    { name: 'Lena M.', score: 91 },
    { name: 'Jörn K.', score: 85 },
  ],
};

const POLL_MS = 3 * 60 * 1000;

function DeltaBadge({ value, invert = false, suffix = '%' }: {
  value: number; invert?: boolean; suffix?: string;
}) {
  const positive = invert ? value < 0 : value > 0;
  const neutral = value === 0;
  return (
    <span className={cn(
      'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
      neutral ? 'bg-stone-100 text-stone-500'
      : positive ? 'bg-matcha-100 text-matcha-700'
      : 'bg-red-100 text-red-700',
    )}>
      {!neutral && (value > 0
        ? <TrendingUp className="h-2.5 w-2.5" />
        : <TrendingDown className="h-2.5 w-2.5" />
      )}
      {value > 0 ? '+' : ''}{value}{suffix}
    </span>
  );
}

export function LieferdienstPhase925StatistikenExecutiveHub({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId) {
      setData(MOCK);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/statistiken-executive?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData((json as KpiData) ?? MOCK);
      setLastUpdate(new Date());
    } catch {
      setData(MOCK);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const d = data ?? MOCK;
  const maxStunde = Math.max(...d.stunden_verlauf, 1);

  const kpis = [
    {
      icon: <Package className="h-4 w-4" />,
      label: 'Bestellungen',
      value: d.bestellungen_heute.toString(),
      delta: <DeltaBadge value={d.bestellungen_delta_pct} />,
      color: 'text-matcha-600',
    },
    {
      icon: <Euro className="h-4 w-4" />,
      label: 'Umsatz',
      value: `${d.umsatz_eur.toFixed(0)}€`,
      delta: <DeltaBadge value={d.umsatz_delta_pct} />,
      color: 'text-matcha-600',
    },
    {
      icon: <Clock className="h-4 w-4" />,
      label: 'Pünktlichkeit',
      value: `${d.puenktlichkeit_pct}%`,
      delta: <DeltaBadge value={d.puenktlichkeit_delta} suffix="pp" />,
      color: d.puenktlichkeit_pct >= 85 ? 'text-matcha-600' : d.puenktlichkeit_pct >= 70 ? 'text-amber-600' : 'text-red-600',
    },
    {
      icon: <Activity className="h-4 w-4" />,
      label: 'Ø Lieferzeit',
      value: `${d.avg_lieferzeit_min} Min`,
      delta: <DeltaBadge value={d.lieferzeit_delta} invert suffix=" Min" />,
      color: d.avg_lieferzeit_min <= 30 ? 'text-matcha-600' : d.avg_lieferzeit_min <= 40 ? 'text-amber-600' : 'text-red-600',
    },
    {
      icon: <Star className="h-4 w-4" />,
      label: 'Ø Bewertung',
      value: d.avg_bewertung.toFixed(1),
      delta: <DeltaBadge value={d.bewertung_delta} suffix="★" />,
      color: d.avg_bewertung >= 4.5 ? 'text-matcha-600' : d.avg_bewertung >= 4.0 ? 'text-amber-600' : 'text-red-600',
    },
    {
      icon: <TrendingDown className="h-4 w-4" />,
      label: 'Storno-Rate',
      value: `${d.storno_rate_pct.toFixed(1)}%`,
      delta: <DeltaBadge value={d.storno_delta} invert suffix="pp" />,
      color: d.storno_rate_pct <= 4 ? 'text-matcha-600' : d.storno_rate_pct <= 7 ? 'text-amber-600' : 'text-red-600',
    },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white/90 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Statistiken Executive Hub
          </span>
          <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            {d.bestellungen_heute} Bestellungen heute
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-4">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-stone-100 bg-stone-50 p-3"
              >
                <div className={cn('flex items-center gap-1 mb-1', kpi.color)}>
                  {kpi.icon}
                  <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                    {kpi.label}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-1">
                  <span className={cn('text-xl font-black tabular-nums', kpi.color)}>
                    {kpi.value}
                  </span>
                  {kpi.delta}
                </div>
              </div>
            ))}
          </div>

          {/* Stunden-Sparkline */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Bestellungen je Stunde (letzte 12h)
              </span>
            </div>
            <div className="flex items-end gap-1 h-14">
              {d.stunden_verlauf.map((count, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t bg-matcha-400 transition-all duration-300"
                    style={{ height: `${Math.round((count / maxStunde) * 48)}px`, minHeight: count > 0 ? '4px' : '0' }}
                  />
                  <span className="text-[8px] text-stone-400 tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top-Fahrer */}
          {d.top_fahrer.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Top Fahrer heute
              </div>
              <div className="space-y-1.5">
                {d.top_fahrer.map((f, i) => (
                  <div
                    key={f.name}
                    className="flex items-center gap-3 rounded-xl bg-stone-50 border border-stone-100 px-3 py-2"
                  >
                    <span className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-black shrink-0',
                      i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-stone-300 text-stone-700' : 'bg-orange-200 text-orange-700',
                    )}>
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-semibold text-stone-700">{f.name}</span>
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-20 rounded-full bg-stone-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-matcha-500"
                          style={{ width: `${f.score}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-matcha-700 tabular-nums w-8 text-right">
                        {f.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lastUpdate && (
            <p className="text-[9px] text-muted-foreground text-right">
              Stand: {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
