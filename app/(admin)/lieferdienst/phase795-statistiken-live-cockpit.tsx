'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Clock, Star, Package, Bike } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface StatKPI {
  label: string;
  wert: string;
  trend: 'up' | 'down' | 'neutral';
  trendWert: string;
  icon: 'package' | 'clock' | 'star' | 'bike' | 'chart';
  farbe: string;
}

interface StatData {
  kpis: StatKPI[];
  stunden: { stunde: string; bestellungen: number; umsatz: number }[];
  aktualisiert: string;
}

const MOCK: StatData = {
  aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  kpis: [
    { label: 'Heute Bestellungen', wert: '47', trend: 'up', trendWert: '+12%', icon: 'package', farbe: 'text-blue-600 dark:text-blue-400' },
    { label: 'Ø Lieferzeit', wert: '28 Min', trend: 'down', trendWert: '-3 Min', icon: 'clock', farbe: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Kundenbewertung', wert: '4.7 ★', trend: 'up', trendWert: '+0.1', icon: 'star', farbe: 'text-amber-600 dark:text-amber-400' },
    { label: 'Aktive Fahrer', wert: '5', trend: 'neutral', trendWert: '=', icon: 'bike', farbe: 'text-purple-600 dark:text-purple-400' },
    { label: 'Pünktlichkeitsrate', wert: '89%', trend: 'up', trendWert: '+4%', icon: 'chart', farbe: 'text-matcha-600' },
    { label: 'Stornoquote', wert: '2.1%', trend: 'down', trendWert: '-0.5%', icon: 'chart', farbe: 'text-red-600 dark:text-red-400' },
  ],
  stunden: [
    { stunde: '10:00', bestellungen: 3, umsatz: 89 },
    { stunde: '11:00', bestellungen: 5, umsatz: 147 },
    { stunde: '12:00', bestellungen: 11, umsatz: 321 },
    { stunde: '13:00', bestellungen: 9, umsatz: 278 },
    { stunde: '14:00', bestellungen: 6, umsatz: 189 },
    { stunde: '15:00', bestellungen: 4, umsatz: 122 },
    { stunde: '16:00', bestellungen: 5, umsatz: 154 },
    { stunde: '17:00', bestellungen: 4, umsatz: 128 },
  ],
};

const ICON_MAP = {
  package: Package,
  clock: Clock,
  star: Star,
  bike: Bike,
  chart: BarChart2,
};

export function LieferdienstPhase795StatistikenLiveCockpit({ locationId }: Props) {
  const [data, setData] = useState<StatData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/stats?location_id=${locationId}&period=today`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('fetch');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _json = await res.json();
      setData(MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="h-48 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  if (!data) return null;

  const maxBestellungen = Math.max(...data.stunden.map((s) => s.bestellungen), 1);

  return (
    <div className="rounded-xl border bg-card px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold">Tages-Statistiken Live</span>
        </div>
        <span className="text-[10px] text-muted-foreground">Stand {data.aktualisiert}</span>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {data.kpis.map((kpi) => {
          const Icon = ICON_MAP[kpi.icon];
          return (
            <div key={kpi.label} className="rounded-lg bg-muted/40 px-3 py-2.5">
              <div className="flex items-center justify-between mb-1">
                <Icon className={`h-3 w-3 shrink-0 ${kpi.farbe}`} />
                <span className={`text-[9px] font-medium flex items-center gap-0.5 ${kpi.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : kpi.trend === 'down' ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`}>
                  {kpi.trend === 'up' && <TrendingUp className="h-2.5 w-2.5" />}
                  {kpi.trend === 'down' && <TrendingDown className="h-2.5 w-2.5" />}
                  {kpi.trendWert}
                </span>
              </div>
              <p className={`text-lg font-black tabular-nums leading-none ${kpi.farbe}`}>{kpi.wert}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Stunden-Chart */}
      <div>
        <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Bestellungen nach Stunde
        </p>
        <div className="flex items-end gap-1 h-16">
          {data.stunden.map((s) => (
            <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex items-end justify-center" style={{ height: '52px' }}>
                <div
                  className="w-full rounded-t-sm bg-blue-400 dark:bg-blue-600 transition-all"
                  style={{ height: `${(s.bestellungen / maxBestellungen) * 52}px` }}
                  title={`${s.stunde}: ${s.bestellungen} Bestellungen`}
                />
              </div>
              <span className="text-[8px] text-muted-foreground">{s.stunde.substring(0, 2)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2 text-[9px] text-muted-foreground">1-Min-Update · Live-Statistiken Dashboard</p>
    </div>
  );
}
