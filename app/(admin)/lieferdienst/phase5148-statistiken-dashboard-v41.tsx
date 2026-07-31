'use client';

import { useEffect, useState } from 'react';
import {
  Activity, TrendingUp, TrendingDown, Clock,
  Euro, Users, AlertTriangle, CheckCircle2, BarChart3,
  RefreshCw, Heart, Target, Star,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LineChart, Line, YAxis, Cell } from 'recharts';

// Phase 5148 — Statistiken-Dashboard V41
// Neu: Kundenbindungs-Analyse (Wiederkauf-Rate, LTV, Churn-Alert);
// Stammkunden- vs. Neukunden-Split; Lieblingsprodukt-Trend;
// 9-KPI-Grid 3-spaltig; 5-Tab-Nav Überblick/Stammkunden/Zonen/Stunden/Alerts;
// 60s-Polling; Mock-Fallback

type Tab = 'ueberblick' | 'stammkunden' | 'zonen' | 'stunden' | 'alerts';

interface KpiItem { key: string; label: string; value: string | number; delta: number; status: 'ok' | 'warn' | 'alert' }
interface AlertItem { id: string; level: 'info' | 'warn' | 'critical'; text: string; zeit: string }
interface ZoneData { name: string; sla_pct: number; avg_min: number; umsatz: number; fahrer: number }
interface StundenData { h: string; bestellungen: number; stammkunden_pct: number }
interface KundenSegment {
  name: string;
  anteil_pct: number;
  avg_ltv: number;
  wiederkauf_rate: number;
  avg_bestellungen: number;
  color: string;
}
interface ScoreTrend { h: string; score: number }

interface DashboardData {
  gesamt_score: number;
  kundenbindungs_score: number;
  umsatz_heute: number;
  wiederkauf_rate_gesamt: number;
  avg_ltv: number;
  churn_alert: boolean;
  kpis: KpiItem[];
  alerts: AlertItem[];
  zonen: ZoneData[];
  stunden: StundenData[];
  segmente: KundenSegment[];
  score_trend: ScoreTrend[];
}

const MOCK: DashboardData = {
  gesamt_score: 88,
  kundenbindungs_score: 76,
  umsatz_heute: 3820,
  wiederkauf_rate_gesamt: 64,
  avg_ltv: 148,
  churn_alert: true,
  score_trend: [
    { h: '16', score: 81 }, { h: '17', score: 84 }, { h: '18', score: 86 },
    { h: '19', score: 88 }, { h: '20', score: 88 }, { h: '21', score: 91 },
  ],
  kpis: [
    { key: 'umsatz',      label: 'Umsatz heute',      value: '€ 3.820', delta: 9.4,  status: 'ok'   },
    { key: 'orders',      label: 'Bestellungen',       value: 121,        delta: 13.2, status: 'ok'   },
    { key: 'sla',         label: 'SLA-Einhaltung',     value: '89%',      delta: -1.2, status: 'warn' },
    { key: 'avg_min',     label: 'Ø Lieferzeit',        value: '24 Min',   delta: -1.8, status: 'ok'   },
    { key: 'fahrer',      label: 'Aktive Fahrer',        value: 10,         delta: 2,    status: 'ok'   },
    { key: 'wiederkauf',  label: 'Wiederkauf-Rate',    value: '64%',      delta: 2.1,  status: 'ok'   },
    { key: 'ltv',         label: 'Ø Kunden-LTV',        value: '€ 148',   delta: 4.8,  status: 'ok'   },
    { key: 'storno',      label: 'Storno-Rate',         value: '1.4%',    delta: -0.3, status: 'ok'   },
    { key: 'trinkgeld',   label: 'Ø Trinkgeld',         value: '€ 3.10',  delta: 6.2,  status: 'ok'   },
  ],
  alerts: [
    { id: 'a1', level: 'warn',     text: 'Churn-Risiko: 18 Stammkunden seit 14+ Tagen inaktiv', zeit: '20:10' },
    { id: 'a2', level: 'info',     text: 'Neukunden-Anteil 36% — über Wochendurchschnitt',        zeit: '19:50' },
    { id: 'a3', level: 'critical', text: 'Zone Süd SLA 64% — kritisch unter Ziel',                zeit: '19:30' },
  ],
  segmente: [
    { name: 'Stammkunden',   anteil_pct: 64, avg_ltv: 210, wiederkauf_rate: 88, avg_bestellungen: 14, color: '#6366f1' },
    { name: 'Gelegenheits',  anteil_pct: 22, avg_ltv:  80, wiederkauf_rate: 42, avg_bestellungen:  4, color: '#22c55e' },
    { name: 'Neukunden',     anteil_pct: 14, avg_ltv:  28, wiederkauf_rate: 18, avg_bestellungen:  1, color: '#f59e0b' },
  ],
  zonen: [
    { name: 'Mitte',  sla_pct: 94, avg_min: 21, umsatz: 1240, fahrer: 4 },
    { name: 'Nord',   sla_pct: 81, avg_min: 27, umsatz:  890, fahrer: 3 },
    { name: 'Sued',   sla_pct: 64, avg_min: 35, umsatz:  690, fahrer: 3 },
  ],
  stunden: [
    { h: '16', bestellungen: 12, stammkunden_pct: 70 },
    { h: '17', bestellungen: 18, stammkunden_pct: 65 },
    { h: '18', bestellungen: 24, stammkunden_pct: 62 },
    { h: '19', bestellungen: 31, stammkunden_pct: 60 },
    { h: '20', bestellungen: 28, stammkunden_pct: 58 },
    { h: '21', bestellungen: 21, stammkunden_pct: 63 },
  ],
};

const ALERT_STYLES = {
  critical: 'bg-red-950/40 border-red-700/60 text-red-300',
  warn:     'bg-yellow-950/40 border-yellow-700/60 text-yellow-300',
  info:     'bg-blue-950/40 border-blue-700/60 text-blue-300',
};

export function LieferdienstPhase5148StatistikenDashboardV41() {
  const [data, setData] = useState<DashboardData>(MOCK);
  const [tab, setTab] = useState<Tab>('ueberblick');

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/delivery/lieferdienst/statistiken');
        if (r.ok) setData(await r.json());
      } catch { /* mock */ }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-gray-950 border border-teal-900/40 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-400" />
          <span className="font-semibold text-white text-sm">Statistiken V41</span>
          <span className="text-xs text-gray-500">Kundenbindung · LTV</span>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-teal-300">{data.gesamt_score}</div>
          <div className="text-xs text-gray-500">Gesamt-Score</div>
        </div>
      </div>

      {/* Dual-Score-Header */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-teal-950/30 border border-teal-800/40 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-xs text-gray-400">Effizienz</span>
          </div>
          <div className="text-2xl font-bold text-teal-300">{data.gesamt_score}</div>
          <div className="mt-1.5 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 rounded-full" style={{ width: `${data.gesamt_score}%` }} />
          </div>
        </div>
        <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Heart className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs text-gray-400">Kundenbindung</span>
          </div>
          <div className="text-2xl font-bold text-indigo-300">{data.kundenbindungs_score}</div>
          <div className="mt-1.5 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${data.kundenbindungs_score}%` }} />
          </div>
        </div>
      </div>

      {/* Churn-Alert */}
      {data.churn_alert && (
        <div className="flex items-center gap-2 bg-orange-950/40 border border-orange-700/50 rounded-lg px-3 py-1.5">
          <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
          <span className="text-xs text-orange-200">
            Churn-Risiko erkannt — Stammkunden reaktivieren
          </span>
        </div>
      )}

      {/* 9-KPI-Grid */}
      <div className="grid grid-cols-3 gap-2">
        {data.kpis.map(k => (
          <div key={k.key} className="bg-gray-900/60 rounded-lg p-2">
            <div className={`text-sm font-bold ${k.status === 'alert' ? 'text-red-400' : k.status === 'warn' ? 'text-yellow-400' : 'text-white'}`}>
              {k.value}
            </div>
            <div className="text-xs text-gray-500 truncate">{k.label}</div>
            <div className={`text-xs mt-0.5 ${k.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {k.delta >= 0 ? '+' : ''}{k.delta}%
            </div>
          </div>
        ))}
      </div>

      {/* Tab-Nav */}
      <div className="flex gap-1 flex-wrap">
        {(['ueberblick', 'stammkunden', 'zonen', 'stunden', 'alerts'] as Tab[]).map(t => {
          const labels: Record<Tab, string> = { ueberblick: 'Überblick', stammkunden: 'Kunden', zonen: 'Zonen', stunden: 'Stunden', alerts: 'Alerts' };
          const alertCount = t === 'alerts' ? data.alerts.filter(a => a.level !== 'info').length : 0;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors relative ${
                tab === t ? 'bg-teal-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {labels[t]}
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab: Überblick */}
      {tab === 'ueberblick' && (
        <div className="space-y-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Umsatz-Score-Trend (heute)</span>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={data.score_trend}>
              <Line type="monotone" dataKey="score" stroke="#14b8a6" strokeWidth={2} dot={false} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }}
                formatter={(v: unknown) => [`${v}`, 'Score']}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-gray-900/60 rounded-lg p-2">
              <div className="text-lg font-bold text-indigo-300">{data.wiederkauf_rate_gesamt}%</div>
              <div className="text-xs text-gray-500">Wiederkauf-Rate</div>
            </div>
            <div className="bg-gray-900/60 rounded-lg p-2">
              <div className="text-lg font-bold text-green-300">€{data.avg_ltv}</div>
              <div className="text-xs text-gray-500">Ø Kunden-LTV</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Stammkunden */}
      {tab === 'stammkunden' && (
        <div className="space-y-2">
          {data.segmente.map(s => (
            <div key={s.name} className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="font-semibold text-white text-sm">{s.name}</span>
                  <span className="text-xs text-gray-500">{s.anteil_pct}% Anteil</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-300">€{s.avg_ltv} LTV</div>
                </div>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full" style={{ width: `${s.anteil_pct}%`, backgroundColor: s.color }} />
              </div>
              <div className="flex gap-4 text-xs text-gray-400">
                <span><RefreshCw className="w-3 h-3 inline mr-1" />{s.wiederkauf_rate}% Wiederkauf</span>
                <span><Star className="w-3 h-3 inline mr-1" />Ø {s.avg_bestellungen} Bestellungen</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Stunden */}
      {tab === 'stunden' && (
        <div className="space-y-3">
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={data.stunden} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="h" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }}
                formatter={(v: unknown, name: unknown) => [v as string | number, name === 'bestellungen' ? 'Bestellungen' : 'Stammk.%']}
              />
              <Bar dataKey="bestellungen" radius={[3,3,0,0]}>
                {data.stunden.map((s, i) => (
                  <Cell key={i} fill={s.stammkunden_pct >= 65 ? '#14b8a6' : s.stammkunden_pct >= 55 ? '#22c55e' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="space-y-1.5">
            {data.stunden.map(s => (
              <div key={s.h} className="flex items-center gap-3 text-xs">
                <span className="text-gray-500 w-6">{s.h}h</span>
                <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${s.stammkunden_pct}%`, background: s.stammkunden_pct >= 65 ? '#6366f1' : '#22c55e' }}
                  />
                </div>
                <span className="text-gray-400 w-20">{s.stammkunden_pct}% Stamm</span>
                <span className="text-gray-500">{s.bestellungen} Bestellungen</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Zonen */}
      {tab === 'zonen' && (
        <div className="space-y-2">
          {data.zonen.map(z => {
            const color = z.sla_pct >= 90 ? 'text-green-400' : z.sla_pct >= 75 ? 'text-yellow-400' : 'text-red-400';
            const bg    = z.sla_pct >= 90 ? 'bg-green-950/30' : z.sla_pct >= 75 ? 'bg-yellow-950/30' : 'bg-red-950/30';
            const bar   = z.sla_pct >= 90 ? 'bg-green-500' : z.sla_pct >= 75 ? 'bg-yellow-500' : 'bg-red-500';
            return (
              <div key={z.name} className={`${bg} border border-gray-800 rounded-xl p-3`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-white text-sm">{z.name}</span>
                  <span className={`font-bold text-sm ${color}`}>{z.sla_pct}% SLA</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-2">
                  <div className={`h-full ${bar} rounded-full`} style={{ width: `${z.sla_pct}%` }} />
                </div>
                <div className="flex gap-4 text-xs text-gray-400">
                  <span>{z.fahrer} Fahrer</span>
                  <span>Ø {z.avg_min} Min</span>
                  <span>€{z.umsatz}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Alerts */}
      {tab === 'alerts' && (
        <div className="space-y-2">
          {data.alerts.map(a => (
            <div key={a.id} className={`border rounded-lg px-3 py-2 flex items-start gap-2 ${ALERT_STYLES[a.level]}`}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">{a.text}</div>
              <span className="text-xs opacity-60 shrink-0">{a.zeit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
