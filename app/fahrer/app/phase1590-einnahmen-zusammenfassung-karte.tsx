'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  isOnline: boolean;
  driverId: string | null;
}

interface EinnahmenData {
  gesamt_eur: number;
  touren_eur: number;
  trinkgeld_eur: number;
  bonus_eur: number;
  vortag_gesamt_eur: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  touren_count: number;
}

const MOCK_DATA: EinnahmenData = {
  gesamt_eur: 87.5,
  touren_eur: 62.0,
  trinkgeld_eur: 18.5,
  bonus_eur: 7.0,
  vortag_gesamt_eur: 74.0,
  trend: 'besser',
  touren_count: 8,
};

const TREND_STYLE = {
  besser:      { color: 'text-emerald-600', icon: '↑', label: 'besser als gestern' },
  gleich:      { color: 'text-gray-500',    icon: '→', label: 'wie gestern' },
  schlechter:  { color: 'text-rose-600',    icon: '↓', label: 'schlechter als gestern' },
};

function fmt(eur: number): string {
  return eur.toFixed(2).replace('.', ',') + ' €';
}

export function FahrerPhase1590EinnahmenZusammenfassungKarte({ isOnline, driverId }: Props) {
  const [data, setData] = useState<EinnahmenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOnline || !driverId || !mounted) return;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/tages-bilanz?driver_id=${driverId}`);
        if (res.ok) {
          const json = await res.json();
          const einnahmen: EinnahmenData = {
            gesamt_eur: (json.einnahmen_eur ?? json.total_eur ?? MOCK_DATA.gesamt_eur),
            touren_eur: (json.touren_eur ?? MOCK_DATA.touren_eur),
            trinkgeld_eur: (json.trinkgeld_eur ?? json.tips_eur ?? MOCK_DATA.trinkgeld_eur),
            bonus_eur: (json.bonus_eur ?? MOCK_DATA.bonus_eur),
            vortag_gesamt_eur: (json.vortag_eur ?? MOCK_DATA.vortag_gesamt_eur),
            trend: (json.trend ?? MOCK_DATA.trend) as EinnahmenData['trend'],
            touren_count: (json.touren_count ?? MOCK_DATA.touren_count),
          };
          setData(einnahmen);
        } else {
          setData(MOCK_DATA);
        }
      } catch {
        setData(MOCK_DATA);
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 10 * 60_000);
    return () => clearInterval(iv);
  }, [isOnline, driverId, mounted]);

  if (!mounted || !isOnline || !open) return null;

  const d = data ?? MOCK_DATA;
  const trend = TREND_STYLE[d.trend as keyof typeof TREND_STYLE];
  const diff = d.gesamt_eur - d.vortag_gesamt_eur;

  const slices = [
    { label: 'Touren', value: d.touren_eur, color: 'bg-matcha-500' },
    { label: 'Trinkgeld', value: d.trinkgeld_eur, color: 'bg-amber-400' },
    { label: 'Bonus', value: d.bonus_eur, color: 'bg-emerald-500' },
  ];

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden mb-4 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-matcha-600 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Einnahmen heute</span>
        {loading && <span className="text-xs text-white/60">Lädt…</span>}
        <button onClick={() => setOpen(false)} className="text-lg leading-none text-white/60 hover:text-white">×</button>
      </div>

      <div className="px-4 py-4">
        {/* Gesamt */}
        <div className="flex items-end justify-between mb-1">
          <span className="text-3xl font-black text-matcha-700">{fmt(d.gesamt_eur)}</span>
          <span className={`text-sm font-bold flex items-center gap-1 ${trend.color}`}>
            <span>{trend.icon}</span>
            <span>{Math.abs(diff).toFixed(2).replace('.', ',')} € {trend.label}</span>
          </span>
        </div>
        <span className="text-xs text-gray-400">{d.touren_count} Touren heute</span>

        {/* Stacked bar */}
        <div className="mt-3 flex h-3 rounded-full overflow-hidden gap-px">
          {slices.map((s) => (
            <div
              key={s.label}
              className={`${s.color} transition-all duration-500`}
              style={{ width: `${d.gesamt_eur > 0 ? (s.value / d.gesamt_eur) * 100 : 0}%` }}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {slices.map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`w-2 h-2 rounded-full ${s.color}`} />
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
              <span className="text-sm font-bold text-gray-800">{fmt(s.value)}</span>
            </div>
          ))}
        </div>

        {/* Vortag vergleich */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-400">
          <span>Gestern: <span className="font-semibold text-gray-600">{fmt(d.vortag_gesamt_eur)}</span></span>
          <span className={`font-semibold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {diff >= 0 ? '+' : ''}{fmt(diff)}
          </span>
        </div>
      </div>
    </div>
  );
}
