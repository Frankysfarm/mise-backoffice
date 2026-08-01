'use client';

import { useEffect, useRef, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, AlertTriangle, Leaf, Route, Zap, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 5557 — Score + Tour-Visualisierung V45
// Trophy violet; V44+: Fahrer-Compliance-Trend Sparkline je Fahrer; Energie-Niveau-Indikator Schichtdauer-basiert;
// Eco-Effizienz-Score g CO₂/Lieferung je Fahrer; Tour-Abschluss-Wahrscheinlichkeit KI %;
// 13-KPI-Grid Fleet/Aktiv/Risiko/Eff%/Sync/CO₂/Ertrag/Energie/Bindung/Pünktl/Qualität/Compliance/Abschluss;
// 9-Tab Rangliste/Profit/Energie/Lücken/CO₂/Bindung/Abschluss/Compliance/Wellbeing;
// 20s-Polling; Mock-Fallback

type Tab = 'rangliste' | 'profit' | 'energie' | 'luecken' | 'co2' | 'bindung' | 'abschluss' | 'compliance' | 'wellbeing';
type Tier = 'platin' | 'gold' | 'gut' | 'schwach';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  score: number;
  score_delta: number;
  tier: Tier;
  delay_risiko: boolean;
  eff_pct: number;
  co2_g: number;
  energie_pct: number;
  compliance: number;
  abschluss_prob: number;
  profit_stop: number;
  kundenbindung: number;
  sparkline: number[];
}

interface ApiResponse {
  fahrer: FahrerRow[];
  fleet_score: number;
  aktiv: number;
  risiko: number;
  eff_pct: number;
  sync: number;
  co2_avg: number;
  ertrag: number;
  energie_avg: number;
  bindung: number;
  puenktlichkeit: number;
  qualitaet: number;
  compliance_avg: number;
  abschluss_prob_avg: number;
  alert_count: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, score: 94, score_delta: 3, tier: 'platin', delay_risiko: false, eff_pct: 96, co2_g: 42, energie_pct: 88, compliance: 98, abschluss_prob: 97, profit_stop: 4.80, kundenbindung: 82, sparkline: [88, 90, 91, 93, 94] },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, score: 88, score_delta: 1, tier: 'gold',   delay_risiko: false, eff_pct: 90, co2_g: 51, energie_pct: 72, compliance: 93, abschluss_prob: 91, profit_stop: 4.20, kundenbindung: 74, sparkline: [84, 85, 87, 87, 88] },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, score: 76, score_delta: -2, tier: 'gut',   delay_risiko: true,  eff_pct: 78, co2_g: 68, energie_pct: 54, compliance: 81, abschluss_prob: 78, profit_stop: 3.50, kundenbindung: 61, sparkline: [79, 78, 77, 76, 76] },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, score: 61, score_delta: 0,  tier: 'schwach', delay_risiko: true, eff_pct: 63, co2_g: 84, energie_pct: 31, compliance: 70, abschluss_prob: 62, profit_stop: 2.90, kundenbindung: 48, sparkline: [63, 62, 61, 61, 61] },
  ],
  fleet_score: 80, aktiv: 4, risiko: 2, eff_pct: 82, sync: 87, co2_avg: 61, ertrag: 3.85,
  energie_avg: 61, bindung: 66, puenktlichkeit: 88, qualitaet: 84, compliance_avg: 86, abschluss_prob_avg: 82, alert_count: 2,
};

function tierBadge(tier: Tier): string {
  if (tier === 'platin') return 'bg-cyan-900/50 text-cyan-300 border-cyan-700/50';
  if (tier === 'gold')   return 'bg-yellow-900/50 text-yellow-300 border-yellow-700/50';
  if (tier === 'gut')    return 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50';
  return 'bg-red-900/30 text-red-400 border-red-700/30';
}

function tierLabel(tier: Tier): string {
  if (tier === 'platin') return '✦ Platin';
  if (tier === 'gold')   return '★ Gold';
  if (tier === 'gut')    return '✓ Gut';
  return '↓ Schwach';
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 40;
  const h = 14;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  const trend = values[values.length - 1] - values[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={trend >= 0 ? '#34d399' : '#f87171'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DispatchPhase5557ScoreTourVisualisierungV45({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tab, setTab] = useState<Tab>('rangliste');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-score-tour?location_id=${locationId}&v=45`);
      if (r.ok) setData(await r.json());
    } catch { /* mock */ }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 20_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'rangliste', label: 'Rangliste' },
    { key: 'profit', label: 'Profit' },
    { key: 'energie', label: 'Energie' },
    { key: 'luecken', label: 'Lücken' },
    { key: 'co2', label: 'CO₂' },
    { key: 'bindung', label: 'Bindung' },
    { key: 'abschluss', label: 'Abschluss' },
    { key: 'compliance', label: 'Compliance' },
    { key: 'wellbeing', label: 'Wellbeing' },
  ];

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/40 bg-gray-800/60">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Score & Tour V45</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Fleet</span>
          <span className="text-sm font-bold text-violet-300">{data.fleet_score}</span>
        </div>
      </div>

      {/* 13-KPI-Grid */}
      <div className="grid grid-cols-5 gap-px bg-gray-700/30 border-b border-gray-700/40">
        {[
          ['Aktiv', data.aktiv, 'text-white'],
          ['Risiko', data.risiko, 'text-red-400'],
          ['Eff%', `${data.eff_pct}%`, 'text-emerald-400'],
          ['Sync', data.sync, 'text-violet-400'],
          ['CO₂', `${data.co2_avg}g`, 'text-teal-400'],
          ['€/Stop', `${data.ertrag.toFixed(2)}`, 'text-yellow-300'],
          ['Energie', `${data.energie_avg}%`, 'text-orange-400'],
          ['Bindung', `${data.bindung}%`, 'text-rose-400'],
          ['Pünktl', `${data.puenktlichkeit}%`, 'text-sky-400'],
          ['Qualität', data.qualitaet, 'text-indigo-400'],
          ['Comply', `${data.compliance_avg}%`, 'text-purple-400'],
          ['Abschl', `${data.abschluss_prob_avg}%`, 'text-cyan-400'],
          ['Fleet', data.fleet_score, 'text-violet-300'],
        ].map(([label, val, cls]) => (
          <div key={String(label)} className="bg-gray-900 px-2 py-1.5 text-center">
            <div className={cn('text-xs font-semibold tabular-nums', cls as string)}>{val}</div>
            <div className="text-[9px] text-gray-500 truncate">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-700/40 bg-gray-800/40 scrollbar-hide">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-1.5 text-[10px] font-medium whitespace-nowrap shrink-0 transition-colors',
              tab === t.key ? 'text-violet-300 border-b-2 border-violet-400 bg-gray-800' : 'text-gray-500 hover:text-gray-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {tab === 'rangliste' && data.fahrer.map(f => (
          <div key={f.fahrer_id} className="rounded-lg bg-gray-800/50 px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 w-4">{f.rang}.</span>
              <span className="text-xs font-semibold text-white flex-1 truncate">{f.fahrer_name}</span>
              <span className={cn('text-[9px] px-1.5 py-0.5 rounded border', tierBadge(f.tier))}>{tierLabel(f.tier)}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="w-full h-1.5 bg-gray-700 rounded-full">
                  <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${f.score}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-white font-mono">{f.score}</div>
              <div className="flex items-center gap-0.5">
                {f.score_delta > 0 ? <TrendingUp className="h-3 w-3 text-green-400" /> :
                 f.score_delta < 0 ? <TrendingDown className="h-3 w-3 text-red-400" /> :
                 <Minus className="h-3 w-3 text-gray-500" />}
              </div>
              <Sparkline values={f.sparkline} />
            </div>
            {f.delay_risiko && (
              <div className="flex items-center gap-1 text-[9px] text-amber-400">
                <AlertTriangle className="h-2.5 w-2.5" /> Verzögerungs-Risiko
              </div>
            )}
          </div>
        ))}

        {tab === 'energie' && (
          <div className="space-y-2">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-3 rounded-lg bg-gray-800/50 px-3 py-2">
                <Zap className={cn('h-3.5 w-3.5 shrink-0', f.energie_pct >= 70 ? 'text-emerald-400' : f.energie_pct >= 40 ? 'text-amber-400' : 'text-red-400')} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white">{f.fahrer_name}</div>
                  <div className="w-full h-1.5 bg-gray-700 rounded-full mt-1">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${f.energie_pct}%`, backgroundColor: f.energie_pct >= 70 ? '#34d399' : f.energie_pct >= 40 ? '#fbbf24' : '#f87171' }}
                    />
                  </div>
                </div>
                <span className="text-xs font-mono text-white">{f.energie_pct}%</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'co2' && (
          <div className="space-y-2">
            {[...data.fahrer].sort((a, b) => a.co2_g - b.co2_g).map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-3 rounded-lg bg-gray-800/50 px-3 py-2">
                <Leaf className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                <span className="text-xs text-white flex-1">{f.fahrer_name}</span>
                <span className={cn('text-xs font-mono', f.co2_g <= 50 ? 'text-teal-400' : f.co2_g <= 70 ? 'text-amber-400' : 'text-red-400')}>
                  {f.co2_g}g CO₂/Lief.
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === 'compliance' && (
          <div className="space-y-2">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-3 rounded-lg bg-gray-800/50 px-3 py-2">
                <Shield className={cn('h-3.5 w-3.5 shrink-0', f.compliance >= 90 ? 'text-emerald-400' : f.compliance >= 75 ? 'text-amber-400' : 'text-red-400')} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white">{f.fahrer_name}</div>
                  <div className="w-full h-1.5 bg-gray-700 rounded-full mt-1">
                    <div className="h-full rounded-full bg-purple-500" style={{ width: `${f.compliance}%` }} />
                  </div>
                </div>
                <span className="text-xs font-mono text-purple-300">{f.compliance}%</span>
              </div>
            ))}
          </div>
        )}

        {(tab === 'profit' || tab === 'luecken' || tab === 'bindung' || tab === 'abschluss' || tab === 'wellbeing') && (
          <div className="space-y-2">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-3 rounded-lg bg-gray-800/50 px-3 py-2">
                <Route className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                <span className="text-xs text-white flex-1">{f.fahrer_name}</span>
                <div className="text-right text-xs font-mono">
                  {tab === 'profit' && <span className="text-yellow-300">{f.profit_stop.toFixed(2)} €/Stop</span>}
                  {tab === 'bindung' && <span className="text-rose-300">{f.kundenbindung}%</span>}
                  {tab === 'abschluss' && <span className="text-cyan-300">{f.abschluss_prob}%</span>}
                  {tab === 'wellbeing' && <span className="text-orange-300">{f.energie_pct}% Energie</span>}
                  {tab === 'luecken' && <span className="text-sky-300">{(100 - f.eff_pct)}% Lücke</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/40 border-t border-amber-800/30">
          <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
          <span className="text-[10px] text-amber-300">{data.alert_count} Fahrer mit Risiko-Alarm</span>
        </div>
      )}
    </div>
  );
}
