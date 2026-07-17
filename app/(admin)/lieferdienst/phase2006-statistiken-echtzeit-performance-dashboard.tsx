'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface LiveMetriken {
  bestellungen_heute: number;
  avg_lieferzeit_min: number;
  liefertreue_pct: number;
  umsatz_heute_eur: number;
  aktive_fahrer: number;
  storno_quote_pct: number;
  trend_bestellungen: number;
  trend_lieferzeit: number;
  trend_liefertreue: number;
  trend_umsatz: number;
  trend_aktive_fahrer: number;
  trend_storno: number;
}

const MOCK: LiveMetriken = {
  bestellungen_heute: 147,
  avg_lieferzeit_min: 28,
  liefertreue_pct: 84,
  umsatz_heute_eur: 3420,
  aktive_fahrer: 6,
  storno_quote_pct: 3.2,
  trend_bestellungen: 1,
  trend_lieferzeit: -1,
  trend_liefertreue: 1,
  trend_umsatz: 1,
  trend_aktive_fahrer: 0,
  trend_storno: -1,
};

interface Props {
  locationId: string | null;
  className?: string;
}

function TrendArrow({ trend }: { trend: number }) {
  if (trend > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (trend < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

function trendColor(trend: number): string {
  if (trend > 0) return 'text-green-400';
  if (trend < 0) return 'text-red-400';
  return 'text-gray-500';
}

export function LieferdienstPhase2006StatistikenEchtzeitPerformanceDashboard({ locationId, className }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<LiveMetriken>(MOCK);

  useEffect(() => {
    const load = async () => {
      if (!locationId) return;
      try {
        const res = await fetch(`/api/delivery/admin/live-metriken?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: LiveMetriken = await res.json();
        setData(json);
      } catch {
        setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const kpis: { label: string; value: string; trend: number }[] = [
    { label: 'Bestellungen heute', value: String(data.bestellungen_heute), trend: data.trend_bestellungen },
    { label: 'Ø Lieferzeit', value: `${data.avg_lieferzeit_min} Min`, trend: data.trend_lieferzeit },
    { label: 'Liefertreue %', value: `${data.liefertreue_pct}%`, trend: data.trend_liefertreue },
    { label: 'Umsatz heute', value: `${data.umsatz_heute_eur.toLocaleString('de-DE')} €`, trend: data.trend_umsatz },
    { label: 'Aktive Fahrer', value: String(data.aktive_fahrer), trend: data.trend_aktive_fahrer },
    { label: 'Storno-Quote %', value: `${data.storno_quote_pct}%`, trend: data.trend_storno },
  ];

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          Statistiken — Echtzeit Performance Dashboard
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {kpis.map(kpi => (
              <div key={kpi.label} className="rounded-lg bg-gray-800 px-3 py-2.5 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={cn('flex items-center gap-0.5', trendColor(kpi.trend))}>
                    <TrendArrow trend={kpi.trend} />
                  </span>
                </div>
                <div className="text-xl font-black text-gray-100 tabular-nums leading-tight">
                  {kpi.value}
                </div>
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider leading-tight">
                  {kpi.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
