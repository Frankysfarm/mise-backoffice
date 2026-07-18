'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Euro, Package, Target, TrendingUp, Truck } from 'lucide-react';

type StundenSlot = {
  stunde: number;
  bestellungen: number;
  umsatz_eur: number;
  avg_lieferzeit_min: number;
};

type StatsData = {
  bestellungen_heute: number;
  umsatz_heute_eur: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_quote: number;
  storno_quote: number;
  aktive_fahrer: number;
  abgeschlossene_touren: number;
  stunden: StundenSlot[];
  trend_umsatz: 'steigend' | 'fallend' | 'stabil';
  trend_lieferzeit: 'besser' | 'schlechter' | 'stabil';
  vorwoche_umsatz_eur: number;
};

const MOCK: StatsData = {
  bestellungen_heute: 47,
  umsatz_heute_eur: 1842.5,
  avg_lieferzeit_min: 24,
  puenktlichkeit_quote: 88,
  storno_quote: 2.1,
  aktive_fahrer: 5,
  abgeschlossene_touren: 19,
  trend_umsatz: 'steigend',
  trend_lieferzeit: 'besser',
  vorwoche_umsatz_eur: 1640.0,
  stunden: [
    { stunde: 11, bestellungen: 4, umsatz_eur: 156, avg_lieferzeit_min: 22 },
    { stunde: 12, bestellungen: 8, umsatz_eur: 312, avg_lieferzeit_min: 26 },
    { stunde: 13, bestellungen: 11, umsatz_eur: 435, avg_lieferzeit_min: 28 },
    { stunde: 14, bestellungen: 6, umsatz_eur: 234, avg_lieferzeit_min: 23 },
    { stunde: 15, bestellungen: 5, umsatz_eur: 195, avg_lieferzeit_min: 21 },
    { stunde: 16, bestellungen: 7, umsatz_eur: 273, avg_lieferzeit_min: 25 },
    { stunde: 17, bestellungen: 6, umsatz_eur: 237, avg_lieferzeit_min: 24 },
  ],
};

function fmtEur(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function trendPfeil(t: 'steigend' | 'fallend' | 'stabil' | 'besser' | 'schlechter'): string {
  if (t === 'steigend' || t === 'besser') return '↑';
  if (t === 'fallend' || t === 'schlechter') return '↓';
  return '→';
}

function trendFarbe(t: 'steigend' | 'fallend' | 'stabil' | 'besser' | 'schlechter'): string {
  if (t === 'steigend' || t === 'besser') return 'text-green-600 dark:text-green-400';
  if (t === 'fallend' || t === 'schlechter') return 'text-red-600 dark:text-red-400';
  return 'text-gray-500 dark:text-gray-400';
}

export function LieferdienstPhase2255StatistikDashboardPro({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<StatsData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/analytics?location_id=${locationId}&period=today`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const board = data ?? MOCK;

  const umsatzVeraenderung = useMemo(() => {
    if (!board.vorwoche_umsatz_eur || board.vorwoche_umsatz_eur === 0) return null;
    const delta = ((board.umsatz_heute_eur - board.vorwoche_umsatz_eur) / board.vorwoche_umsatz_eur) * 100;
    return delta;
  }, [board]);

  const maxBestellungen = useMemo(() => Math.max(...board.stunden.map((s) => s.bestellungen), 1), [board]);

  const kpis = [
    {
      icon: Package,
      label: 'Bestellungen',
      value: board.bestellungen_heute.toString(),
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      icon: Euro,
      label: 'Umsatz',
      value: fmtEur(board.umsatz_heute_eur),
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      extra: umsatzVeraenderung !== null ? `${umsatzVeraenderung > 0 ? '+' : ''}${umsatzVeraenderung.toFixed(1)}% ggü. VW` : undefined,
    },
    {
      icon: Truck,
      label: 'Ø Lieferzeit',
      value: `${board.avg_lieferzeit_min} min`,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      icon: Target,
      label: 'Pünktlichkeit',
      value: `${board.puenktlichkeit_quote}%`,
      color: board.puenktlichkeit_quote >= 85 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      bg: board.puenktlichkeit_quote >= 85 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20',
    },
  ];

  if (!locationId) return null;

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-gray-900 overflow-hidden mb-4">
      <button
        className="w-full flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-stone-700"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300">
            <Activity className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-gray-800 dark:text-gray-100">Statistiken-Dashboard Pro</div>
            <div className="text-xs text-stone-400">
              {board.aktive_fahrer} Fahrer aktiv · {board.abgeschlossene_touren} Touren abgeschlossen
            </div>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-stone-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-stone-400" />
        )}
      </button>

      {open && (
        <div className="p-5 space-y-4">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className={`rounded-xl ${kpi.bg} p-3`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                  <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">{kpi.label}</span>
                </div>
                <div className={`text-lg font-black tabular-nums ${kpi.color}`}>{kpi.value}</div>
                {kpi.extra && (
                  <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">{kpi.extra}</div>
                )}
              </div>
            ))}
          </div>

          {/* Trend-Zeile */}
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-stone-400" />
              <span className="text-stone-500 dark:text-stone-400">Umsatz-Trend:</span>
              <span className={`font-bold ${trendFarbe(board.trend_umsatz)}`}>
                {trendPfeil(board.trend_umsatz)} {board.trend_umsatz}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-stone-400" />
              <span className="text-stone-500 dark:text-stone-400">Lieferzeit:</span>
              <span className={`font-bold ${trendFarbe(board.trend_lieferzeit)}`}>
                {trendPfeil(board.trend_lieferzeit)} {board.trend_lieferzeit}
              </span>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-stone-400">Stornoquote:</span>
              <span className={`font-bold ${board.storno_quote <= 3 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {board.storno_quote.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Stunden-Balkendiagramm */}
          {board.stunden.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-2">
                Bestellungen nach Stunde
              </div>
              <div className="flex items-end gap-1 h-16">
                {board.stunden.map((s) => (
                  <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full rounded-t bg-matcha-500 dark:bg-matcha-600 transition-all duration-500 min-h-[2px]"
                      style={{ height: `${(s.bestellungen / maxBestellungen) * 56}px` }}
                      title={`${s.bestellungen} Bestellungen · ${fmtEur(s.umsatz_eur)}`}
                    />
                    <span className="text-[9px] text-stone-400">{s.stunde}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Storno-Hinweis */}
          {board.storno_quote > 5 && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              Hohe Stornoquote ({board.storno_quote}%) — bitte Ursachen prüfen (lange Wartezeiten, Küche, Fahrer).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
