'use client';

import React, { useEffect, useState } from 'react';

interface Kpis {
  puenktlichkeit_pct: number;
  kundenbewertung_avg: number;
  storno_rate_pct: number;
  vollstaendigkeit_pct: number;
}

interface ApiResponse {
  index: number;
  trend_vs_7tage: number;
  status: 'excellent' | 'gut' | 'mittel' | 'kritisch';
  kpis: Kpis;
}

const STATUS_CONFIG = {
  excellent: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', gauge: '#4ade80', label: 'Excellent' },
  gut: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', gauge: '#60a5fa', label: 'Gut' },
  mittel: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', gauge: '#fbbf24', label: 'Mittel' },
  kritisch: { color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', gauge: '#f87171', label: 'Kritisch' },
};

const GAUGE_R = 36;
const GAUGE_CIRC = 2 * Math.PI * GAUGE_R;

interface Props {
  locationId?: string | null;
}

export function DispatchPhase1564LieferQualitaetsIndexWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const url = `/api/delivery/admin/liefer-qualitaets-index${locationId ? `?location_id=${locationId}` : ''}`;
        const res = await fetch(url);
        if (res.ok) setData(await res.json());
      } catch {}
      finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 10 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse space-y-2">
        <div className="h-4 w-48 bg-stone-100 rounded" />
        <div className="h-20 bg-stone-100 rounded-xl" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-8 bg-stone-100 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const cfg = STATUS_CONFIG[data.status];
  const pct = data.index / 100;
  const dash = pct * GAUGE_CIRC;
  const trendIcon = data.trend_vs_7tage > 0 ? '▲' : data.trend_vs_7tage < 0 ? '▼' : '→';
  const trendCol = data.trend_vs_7tage > 0 ? 'text-emerald-600' : data.trend_vs_7tage < 0 ? 'text-rose-600' : 'text-stone-400';

  return (
    <div className={`rounded-2xl border ${cfg.bg} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-bold uppercase tracking-wide ${cfg.color}`}>Liefer-Qualitäts-Index</p>
        <button onClick={() => setOpen((o) => !o)} className="text-stone-400 hover:text-stone-600 text-xs">
          {open ? '▲' : '▼'}
        </button>
      </div>

      {open && (
        <>
          <div className="flex items-center gap-4">
            <svg width={88} height={88} className="shrink-0">
              <circle cx={44} cy={44} r={GAUGE_R} fill="none" stroke="#e7e5e4" strokeWidth={10} />
              <circle
                cx={44} cy={44} r={GAUGE_R}
                fill="none" stroke={cfg.gauge} strokeWidth={10}
                strokeDasharray={`${dash} ${GAUGE_CIRC - dash}`}
                strokeLinecap="round"
                transform="rotate(-90 44 44)"
              />
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize={22} fontWeight={700} fill={cfg.gauge}>
                {data.index}
              </text>
            </svg>
            <div>
              <p className={`text-lg font-bold ${cfg.color}`}>{cfg.label}</p>
              <p className={`text-sm font-medium ${trendCol}`}>
                {trendIcon} {Math.abs(data.trend_vs_7tage)} Pkt. vs. 7-Tage-Ø
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/60 rounded-xl p-2">
              <p className="text-stone-500">Pünktlichkeit</p>
              <p className={`font-bold text-sm ${cfg.color}`}>{data.kpis.puenktlichkeit_pct}%</p>
            </div>
            <div className="bg-white/60 rounded-xl p-2">
              <p className="text-stone-500">Ø Bewertung</p>
              <p className={`font-bold text-sm ${cfg.color}`}>★ {data.kpis.kundenbewertung_avg.toFixed(1)}</p>
            </div>
            <div className="bg-white/60 rounded-xl p-2">
              <p className="text-stone-500">Storno-Rate</p>
              <p className="font-bold text-sm text-rose-700">{data.kpis.storno_rate_pct}%</p>
            </div>
            <div className="bg-white/60 rounded-xl p-2">
              <p className="text-stone-500">Vollständigkeit</p>
              <p className={`font-bold text-sm ${cfg.color}`}>{data.kpis.vollstaendigkeit_pct}%</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
