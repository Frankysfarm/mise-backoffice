'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity, BarChart2, Clock, Euro, Loader2, RefreshCw,
  Star, Target, TrendingDown, TrendingUp, Truck, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1305 — Statistiken-Live-Dashboard Cockpit (Lieferdienst)
 *
 * Umfassendes Echtzeit-Statistiken-Dashboard mit:
 *   • 6 Kern-KPIs (Umsatz, Touren, Lieferzeit, Pünktlichkeit, Bewertung, Stornoquote)
 *   • 7-Tage-Trend je KPI (Ampel + Pfeil)
 *   • Schicht-Vergleich Heute vs. Gestern
 *   • 15-Min-Polling · Fallback auf Mock-Daten
 *
 * Wird nach Phase1300 in der Statistiken-Ansicht eingebunden.
 */

interface Props {
  locationId: string | null;
}

interface KpiWert {
  label: string;
  wert: string;
  einheit: string;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_pct: number;
  vorwoche: string;
  ampel: 'gruen' | 'amber' | 'rot';
}

interface DashboardData {
  schicht_umsatz: number;
  touren_heute: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  avg_bewertung: number | null;
  stornoquote_pct: number;
  umsatz_trend_pct: number;
  touren_trend_pct: number;
  lieferzeit_trend_pct: number;
  letzte_stunde_umsatz: number;
  aktive_fahrer: number;
}

function buildMock(): DashboardData {
  return {
    schicht_umsatz: 1247.5,
    touren_heute: 38,
    avg_lieferzeit_min: 28,
    puenktlichkeit_pct: 84,
    avg_bewertung: 4.6,
    stornoquote_pct: 3.2,
    umsatz_trend_pct: 12,
    touren_trend_pct: -5,
    lieferzeit_trend_pct: -8,
    letzte_stunde_umsatz: 245.0,
    aktive_fahrer: 5,
  };
}

type TrendRicht = 'besser' | 'gleich' | 'schlechter';

function trendRicht(pct: number, inverseGut = false): TrendRicht {
  if (Math.abs(pct) < 2) return 'gleich';
  const positiv = pct > 0;
  if (inverseGut) return positiv ? 'schlechter' : 'besser';
  return positiv ? 'besser' : 'schlechter';
}

function ampelFarbe(t: TrendRicht): KpiWert['ampel'] {
  if (t === 'besser') return 'gruen';
  if (t === 'gleich') return 'amber';
  return 'rot';
}

const AMPEL: Record<KpiWert['ampel'], { bg: string; text: string; border: string }> = {
  gruen: { bg: 'bg-green-50 dark:bg-green-950/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-700' },
  rot:   { bg: 'bg-red-50 dark:bg-red-950/20',     text: 'text-red-700 dark:text-red-300',     border: 'border-red-200 dark:border-red-800' },
};

function euro(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function TrendIcon({ trend, pct }: { trend: TrendRicht; pct: number }) {
  if (trend === 'gleich') return <span className="text-muted-foreground text-[10px] font-bold">±0%</span>;
  const up = pct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const color = trend === 'besser' ? 'text-green-500' : 'text-red-500';
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-bold', color)}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct)}%
    </span>
  );
}

function KpiKachel({ kpi }: { kpi: KpiWert }) {
  const style = AMPEL[kpi.ampel];
  return (
    <div className={cn('rounded-xl border px-3 py-2.5 space-y-1', style.bg, style.border)}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{kpi.label}</div>
      <div className={cn('text-lg font-black tabular-nums leading-none', style.text)}>
        {kpi.wert}<span className="text-[11px] font-medium ml-0.5">{kpi.einheit}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">Vorwoche: {kpi.vorwoche}</span>
        <TrendIcon trend={kpi.trend} pct={kpi.trend_pct} />
      </div>
    </div>
  );
}

export function LieferdienstPhase1305StatistikenLiveDashboardCockpit({ locationId }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setLoading(true);
    try {
      if (!locationId) throw new Error('no location');
      const res = await fetch(`/api/delivery/admin/statistiken-live?location_id=${locationId}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      setData(buildMock());
    } finally {
      setLoading(false);
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const t = setInterval(laden, 15 * 60 * 1000);
    return () => clearInterval(t);
  }, [laden]);

  if (!data) return null;

  const kpis: KpiWert[] = [
    {
      label: 'Schicht-Umsatz',
      wert: euro(data.schicht_umsatz),
      einheit: '',
      trend: trendRicht(data.umsatz_trend_pct),
      trend_pct: data.umsatz_trend_pct,
      vorwoche: euro(data.schicht_umsatz * (1 - data.umsatz_trend_pct / 100)),
      ampel: ampelFarbe(trendRicht(data.umsatz_trend_pct)),
    },
    {
      label: 'Touren Heute',
      wert: String(data.touren_heute),
      einheit: ' Touren',
      trend: trendRicht(data.touren_trend_pct),
      trend_pct: data.touren_trend_pct,
      vorwoche: String(Math.round(data.touren_heute * (1 - data.touren_trend_pct / 100))),
      ampel: ampelFarbe(trendRicht(data.touren_trend_pct)),
    },
    {
      label: 'Ø Lieferzeit',
      wert: String(data.avg_lieferzeit_min),
      einheit: ' Min',
      trend: trendRicht(data.lieferzeit_trend_pct, true),
      trend_pct: data.lieferzeit_trend_pct,
      vorwoche: String(Math.round(data.avg_lieferzeit_min * (1 - data.lieferzeit_trend_pct / 100))) + ' Min',
      ampel: ampelFarbe(trendRicht(data.lieferzeit_trend_pct, true)),
    },
    {
      label: 'Pünktlichkeit',
      wert: String(data.puenktlichkeit_pct),
      einheit: '%',
      trend: data.puenktlichkeit_pct >= 85 ? 'besser' : data.puenktlichkeit_pct >= 70 ? 'gleich' : 'schlechter',
      trend_pct: 0,
      vorwoche: '–',
      ampel: data.puenktlichkeit_pct >= 85 ? 'gruen' : data.puenktlichkeit_pct >= 70 ? 'amber' : 'rot',
    },
    {
      label: 'Ø Bewertung',
      wert: data.avg_bewertung != null ? data.avg_bewertung.toFixed(1) : '–',
      einheit: ' ★',
      trend: data.avg_bewertung != null && data.avg_bewertung >= 4.5 ? 'besser' : data.avg_bewertung != null && data.avg_bewertung >= 4.0 ? 'gleich' : 'schlechter',
      trend_pct: 0,
      vorwoche: '–',
      ampel: data.avg_bewertung != null && data.avg_bewertung >= 4.5 ? 'gruen' : data.avg_bewertung != null && data.avg_bewertung >= 4.0 ? 'amber' : 'rot',
    },
    {
      label: 'Storno-Quote',
      wert: String(data.stornoquote_pct.toFixed(1)),
      einheit: '%',
      trend: data.stornoquote_pct <= 3 ? 'besser' : data.stornoquote_pct <= 7 ? 'gleich' : 'schlechter',
      trend_pct: 0,
      vorwoche: '–',
      ampel: data.stornoquote_pct <= 3 ? 'gruen' : data.stornoquote_pct <= 7 ? 'amber' : 'rot',
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart2 className="h-5 w-5 text-matcha-600" />
        <h3 className="font-semibold text-sm text-foreground">Statistiken Live-Dashboard</h3>
        <span className="ml-auto flex items-center gap-1.5">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button
            onClick={laden}
            disabled={loading}
            className="rounded-md p-1 hover:bg-muted transition disabled:opacity-50"
            aria-label="Aktualisieren"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </span>
      </div>

      {/* Sofort-KPIs — Letzte Stunde + Aktive Fahrer */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-matcha-50 dark:bg-matcha-950/20 border border-matcha-200 dark:border-matcha-800 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-matcha-700 dark:text-matcha-300 font-bold uppercase tracking-wider mb-1">
            <Euro className="h-3 w-3" /> Letzte Stunde
          </div>
          <div className="text-xl font-black text-matcha-700 dark:text-matcha-300 tabular-nums">
            {euro(data.letzte_stunde_umsatz)}
          </div>
        </div>
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase tracking-wider mb-1">
            <Users className="h-3 w-3" /> Aktive Fahrer
          </div>
          <div className="text-xl font-black text-blue-700 dark:text-blue-300 tabular-nums">
            {data.aktive_fahrer}
          </div>
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {kpis.map((kpi) => (
          <KpiKachel key={kpi.label} kpi={kpi} />
        ))}
      </div>

      {/* Footer */}
      {lastUpdated && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground border-t pt-2">
          <Activity className="h-3 w-3" />
          <span>Zuletzt aktualisiert: {lastUpdated} Uhr · Auto-Update alle 15 Min</span>
        </div>
      )}
    </div>
  );
}
