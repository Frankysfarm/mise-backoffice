'use client';

import React, { useCallback, useEffect, useState } from 'react';

interface TagesKpiData {
  touren_heute: number;
  avg_lieferzeit_min: number;
  puenktlichkeits_rate: number;
  trinkgeld_rate: number;
  rang: number | null;
  fahrer_gesamt: number;
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
}

const MOCK: TagesKpiData = {
  touren_heute: 8,
  avg_lieferzeit_min: 21.4,
  puenktlichkeits_rate: 87.5,
  trinkgeld_rate: 62.0,
  rang: 3,
  fahrer_gesamt: 12,
};

function kpiColor(val: number, thresholds: [number, number]): string {
  if (val >= thresholds[1]) return 'text-emerald-700';
  if (val >= thresholds[0]) return 'text-amber-600';
  return 'text-red-600';
}

function kgBg(val: number, thresholds: [number, number]): string {
  if (val >= thresholds[1]) return 'bg-emerald-50';
  if (val >= thresholds[0]) return 'bg-amber-50';
  return 'bg-red-50';
}

export function FahrerPhase1620TagesKpiScoreboard({ driverId, isOnline }: Props) {
  const [data, setData] = useState<TagesKpiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!driverId) return;
    try {
      const res = await fetch(`/api/delivery/driver/tages-kpi-scoreboard?driver_id=${driverId}`);
      if (!res.ok) throw new Error('not ok');
      const json = await res.json();
      setData(json);
    } catch {
      setData(MOCK);
    }
  }, [driverId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(load, 10 * 60_000);
    return () => clearInterval(id);
  }, [isOnline, load]);

  if (!isOnline || !driverId) return null;

  const d = data ?? MOCK;

  const kpis = [
    {
      label: 'Touren heute',
      value: d.touren_heute.toString(),
      unit: '',
      color: 'text-stone-800',
      bg: 'bg-stone-50',
    },
    {
      label: 'Ø Lieferzeit',
      value: d.avg_lieferzeit_min.toFixed(1),
      unit: 'Min',
      color: d.avg_lieferzeit_min <= 25 ? 'text-emerald-700' : d.avg_lieferzeit_min <= 35 ? 'text-amber-600' : 'text-red-600',
      bg: d.avg_lieferzeit_min <= 25 ? 'bg-emerald-50' : d.avg_lieferzeit_min <= 35 ? 'bg-amber-50' : 'bg-red-50',
    },
    {
      label: 'Pünktlichkeit',
      value: d.puenktlichkeits_rate.toFixed(0),
      unit: '%',
      color: kpiColor(d.puenktlichkeits_rate, [80, 90]),
      bg: kgBg(d.puenktlichkeits_rate, [80, 90]),
    },
    {
      label: 'Trinkgeld-Rate',
      value: d.trinkgeld_rate.toFixed(0),
      unit: '%',
      color: kpiColor(d.trinkgeld_rate, [50, 70]),
      bg: kgBg(d.trinkgeld_rate, [50, 70]),
    },
  ];

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white overflow-hidden shadow-sm mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 bg-emerald-700 text-white text-left"
      >
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Mein heutiges Scoreboard</span>
        {d.rang && (
          <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
            Rang #{d.rang}/{d.fahrer_gesamt}
          </span>
        )}
        <span className="text-xs opacity-70">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            {kpis.map((kpi) => (
              <div key={kpi.label} className={`rounded-xl p-3 ${kpi.bg}`}>
                <div className={`text-xl font-black tabular-nums ${kpi.color}`}>
                  {kpi.value}{kpi.unit && <span className="text-sm font-semibold ml-0.5">{kpi.unit}</span>}
                </div>
                <div className="text-[10px] font-semibold text-stone-500 mt-0.5">{kpi.label}</div>
              </div>
            ))}
          </div>

          {d.rang && d.fahrer_gesamt > 1 && (
            <div className="rounded-lg bg-stone-50 border border-stone-100 px-3 py-2 text-xs text-stone-600 flex items-center gap-2">
              <span className="text-base">
                {d.rang === 1 ? '🥇' : d.rang === 2 ? '🥈' : d.rang === 3 ? '🥉' : '📊'}
              </span>
              <span>
                Platz <strong>{d.rang}</strong> von {d.fahrer_gesamt} Fahrern heute
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
