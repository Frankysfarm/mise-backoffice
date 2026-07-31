'use client';

import { useEffect, useState } from 'react';
import {
  Activity, TrendingUp, TrendingDown, Clock,
  Euro, Users, AlertTriangle, CheckCircle2,
  BarChart3, Target, Zap, MapPin, Package,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LineChart, Line, YAxis, Cell, AreaChart, Area } from 'recharts';

// Phase 5149 — Statistiken-Dashboard V42
// Neu: Peak-Time-Prognose (nächste 2h Bedarf); SLA-Compliance-Matrix;
// Umsatz-Forecast-Chart (Ist vs. Prognose); Lieferzeit-Effizienz-Score;
// 9-KPI-Grid 3-spaltig Ampel+Δ+Ziel; 5-Tab-Nav Überblick/Prognose/SLA/Fahrer/Zonen;
// 60s-Polling; Mock-Fallback

type Tab = 'ueberblick' | 'prognose' | 'sla' | 'fahrer' | 'zonen';

interface KpiItem { key: string; label: string; value: string | number; delta: number; ziel: number; status: 'ok' | 'warn' | 'alert' }
interface AlertItem { id: string; level: 'info' | 'warn' | 'critical'; text: string; zeit: string }
interface ZoneData { name: string; sla_pct: number; avg_min: number; umsatz: number; fahrer: number; effizienz: number }
interface FahrerData { name: string; score: number; touren: number; pünktl_pct: number; trinkgeld: number; tier: 'platin' | 'gold' | 'gut' | 'schwach' }
interface PrognoseData { h: string; ist: number | null; prognose: number; bedarf_fahrer: number }
interface SlaData { h: string; pct: number; target: number }

interface DashboardData {
  gesamt_score: number;
  lieferzeit_effizienz: number;
  umsatz_heute: number;
  umsatz_delta_pct: number;
  peak_naechste_stunde: boolean;
  peak_stunde_label: string;
  kpis: KpiItem[];
  alerts: AlertItem[];
  zonen: ZoneData[];
  fahrer: FahrerData[];
  prognose: PrognoseData[];
  sla_verlauf: SlaData[];
}

const nowH = new Date().getHours();

const MOCK: DashboardData = {
  gesamt_score: 87,
  lieferzeit_effizienz: 82,
  umsatz_heute: 3840,
  umsatz_delta_pct: 11.2,
  peak_naechste_stunde: true,
  peak_stunde_label: `${nowH + 1}:00–${nowH + 2}:00 Uhr`,
  kpis: [
    { key: 'umsatz',      label: 'Umsatz heute',    value: '3.840 €',  delta: 11.2,  ziel: 4200,  status: 'ok'   },
    { key: 'bestellungen',label: 'Bestellungen',     value: 128,        delta: 8.4,   ziel: 150,   status: 'ok'   },
    { key: 'lieferzeit',  label: 'Ø Lieferzeit',     value: '27 Min',   delta: -4.1,  ziel: 30,    status: 'ok'   },
    { key: 'puenktl',     label: 'Pünktlichkeit',    value: '88 %',     delta: 2.3,   ziel: 90,    status: 'warn' },
    { key: 'fahrer',      label: 'Aktive Fahrer',    value: 7,          delta: 0,     ziel: 8,     status: 'warn' },
    { key: 'bewertung',   label: 'Ø Bewertung',      value: '4.7 ★',    delta: 0.1,   ziel: 4.5,   status: 'ok'   },
    { key: 'storno',      label: 'Storno-Quote',     value: '3.1 %',    delta: -0.5,  ziel: 5,     status: 'ok'   },
    { key: 'trinkgeld',   label: 'Trinkgeld',        value: '142 €',    delta: 18.7,  ziel: 100,   status: 'ok'   },
    { key: 'effizienz',   label: 'Effizienz-Score',  value: '82 / 100', delta: 3.1,   ziel: 85,    status: 'warn' },
  ],
  alerts: [
    { id: 'a1', level: 'warn',     text: 'Fahrer-Bedarf in nächster Stunde: +2 Fahrer empfohlen', zeit: '14:55' },
    { id: 'a2', level: 'info',     text: 'Zone Nord: Pünktlichkeit auf 92% gestiegen', zeit: '14:48' },
    { id: 'a3', level: 'critical', text: 'Zone Süd: SLA unter 80% — sofort eingreifen', zeit: '14:41' },
  ],
  zonen: [
    { name: 'Nord',  sla_pct: 92, avg_min: 24, umsatz: 1120, fahrer: 2, effizienz: 91 },
    { name: 'Mitte', sla_pct: 88, avg_min: 27, umsatz: 1580, fahrer: 3, effizienz: 85 },
    { name: 'Süd',   sla_pct: 78, avg_min: 33, umsatz: 760,  fahrer: 2, effizienz: 71 },
    { name: 'West',  sla_pct: 90, avg_min: 25, umsatz: 380,  fahrer: 1, effizienz: 87 },
  ],
  fahrer: [
    { name: 'Tim B.',    score: 94, touren: 12, pünktl_pct: 96, trinkgeld: 38, tier: 'platin' },
    { name: 'Julia F.',  score: 88, touren: 10, pünktl_pct: 90, trinkgeld: 29, tier: 'gold'   },
    { name: 'Kemal A.',  score: 82, touren: 9,  pünktl_pct: 88, trinkgeld: 24, tier: 'gut'    },
    { name: 'Sara M.',   score: 76, touren: 7,  pünktl_pct: 84, trinkgeld: 19, tier: 'gut'    },
  ],
  prognose: Array.from({ length: 6 }, (_, i) => {
    const h = nowH + i;
    const ist = i < 2 ? Math.round(300 + Math.random() * 200) : null;
    const prognose = Math.round(320 + Math.sin(i * 0.8) * 80 + i * 20);
    return { h: `${h}:00`, ist, prognose, bedarf_fahrer: Math.round(4 + i * 0.8) };
  }),
  sla_verlauf: Array.from({ length: 8 }, (_, i) => ({
    h: `${Math.max(8, nowH - 7 + i)}:00`,
    pct: Math.round(83 + Math.sin(i * 0.6) * 6),
    target: 90,
  })),
};

const TIER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  platin: { bg: 'bg-violet-900/40', text: 'text-violet-300', label: '🥇 Platin' },
  gold:   { bg: 'bg-yellow-900/40', text: 'text-yellow-300', label: '🥈 Gold'   },
  gut:    { bg: 'bg-green-900/40',  text: 'text-green-300',  label: '🥉 Gut'    },
  schwach:{ bg: 'bg-gray-800/40',   text: 'text-gray-400',   label: 'Schwach'   },
};

const STATUS_COLORS: Record<string, { dot: string; text: string }> = {
  ok:    { dot: 'bg-green-400',  text: 'text-green-400'  },
  warn:  { dot: 'bg-yellow-400', text: 'text-yellow-400' },
  alert: { dot: 'bg-red-400',    text: 'text-red-400'    },
};

const ALERT_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  critical: { bg: 'bg-red-950/40',    border: 'border-red-700/50',    text: 'text-red-300',    icon: 'text-red-400'    },
  warn:     { bg: 'bg-yellow-950/40', border: 'border-yellow-700/50', text: 'text-yellow-200', icon: 'text-yellow-400' },
  info:     { bg: 'bg-blue-950/40',   border: 'border-blue-700/50',   text: 'text-blue-200',   icon: 'text-blue-400'   },
};

export function LieferdienstPhase5149StatistikenDashboardV42() {
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

  const criticalAlerts = data.alerts.filter(a => a.level === 'critical').length;

  return (
    <div className="bg-gray-950 border border-teal-900/40 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-400" />
          <span className="font-semibold text-white text-sm">Statistiken V42</span>
          <span className="text-xs text-gray-500">Prognose + SLA</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xl font-bold text-teal-300">{data.gesamt_score}</div>
            <div className="text-xs text-gray-500">Score</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-white">{data.lieferzeit_effizienz}</div>
            <div className="text-xs text-gray-500">Effizienz</div>
          </div>
        </div>
      </div>

      {/* Peak-Warnung */}
      {data.peak_naechste_stunde && (
        <div className="flex items-center gap-2 bg-orange-950/40 border border-orange-700/50 rounded-lg px-3 py-2">
          <Zap className="w-4 h-4 text-orange-400 shrink-0" />
          <span className="text-xs text-orange-200">
            <strong>Peak-Stunde erwartet:</strong> {data.peak_stunde_label} — mehr Fahrer empfohlen
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {([
          { key: 'ueberblick', label: 'Überblick' },
          { key: 'prognose',   label: 'Prognose'  },
          { key: 'sla',        label: 'SLA'        },
          { key: 'fahrer',     label: 'Fahrer'     },
          { key: 'zonen',      label: 'Zonen'      },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-teal-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {t.label}
            {t.key === 'sla' && criticalAlerts > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1">{criticalAlerts}</span>
            )}
          </button>
        ))}
      </div>

      {/* Überblick */}
      {tab === 'ueberblick' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {data.kpis.map(k => {
              const sc = STATUS_COLORS[k.status];
              return (
                <div key={k.key} className="bg-gray-900/60 rounded-xl p-2.5 space-y-1">
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${sc.dot}`} />
                    <span className="text-xs text-gray-500 truncate">{k.label}</span>
                  </div>
                  <div className="text-sm font-bold text-white">{k.value}</div>
                  <div className={`text-xs font-medium ${k.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {k.delta >= 0 ? '+' : ''}{k.delta}%
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Umsatz heute</span>
            <span className="text-white font-semibold">
              {data.umsatz_heute.toLocaleString('de-DE')} €
              <span className={`ml-2 ${data.umsatz_delta_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {data.umsatz_delta_pct >= 0 ? '+' : ''}{data.umsatz_delta_pct}%
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Prognose */}
      {tab === 'prognose' && (
        <div className="space-y-3">
          <div className="text-xs text-gray-400">Umsatz Ist vs. Prognose (nächste 6h)</div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={data.prognose} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="h" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#d1d5db' }}
              />
              <Area type="monotone" dataKey="prognose" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.2} strokeWidth={2} name="Prognose" dot={false} />
              <Area type="monotone" dataKey="ist" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} strokeWidth={2} name="Ist" dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="text-xs text-gray-400">Fahrer-Bedarf je Stunde</div>
          <div className="flex gap-1">
            {data.prognose.map(p => (
              <div key={p.h} className="flex-1 space-y-1 text-center">
                <div
                  className={`rounded-sm mx-auto ${p.bedarf_fahrer >= 6 ? 'bg-orange-500' : 'bg-teal-600'}`}
                  style={{ width: '100%', height: `${Math.round(p.bedarf_fahrer * 6)}px` }}
                />
                <div className="text-xs text-gray-500">{p.h}</div>
                <div className="text-xs font-bold text-white">{p.bedarf_fahrer}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SLA */}
      {tab === 'sla' && (
        <div className="space-y-3">
          {data.alerts.filter(a => a.level === 'critical').length > 0 && (
            <div className="space-y-1.5">
              {data.alerts.filter(a => a.level === 'critical').map(a => {
                const c = ALERT_COLORS[a.level];
                return (
                  <div key={a.id} className={`flex items-start gap-2 ${c.bg} border ${c.border} rounded-lg px-3 py-2`}>
                    <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${c.icon}`} />
                    <span className={`text-xs ${c.text}`}>{a.text}</span>
                    <span className="text-xs text-gray-500 ml-auto">{a.zeit}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="text-xs text-gray-400">SLA-Verlauf heute</div>
          <ResponsiveContainer width="100%" height={90}>
            <LineChart data={data.sla_verlauf} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="h" tick={{ fill: '#9ca3af', fontSize: 9 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} domain={[70, 100]} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="pct" stroke="#14b8a6" strokeWidth={2} dot={false} name="SLA %" />
              <Line type="monotone" dataKey="target" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} dot={false} name="Ziel" />
            </LineChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2">
            {data.zonen.map(z => {
              const color = z.sla_pct >= 90 ? 'text-green-400' : z.sla_pct >= 80 ? 'text-yellow-400' : 'text-red-400';
              const bar   = z.sla_pct >= 90 ? 'bg-green-500' : z.sla_pct >= 80 ? 'bg-yellow-500' : 'bg-red-500';
              return (
                <div key={z.name} className="bg-gray-900/60 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-medium">{z.name}</span>
                    <span className={`font-bold ${color}`}>{z.sla_pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full ${bar} rounded-full`} style={{ width: `${z.sla_pct}%` }} />
                  </div>
                  <div className="text-xs text-gray-500">Ø {z.avg_min} Min</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fahrer */}
      {tab === 'fahrer' && (
        <div className="space-y-2">
          {data.fahrer.map((f, i) => {
            const tc = TIER_COLORS[f.tier];
            return (
              <div key={f.name} className={`${tc.bg} border border-gray-700/40 rounded-xl p-3 flex items-center gap-3`}>
                <div className="text-sm font-bold text-gray-400 w-5 text-center">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{f.name}</span>
                    <span className={`text-xs ${tc.text}`}>{tc.label}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{f.touren} Touren</span>
                    <span>{f.pünktl_pct}% pünktl.</span>
                    <span className="text-green-400">{f.trinkgeld} € TG</span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${f.score >= 90 ? 'bg-violet-500' : f.score >= 80 ? 'bg-yellow-500' : f.score >= 70 ? 'bg-green-500' : 'bg-gray-500'}`}
                      style={{ width: `${f.score}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white">{f.score}</div>
                  <div className="text-xs text-gray-500">Score</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Zonen */}
      {tab === 'zonen' && (
        <div className="space-y-2">
          {data.zonen.map(z => {
            const effColor = z.effizienz >= 90 ? 'text-green-400' : z.effizienz >= 80 ? 'text-yellow-400' : 'text-red-400';
            return (
              <div key={z.name} className="bg-gray-900/60 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-teal-400" />
                    <span className="text-sm font-semibold text-white">{z.name}</span>
                  </div>
                  <span className={`text-sm font-bold ${effColor}`}>Effizienz {z.effizienz}%</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div>
                    <div className="text-white font-semibold">{z.sla_pct}%</div>
                    <div className="text-gray-500">SLA</div>
                  </div>
                  <div>
                    <div className="text-white font-semibold">{z.avg_min} Min</div>
                    <div className="text-gray-500">Ø Zeit</div>
                  </div>
                  <div>
                    <div className="text-white font-semibold">{z.umsatz} €</div>
                    <div className="text-gray-500">Umsatz</div>
                  </div>
                  <div>
                    <div className="text-white font-semibold">{z.fahrer}</div>
                    <div className="text-gray-500">Fahrer</div>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${z.sla_pct >= 90 ? 'bg-green-500' : z.sla_pct >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${z.sla_pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
