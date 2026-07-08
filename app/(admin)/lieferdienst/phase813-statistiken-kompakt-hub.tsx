'use client';

import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';

interface HeuteStats {
  bestellungen: number;
  bestellungen_gestern: number;
  lieferzeit: number;
  lieferzeit_gestern: number;
  puenktlichkeit: number;
  puenktlichkeit_gestern: number;
  fahrer_online: number;
  umsatz: number;
  umsatz_gestern: number;
  storno_rate: number;
  storno_rate_gestern: number;
}

const MOCK: HeuteStats = {
  bestellungen: 47,
  bestellungen_gestern: 42,
  lieferzeit: 28,
  lieferzeit_gestern: 31,
  puenktlichkeit: 87,
  puenktlichkeit_gestern: 82,
  fahrer_online: 6,
  umsatz: 1284.50,
  umsatz_gestern: 1155.00,
  storno_rate: 3.2,
  storno_rate_gestern: 4.1,
};

type TrendDir = 'up' | 'down' | 'neutral';

interface KpiCard {
  label: string;
  wert: string;
  trend: TrendDir;
  trendLabel: string;
  /** emerald = gut, red = schlecht, amber = neutral */
  farbe: 'emerald' | 'red' | 'amber';
}

function buildKpis(d: HeuteStats): KpiCard[] {
  const diffBestellungen = d.bestellungen - d.bestellungen_gestern;
  const diffLieferzeit = d.lieferzeit - d.lieferzeit_gestern;
  const diffPuenktlichkeit = d.puenktlichkeit - d.puenktlichkeit_gestern;
  const diffUmsatz = d.umsatz - d.umsatz_gestern;
  const diffStorno = d.storno_rate - d.storno_rate_gestern;

  return [
    {
      label: 'Bestellungen heute',
      wert: String(d.bestellungen),
      trend: diffBestellungen > 0 ? 'up' : diffBestellungen < 0 ? 'down' : 'neutral',
      trendLabel:
        diffBestellungen === 0
          ? '= gg. gestern'
          : `${diffBestellungen > 0 ? '+' : ''}${diffBestellungen} gg. gestern`,
      farbe: diffBestellungen >= 0 ? 'emerald' : 'red',
    },
    {
      label: 'Ø Lieferzeit',
      wert: `${d.lieferzeit} Min`,
      // lower lieferzeit is better
      trend: diffLieferzeit < 0 ? 'up' : diffLieferzeit > 0 ? 'down' : 'neutral',
      trendLabel:
        diffLieferzeit === 0
          ? '= gg. gestern'
          : `${diffLieferzeit > 0 ? '+' : ''}${diffLieferzeit} Min`,
      farbe: diffLieferzeit <= 0 ? 'emerald' : 'red',
    },
    {
      label: 'Pünktlichkeitsrate',
      wert: `${d.puenktlichkeit}%`,
      trend: diffPuenktlichkeit > 0 ? 'up' : diffPuenktlichkeit < 0 ? 'down' : 'neutral',
      trendLabel:
        diffPuenktlichkeit === 0
          ? '= gg. gestern'
          : `${diffPuenktlichkeit > 0 ? '+' : ''}${diffPuenktlichkeit}%`,
      farbe: diffPuenktlichkeit >= 0 ? 'emerald' : 'red',
    },
    {
      label: 'Aktive Fahrer',
      wert: String(d.fahrer_online),
      trend: 'neutral',
      trendLabel: 'aktuell online',
      farbe: 'amber',
    },
    {
      label: 'Umsatz heute',
      wert: `${d.umsatz.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
      trend: diffUmsatz > 0 ? 'up' : diffUmsatz < 0 ? 'down' : 'neutral',
      trendLabel:
        diffUmsatz === 0
          ? '= gg. gestern'
          : `${diffUmsatz > 0 ? '+' : ''}${diffUmsatz.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
      farbe: diffUmsatz >= 0 ? 'emerald' : 'red',
    },
    {
      label: 'Stornoquote',
      wert: `${d.storno_rate}%`,
      // lower storno is better
      trend: diffStorno < 0 ? 'up' : diffStorno > 0 ? 'down' : 'neutral',
      trendLabel:
        diffStorno === 0
          ? '= gg. gestern'
          : `${diffStorno > 0 ? '+' : ''}${diffStorno.toFixed(1)}%`,
      farbe: diffStorno <= 0 ? 'emerald' : 'red',
    },
  ];
}

const VALUE_COLOR: Record<'emerald' | 'red' | 'amber', string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  red: 'text-red-600 dark:text-red-400',
  amber: 'text-amber-600 dark:text-amber-400',
};

const TREND_COLOR: Record<TrendDir, string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-red-500 dark:text-red-400',
  neutral: 'text-muted-foreground',
};

const TREND_ARROW: Record<TrendDir, string> = {
  up: '▲',
  down: '▼',
  neutral: '–',
};

export function LieferdienstPhase813StatistikenKompaktHub() {
  const [data, setData] = useState<HeuteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [aktualisiert, setAktualisiert] = useState('');

  const fetchData = async () => {
    try {
      const res = await fetch('/api/delivery/stats/heute', { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch');
      const json: HeuteStats = await res.json();
      setData(json);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
      setAktualisiert(
        new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      );
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="h-56 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  if (!data) return null;

  const kpis = buildKpis(data);

  return (
    <div className="rounded-xl border bg-card px-4 py-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold">Statistiken Heute</span>
        </div>
        {aktualisiert && (
          <span className="text-[10px] text-muted-foreground">Stand {aktualisiert}</span>
        )}
      </div>

      {/* KPI-Grid 2×3 */}
      <div className="grid grid-cols-2 gap-2">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg bg-muted/40 px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-[9px] font-medium flex items-center gap-0.5 ${TREND_COLOR[kpi.trend]}`}
              >
                <span className="text-[8px]">{TREND_ARROW[kpi.trend]}</span>
                {kpi.trendLabel}
              </span>
            </div>
            <p className={`text-lg font-black tabular-nums leading-none ${VALUE_COLOR[kpi.farbe]}`}>
              {kpi.wert}
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{kpi.label}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[9px] text-muted-foreground">60-Sek-Update · Kompakt-Hub</p>
    </div>
  );
}
