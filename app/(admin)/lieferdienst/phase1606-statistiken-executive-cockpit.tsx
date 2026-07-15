'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  locationId?: string | null;
}

interface KpiData {
  bestellungen_heute: number;
  umsatz_heute: number;
  avg_lieferzeit_min: number;
  on_time_rate: number;
  storno_rate: number;
  aktive_fahrer: number;
  avg_score: number;
  bestellungen_delta: number;
  umsatz_delta: number;
  lieferzeit_delta: number;
}

function fmtEur(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function DeltaChip({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-stone-400 text-[10px]">±0%</span>;
  const up = delta > 0;
  return (
    <span className={`text-[10px] font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

export function LieferdienstPhase1606StatistikenExecutiveCockpit({ locationId }: Props) {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loc = locationId ?? LOCATION_ID;

  useEffect(() => {
    if (!loc) return;

    const load = () => {
      // Pull from multiple analytics endpoints and merge
      Promise.allSettled([
        fetch(`/api/delivery/analytics?action=today_summary&location_id=${loc}`).then((r) => r.json()),
        fetch(`/api/delivery/admin/schicht-live?location_id=${loc}`).then((r) => r.json()),
      ])
        .then(([summaryRes, schichtRes]) => {
          const summary = summaryRes.status === 'fulfilled' ? summaryRes.value : null;
          const schicht = schichtRes.status === 'fulfilled' ? schichtRes.value : null;

          setData({
            bestellungen_heute: summary?.bestellungen ?? schicht?.bestellungen_heute ?? 0,
            umsatz_heute: summary?.umsatz ?? schicht?.umsatz_heute ?? 0,
            avg_lieferzeit_min: summary?.avg_lieferzeit ?? schicht?.avg_lieferzeit_min ?? 0,
            on_time_rate: summary?.on_time_rate ?? schicht?.on_time_rate ?? 0,
            storno_rate: summary?.storno_rate ?? schicht?.storno_rate ?? 0,
            aktive_fahrer: summary?.aktive_fahrer ?? schicht?.aktive_fahrer ?? 0,
            avg_score: summary?.avg_score ?? schicht?.avg_score ?? 0,
            bestellungen_delta: summary?.bestellungen_delta ?? 0,
            umsatz_delta: summary?.umsatz_delta ?? 0,
            lieferzeit_delta: summary?.lieferzeit_delta ?? 0,
          });
          setLastUpdated(new Date());
        })
        .catch(() => {
          // Fall back to mock values when API unavailable
          setData({
            bestellungen_heute: 0,
            umsatz_heute: 0,
            avg_lieferzeit_min: 0,
            on_time_rate: 0,
            storno_rate: 0,
            aktive_fahrer: 0,
            avg_score: 0,
            bestellungen_delta: 0,
            umsatz_delta: 0,
            lieferzeit_delta: 0,
          });
        })
        .finally(() => setLoading(false));
    };

    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [loc]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-4">
        <div className="h-4 w-48 bg-stone-100 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const kpis = [
    {
      label: 'Bestellungen heute',
      value: data.bestellungen_heute.toString(),
      delta: <DeltaChip delta={data.bestellungen_delta} />,
      bg: 'bg-blue-50',
      text: 'text-blue-800',
      icon: '📦',
    },
    {
      label: 'Umsatz heute',
      value: fmtEur(data.umsatz_heute),
      delta: <DeltaChip delta={data.umsatz_delta} />,
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      icon: '💶',
    },
    {
      label: 'Ø Lieferzeit',
      value: data.avg_lieferzeit_min > 0 ? `${data.avg_lieferzeit_min.toFixed(0)} Min` : '–',
      delta: <DeltaChip delta={-data.lieferzeit_delta} />,
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      icon: '⏱',
    },
    {
      label: 'Pünktlichkeit',
      value: data.on_time_rate > 0 ? `${data.on_time_rate.toFixed(0)}%` : '–',
      delta: null,
      bg: data.on_time_rate >= 80 ? 'bg-emerald-50' : data.on_time_rate >= 60 ? 'bg-amber-50' : 'bg-red-50',
      text: data.on_time_rate >= 80 ? 'text-emerald-800' : data.on_time_rate >= 60 ? 'text-amber-800' : 'text-red-800',
      icon: '🎯',
    },
    {
      label: 'Stornoquote',
      value: data.storno_rate > 0 ? `${data.storno_rate.toFixed(1)}%` : '–',
      delta: null,
      bg: data.storno_rate < 5 ? 'bg-emerald-50' : data.storno_rate < 10 ? 'bg-amber-50' : 'bg-red-50',
      text: data.storno_rate < 5 ? 'text-emerald-800' : data.storno_rate < 10 ? 'text-amber-800' : 'text-red-800',
      icon: '❌',
    },
    {
      label: 'Aktive Fahrer',
      value: data.aktive_fahrer.toString(),
      delta: null,
      bg: 'bg-violet-50',
      text: 'text-violet-800',
      icon: '🛵',
    },
    {
      label: 'Ø Fahrer-Score',
      value: data.avg_score > 0 ? data.avg_score.toFixed(0) : '–',
      delta: null,
      bg: data.avg_score >= 80 ? 'bg-emerald-50' : data.avg_score >= 60 ? 'bg-amber-50' : 'bg-red-50',
      text: data.avg_score >= 80 ? 'text-emerald-800' : data.avg_score >= 60 ? 'text-amber-800' : 'text-red-800',
      icon: '⭐',
    },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden mb-4 shadow-sm">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-stone-100 bg-stone-800 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">
          Statistiken Executive Cockpit
        </span>
        {lastUpdated && (
          <span className="text-[10px] text-white/60 tabular-nums">
            {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`rounded-xl ${kpi.bg} p-3`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-base">{kpi.icon}</span>
              {kpi.delta}
            </div>
            <div className={`text-xl font-black tabular-nums ${kpi.text}`}>{kpi.value}</div>
            <div className={`text-[10px] font-semibold ${kpi.text} opacity-70 mt-0.5`}>{kpi.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
