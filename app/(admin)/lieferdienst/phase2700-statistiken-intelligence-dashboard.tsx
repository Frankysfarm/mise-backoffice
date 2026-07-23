'use client';

import { useState, useEffect } from 'react';
import { BarChart2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, AlertTriangle, Zap } from 'lucide-react';

interface KpiKachel {
  label: string;
  wert: string | number;
  einheit: string;
  trend: 'up' | 'down' | 'neutral';
  delta_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  inverted: boolean;
}

interface ApiData {
  kpis: KpiKachel[];
  top_insight: string;
  alert_kpis: string[];
  gesamt_score: number;
  zuletzt_aktualisiert: string;
}

const MOCK: ApiData = {
  gesamt_score: 76,
  top_insight: 'Lieferzeit um 12% verbessert — weiter so! Storno-Quote leicht erhöht, prüfen.',
  alert_kpis: ['Storno-Quote'],
  zuletzt_aktualisiert: new Date().toISOString(),
  kpis: [
    { label: 'Touren heute',      wert: 22,    einheit: '',       trend: 'up',      delta_pct: +8,   ampel: 'gruen', inverted: false },
    { label: 'Ø Lieferzeit',      wert: 27,    einheit: 'Min',    trend: 'down',    delta_pct: -12,  ampel: 'gruen', inverted: true  },
    { label: 'Pünktlichkeit',     wert: 83,    einheit: '%',      trend: 'up',      delta_pct: +5,   ampel: 'gruen', inverted: false },
    { label: 'Storno-Quote',      wert: 4.2,   einheit: '%',      trend: 'up',      delta_pct: +18,  ampel: 'rot',   inverted: true  },
    { label: 'Ø Bewertung',       wert: 4.5,   einheit: '★',      trend: 'neutral', delta_pct: 0,    ampel: 'gelb',  inverted: false },
    { label: 'Umsatz heute',      wert: 5840,  einheit: '€',      trend: 'up',      delta_pct: +14,  ampel: 'gruen', inverted: false },
    { label: 'Aktive Fahrer',     wert: 6,     einheit: '',       trend: 'neutral', delta_pct: 0,    ampel: 'gelb',  inverted: false },
    { label: 'Ø Trinkgeld',       wert: 1.20,  einheit: '€/Stopp',trend: 'up',      delta_pct: +9,   ampel: 'gruen', inverted: false },
    { label: 'Leerfahrten',       wert: 2,     einheit: '',       trend: 'down',    delta_pct: -33,  ampel: 'gruen', inverted: true  },
    { label: 'SLA-Einhaltung',    wert: 91,    einheit: '%',      trend: 'up',      delta_pct: +3,   ampel: 'gruen', inverted: false },
  ],
};

const AMPEL_COLORS: Record<string, string> = {
  gruen: 'text-emerald-600 dark:text-emerald-400',
  gelb:  'text-yellow-600 dark:text-yellow-400',
  rot:   'text-red-600 dark:text-red-400',
};
const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800',
  gelb:  'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800',
  rot:   'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800',
};

function TrendIcon({ trend, inverted }: { trend: KpiKachel['trend']; inverted: boolean }) {
  const positive = inverted ? trend === 'down' : trend === 'up';
  const negative = inverted ? trend === 'up' : trend === 'down';
  if (positive) return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (negative) return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function GesDesamtRing({ score }: { score: number }) {
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
      <text x="28" y="32" textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: color }}>{score}</text>
    </svg>
  );
}

export function LieferdienstPhase2700StatistikenIntelligenceDashboard({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData>(MOCK);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const r = await fetch(`/api/delivery/admin/statistiken-intelligence?location_id=${locationId}`, { cache: 'no-store' });
        if (r.ok && active) setData(await r.json());
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 60 * 1000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;
  const alertKpis = d.kpis.filter(k => k.ampel === 'rot');

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <BarChart2 className="w-4 h-4 text-indigo-500" />
          Statistiken Intelligence Dashboard
          {alertKpis.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold">
              {alertKpis.length} Alert{alertKpis.length > 1 ? 's' : ''}
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Header: Score + Insight */}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
            <GesDesamtRing score={d.gesamt_score} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide font-bold mb-0.5">Gesamt-Score Heute</div>
              <div className="flex items-start gap-1 text-[11px] text-gray-600 dark:text-gray-300">
                <Zap className="w-3 h-3 text-indigo-400 mt-px flex-shrink-0" />
                <span>{d.top_insight}</span>
              </div>
            </div>
          </div>

          {/* Alert Strip */}
          {alertKpis.length > 0 && (
            <div className="flex items-center gap-1.5 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-bold">Kritisch:</span>
              <span>{alertKpis.map(k => k.label).join(', ')}</span>
            </div>
          )}

          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {d.kpis.map(kpi => (
              <div
                key={kpi.label}
                className={`border rounded-lg p-2 ${AMPEL_BG[kpi.ampel]}`}
              >
                <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5 truncate">{kpi.label}</div>
                <div className={`text-sm font-bold ${AMPEL_COLORS[kpi.ampel]}`}>
                  {typeof kpi.wert === 'number' && !Number.isInteger(kpi.wert)
                    ? kpi.wert.toFixed(1)
                    : kpi.wert}
                  <span className="text-[10px] font-normal ml-0.5">{kpi.einheit}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <TrendIcon trend={kpi.trend} inverted={kpi.inverted} />
                  {kpi.delta_pct !== 0 && (
                    <span className={`text-[9px] font-bold tabular-nums ${
                      (kpi.inverted ? kpi.delta_pct < 0 : kpi.delta_pct > 0) ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {kpi.delta_pct > 0 ? '+' : ''}{kpi.delta_pct}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="text-[9px] text-gray-400 text-right">
            Aktualisiert: {new Date(d.zuletzt_aktualisiert).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 1-Min-Polling
          </div>
        </div>
      )}
    </div>
  );
}
