'use client';

import React, { useEffect, useState } from 'react';

interface FahrerScore {
  driver_id: string;
  fahrer_name: string;
  stopps_pro_h: number;
  puenktlichkeit_pct: number;
  trinkgeld_pro_stopp: number;
  gesamt_score: number;
  vorwoche_score: number | null;
  trend: 'up' | 'gleich' | 'down';
  status: 'top' | 'normal' | 'schwach';
  stopps_heute: number;
}

interface ApiResponse {
  fahrer: FahrerScore[];
  team_durchschnitt: number;
}

const STATUS_CONFIG = {
  top: { color: 'text-emerald-700', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', label: 'Top' },
  normal: { color: 'text-amber-700', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700', label: 'Normal' },
  schwach: { color: 'text-rose-700', bg: 'bg-rose-50', badge: 'bg-rose-100 text-rose-700', label: 'Schwach' },
};

const TREND_ICONS = { up: '▲', gleich: '→', down: '▼' };
const TREND_COLORS = { up: 'text-emerald-600', gleich: 'text-stone-400', down: 'text-rose-600' };

interface Props {
  locationId?: string | null;
}

export function DispatchPhase1559SchichtProduktivitaetsScoreWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const url = `/api/delivery/admin/schicht-produktivitaets-score${locationId ? `?location_id=${locationId}` : ''}`;
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
      <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2 animate-pulse">
        <div className="h-4 w-48 bg-stone-100 rounded" />
        {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-stone-100 rounded-xl" />)}
      </div>
    );
  }

  if (!data || data.fahrer.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3 border-b border-stone-100 hover:bg-stone-50 transition-colors"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-char">Schicht-Produktivitäts-Score</span>
          <span className="text-[11px] bg-stone-100 text-stone-500 rounded-full px-2 py-0.5 font-semibold">
            Ø {data.team_durchschnitt} Pkt.
          </span>
        </div>
        <span className="text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="divide-y divide-stone-50">
          {data.fahrer.map((f, i) => {
            const cfg = STATUS_CONFIG[f.status];
            return (
              <div key={f.driver_id} className={`flex items-center gap-3 px-5 py-3 ${cfg.bg}`}>
                <span className="text-xs font-black text-stone-400 w-5 text-right">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-stone-800 truncate">{f.fahrer_name}</span>
                    <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${cfg.badge}`}>{cfg.label}</span>
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    {f.stopps_heute} Stopps · {f.stopps_pro_h}/h · {f.puenktlichkeit_pct}% pünktlich
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-lg font-black tabular-nums ${cfg.color}`}>{f.gesamt_score}</div>
                  <div className={`text-[11px] font-semibold ${TREND_COLORS[f.trend]}`}>
                    {TREND_ICONS[f.trend]} {f.vorwoche_score !== null ? `VW: ${f.vorwoche_score}` : '—'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
