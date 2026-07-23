'use client';

import { useState, useEffect } from 'react';
import { BarChart2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, AlertTriangle, Activity } from 'lucide-react';

interface KpiProfi {
  label: string;
  wert: number | string;
  einheit: string;
  trend: 'up' | 'down' | 'neutral';
  delta_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  inverted: boolean;
  ziel: string;
}

interface ApiData {
  kpis: KpiProfi[];
  gesamt_score: number;
  alert_kpis: string[];
  schicht_vergleich: { label: string; heute: number; vorwoche: number }[];
  top_insight: string;
}

const MOCK: ApiData = {
  gesamt_score: 81,
  alert_kpis: ['Storno-Quote'],
  top_insight: 'Pünktlichkeit +7% gegenüber Vorwoche — starke Schicht bisher!',
  kpis: [
    { label: 'Ø Lieferzeit',   wert: 24,   einheit: 'Min',   trend: 'down',    delta_pct: -11, ampel: 'gruen', inverted: true,  ziel: '≤30 Min' },
    { label: 'Pünktlichkeit',  wert: 87,   einheit: '%',     trend: 'up',      delta_pct: +7,  ampel: 'gruen', inverted: false, ziel: '≥85%' },
    { label: 'Storno-Quote',   wert: 4.8,  einheit: '%',     trend: 'up',      delta_pct: +20, ampel: 'rot',   inverted: true,  ziel: '≤3%' },
    { label: 'Ø Bewertung',    wert: 4.6,  einheit: '★',     trend: 'neutral', delta_pct: 0,   ampel: 'gelb',  inverted: false, ziel: '≥4.5' },
    { label: 'Umsatz/Stunde',  wert: 680,  einheit: '€',     trend: 'up',      delta_pct: +9,  ampel: 'gruen', inverted: false, ziel: '≥600€' },
    { label: 'SLA-Einhaltung', wert: 92,   einheit: '%',     trend: 'up',      delta_pct: +3,  ampel: 'gruen', inverted: false, ziel: '≥90%' },
  ],
  schicht_vergleich: [
    { label: 'Touren',     heute: 24, vorwoche: 20 },
    { label: 'Stopps',     heute: 87, vorwoche: 79 },
    { label: 'Umsatz (k€)',heute: 5.4, vorwoche: 4.8 },
    { label: 'On-Time%',   heute: 87, vorwoche: 80 },
  ],
};

const AMPEL_COLORS: Record<string, string> = {
  gruen: 'text-emerald-600 dark:text-emerald-400',
  gelb:  'text-yellow-600 dark:text-yellow-400',
  rot:   'text-red-600 dark:text-red-400',
};
const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  gelb:  'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  rot:   'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
};

function GesScoreRing({ score }: { score: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 28 28)" />
      <text x="28" y="33" textAnchor="middle" style={{ fontSize: 13, fontWeight: 800, fill: color }}>{score}</text>
    </svg>
  );
}

export function LieferdienstPhase2705StatistikenProfiDashboard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData>(MOCK);

  useEffect(() => {
    const load = async () => {
      if (!locationId) return;
      try {
        const r = await fetch(`/api/delivery/admin/schicht-statistiken?location_id=${locationId}`, { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch {}
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Activity className="w-4 h-4 text-indigo-500" />
          Statistiken Profi Dashboard
          {data.alert_kpis.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-bold">
              {data.alert_kpis.length} ⚠
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Score + Insight */}
          <div className="flex items-center gap-3">
            <GesScoreRing score={data.gesamt_score} />
            <div className="flex-1">
              <div className="text-[10px] text-gray-400 uppercase mb-0.5">Schicht-Insight</div>
              <p className="text-xs text-gray-700 dark:text-gray-300 italic">{data.top_insight}</p>
            </div>
          </div>

          {/* Alert */}
          {data.alert_kpis.length > 0 && (
            <div className="flex items-center gap-1.5 p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs border border-red-200">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Kritische KPIs: {data.alert_kpis.join(', ')}
            </div>
          )}

          {/* KPI-Kacheln */}
          <div className="grid grid-cols-2 gap-2">
            {data.kpis.map(k => {
              const positiv = k.inverted ? k.trend === 'down' : k.trend === 'up';
              const negativ  = k.inverted ? k.trend === 'up'   : k.trend === 'down';
              return (
                <div key={k.label} className={`border rounded-lg p-2 ${AMPEL_BG[k.ampel]}`}>
                  <div className="text-[10px] text-gray-500 truncate">{k.label}</div>
                  <div className={`text-base font-bold font-mono ${AMPEL_COLORS[k.ampel]}`}>
                    {k.wert}{k.einheit}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className={`text-[10px] flex items-center gap-0.5 ${positiv ? 'text-emerald-600' : negativ ? 'text-red-600' : 'text-gray-400'}`}>
                      {positiv ? <TrendingUp className="w-2.5 h-2.5" /> : negativ ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                      {k.delta_pct > 0 ? '+' : ''}{k.delta_pct}%
                    </span>
                    <span className="text-[9px] text-gray-400">{k.ziel}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Schicht-Vergleich */}
          <div>
            <div className="text-[10px] text-gray-400 uppercase mb-1.5">Heute vs. Vorwoche</div>
            <div className="space-y-1.5">
              {data.schicht_vergleich.map(sv => {
                const max = Math.max(sv.heute, sv.vorwoche, 1);
                const heuteW = (sv.heute / max) * 100;
                const vwW = (sv.vorwoche / max) * 100;
                const besser = sv.heute >= sv.vorwoche;
                return (
                  <div key={sv.label} className="space-y-0.5">
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>{sv.label}</span>
                      <span className={besser ? 'text-emerald-600' : 'text-red-600'}>
                        {sv.heute} {besser ? '↑' : '↓'} {sv.vorwoche}
                      </span>
                    </div>
                    <div className="flex gap-0.5 h-1.5">
                      <div style={{ width: `${heuteW}%` }} className={`rounded-full ${besser ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
