'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, AlertTriangle, Target, Clock, Users, Euro, Star, Route, RefreshCw, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

/**
 * Phase 2800 — Statistiken Executive Dashboard
 *
 * 10 KPI-Kacheln Ampel + Δ% vs. Gestern
 * Gesamt-Score-Ring 0–100
 * Stundenverlauf-BarChart 2-Modi (Bestellungen/Umsatz)
 * Top-3-Fahrer Score-Badges
 * Zonen-SLA-Balken
 * Alert-Strip kritische KPIs
 * 60-Sek-Polling; Mock-Fallback
 */

interface KpiKachel {
  key: string;
  label: string;
  wert: number;
  einheit: string;
  delta_pct: number;
  ziel: number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
  invertiert: boolean;
}

interface StundenBucket {
  h: string;
  bestellungen: number;
  umsatz_eur: number;
  aktuell: boolean;
}

interface FahrerTop {
  name: string;
  score: number;
}

interface ZoneSla {
  zone: string;
  sla_pct: number;
  lieferungen: number;
}

interface ApiData {
  gesamt_score: number;
  insight_tipp: string;
  kpis: KpiKachel[];
  stunden: StundenBucket[];
  top_fahrer: FahrerTop[];
  zonen: ZoneSla[];
  alert_kpis: string[];
}

const MOCK: ApiData = {
  gesamt_score: 81,
  insight_tipp: 'Pünktlichkeit liegt 3% über Ziel — starke Schicht! Umsatz 8% über Vorjahr.',
  alert_kpis: ['Storno-Quote', 'Avg. Lieferzeit'],
  kpis: [
    { key: 'bestellungen',   label: 'Bestellungen',     wert: 127, einheit: '',    delta_pct: 12,  ziel: 120, ampel: 'gruen', invertiert: false },
    { key: 'umsatz',         label: 'Umsatz',           wert: 2840, einheit: '€',  delta_pct: 8,   ziel: 2500, ampel: 'gruen', invertiert: false },
    { key: 'lieferzeit',     label: 'Ø Lieferzeit',     wert: 28,  einheit: 'min', delta_pct: 4,   ziel: 30,   ampel: 'gelb',  invertiert: true  },
    { key: 'puenktlichkeit', label: 'Pünktlichkeit',    wert: 88,  einheit: '%',   delta_pct: 3,   ziel: 85,   ampel: 'gruen', invertiert: false },
    { key: 'bewertung',      label: 'Ø Bewertung',      wert: 4.4, einheit: '★',   delta_pct: 1,   ziel: 4.3,  ampel: 'gruen', invertiert: false },
    { key: 'fahrer_online',  label: 'Fahrer Online',    wert: 6,   einheit: '',    delta_pct: 0,   ziel: 6,    ampel: 'gruen', invertiert: false },
    { key: 'sla',            label: 'SLA-Rate',         wert: 91,  einheit: '%',   delta_pct: -1,  ziel: 95,   ampel: 'gelb',  invertiert: false },
    { key: 'storno',         label: 'Storno-Quote',     wert: 4.8, einheit: '%',   delta_pct: 1.2, ziel: 3,    ampel: 'rot',   invertiert: true  },
    { key: 'trinkgeld',      label: 'Ø Trinkgeld',      wert: 2.80,einheit: '€',   delta_pct: 5,   ziel: 2.5,  ampel: 'gruen', invertiert: false },
    { key: 'avg_lieferzeit', label: 'Avg. Lieferzeit',  wert: 32,  einheit: 'min', delta_pct: -3,  ziel: 28,   ampel: 'rot',   invertiert: true  },
  ],
  stunden: [
    { h: '11',  bestellungen: 4,  umsatz_eur: 89,   aktuell: false },
    { h: '12',  bestellungen: 18, umsatz_eur: 410,  aktuell: false },
    { h: '13',  bestellungen: 21, umsatz_eur: 490,  aktuell: false },
    { h: '14',  bestellungen: 14, umsatz_eur: 315,  aktuell: false },
    { h: '15',  bestellungen: 9,  umsatz_eur: 205,  aktuell: false },
    { h: '16',  bestellungen: 11, umsatz_eur: 258,  aktuell: false },
    { h: '17',  bestellungen: 15, umsatz_eur: 342,  aktuell: false },
    { h: '18',  bestellungen: 19, umsatz_eur: 431,  aktuell: false },
    { h: '19',  bestellungen: 16, umsatz_eur: 300,  aktuell: true  },
  ],
  top_fahrer: [
    { name: 'Lukas H.', score: 94 },
    { name: 'Sara M.',  score: 79 },
    { name: 'Tim B.',   score: 58 },
  ],
  zonen: [
    { zone: 'Mitte', sla_pct: 93, lieferungen: 42 },
    { zone: 'Nord',  sla_pct: 88, lieferungen: 31 },
    { zone: 'Süd',   sla_pct: 95, lieferungen: 28 },
    { zone: 'West',  sla_pct: 79, lieferungen: 26 },
  ],
};

const AMPEL: Record<'gruen' | 'gelb' | 'rot', { bg: string; text: string; dot: string; border: string }> = {
  gruen: { bg: 'bg-green-50 dark:bg-green-950',   text: 'text-green-700 dark:text-green-300',   dot: 'bg-green-500',  border: 'border-green-200 dark:border-green-800'  },
  gelb:  { bg: 'bg-yellow-50 dark:bg-yellow-950', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' },
  rot:   { bg: 'bg-red-50 dark:bg-red-950',       text: 'text-red-700 dark:text-red-300',       dot: 'bg-red-500',    border: 'border-red-300 dark:border-red-700'       },
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 65 ? '#eab308' : '#ef4444';
  const pct = score / 100;
  const r = 28;
  const circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="70" height="70" viewBox="0 0 70 70">
        <circle cx="35" cy="35" r={r} fill="none" strokeWidth="7" stroke="currentColor" className="text-muted" />
        <circle
          cx="35" cy="35" r={r} fill="none" strokeWidth="7"
          stroke={color} strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
          strokeDashoffset={circ * 0.25}
          transform="rotate(-90 35 35)"
        />
        <text x="35" y="39" textAnchor="middle" className="fill-foreground" fontSize="14" fontWeight="700">{score}</text>
      </svg>
      <span className="text-[10px] text-muted-foreground">Gesamt-Score</span>
    </div>
  );
}

export function LieferdienstPhase2800StatistikenExecutiveDashboard() {
  const [data, setData] = useState<ApiData>(MOCK);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const [loading, setLoading] = useState(false);
  const [useMock, setUseMock] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/lieferdienst/statistiken-executive', { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error();
      const d = await res.json();
      if (d?.kpis) { setData(d); setUseMock(false); }
    } catch {
      setUseMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const iv = setInterval(fetchData, 60_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const chartData = data.stunden.map(s => ({
    h: `${s.h}h`,
    wert: chartMode === 'bestellungen' ? s.bestellungen : s.umsatz_eur,
    aktuell: s.aktuell,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold">Executive Dashboard</span>
          {useMock && <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">Demo</span>}
        </div>
        <button onClick={fetchData} className="text-muted-foreground hover:text-foreground">
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Alert-Strip */}
      {data.alert_kpis.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-300 font-medium">
            Kritisch: {data.alert_kpis.join(', ')}
          </span>
        </div>
      )}

      {/* Score + Insight */}
      <div className="flex items-center gap-4">
        <ScoreRing score={data.gesamt_score} />
        <div className="flex-1">
          <div className="flex items-start gap-1.5 bg-muted/50 rounded-lg p-2.5">
            <Zap className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">{data.insight_tipp}</p>
          </div>
        </div>
      </div>

      {/* KPI-Grid 2-spaltig */}
      <div className="grid grid-cols-2 gap-2">
        {data.kpis.map(kpi => {
          const cfg = AMPEL[kpi.ampel];
          const isPositiveDelta = kpi.invertiert ? kpi.delta_pct <= 0 : kpi.delta_pct >= 0;
          return (
            <div key={kpi.key} className={`rounded-lg border p-2.5 ${cfg.bg} ${cfg.border}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  <span className="text-[10px] text-muted-foreground">{kpi.label}</span>
                </div>
                <div className={`flex items-center gap-0.5 text-[10px] font-medium ${isPositiveDelta ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositiveDelta ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {kpi.delta_pct > 0 ? '+' : ''}{kpi.delta_pct}%
                </div>
              </div>
              <div className={`text-xl font-bold tabular-nums ${cfg.text}`}>
                {typeof kpi.wert === 'number' && kpi.wert % 1 !== 0 ? kpi.wert.toFixed(kpi.einheit === '€' ? 2 : 1) : kpi.wert}{kpi.einheit}
              </div>
              {kpi.ziel !== null && (
                <div className="text-[10px] text-muted-foreground">Ziel: {kpi.ziel}{kpi.einheit}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Stundenverlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz'] as const).map(m => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${chartMode === m ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={chartData} barSize={20}>
            <XAxis dataKey="h" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={((val: number) => [chartMode === 'umsatz' ? `€${val.toFixed(0)}` : val, '']) as any}
              contentStyle={{ fontSize: 10, padding: '2px 6px' }}
            />
            <Bar dataKey="wert" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.aktuell ? '#6366f1' : '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top-Fahrer */}
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2">Top-Fahrer</div>
        <div className="grid grid-cols-3 gap-2">
          {data.top_fahrer.map((f, idx) => {
            const medals = ['🥇', '🥈', '🥉'];
            const scoreColor = f.score >= 85 ? 'text-green-600' : f.score >= 70 ? 'text-yellow-600' : 'text-red-600';
            return (
              <div key={f.name} className="flex flex-col items-center rounded-lg bg-muted/50 p-2 gap-0.5">
                <span className="text-base">{medals[idx]}</span>
                <span className="text-xs font-medium truncate w-full text-center">{f.name}</span>
                <span className={`text-lg font-bold tabular-nums ${scoreColor}`}>{f.score}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zonen-SLA */}
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2">Zonen-SLA</div>
        <div className="space-y-1.5">
          {data.zonen.map(z => {
            const slaColor = z.sla_pct >= 90 ? 'bg-green-500' : z.sla_pct >= 80 ? 'bg-yellow-400' : 'bg-red-500';
            return (
              <div key={z.zone} className="flex items-center gap-2">
                <span className="text-xs w-10 text-muted-foreground flex-shrink-0">{z.zone}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${slaColor}`} style={{ width: `${z.sla_pct}%` }} />
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground w-10 text-right">{z.sla_pct}%</span>
                <span className="text-[10px] text-muted-foreground w-8 text-right">{z.lieferungen}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
