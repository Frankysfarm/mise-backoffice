'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, TrendingUp, TrendingDown, BarChart3, CheckCircle2,
  AlertTriangle, Users, Clock, Euro, Star, Target, Zap, Bell,
  Shield, Package,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LineChart, Line, YAxis, Cell } from 'recharts';

interface KPI {
  key: string;
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
  ziel?: number;
  aktuell?: number;
  status: 'ok' | 'warn' | 'alert';
  icon: React.ReactNode;
}

interface HourlyData {
  h: string;
  bestellungen: number;
  umsatz: number;
  puenktlichkeit: number;
  jetzt?: boolean;
}

interface FahrerRank {
  name: string;
  score: number;
  touren: number;
  trinkgeld: number;
  puenktlichkeit: number;
  tier: 'platin' | 'gold' | 'gut' | 'schwach';
  km_heute?: number;
}

interface ZoneData {
  name: string;
  sla_pct: number;
  avg_min: number;
  umsatz: number;
  kapazitaet_pct: number;
}

interface AlertItem {
  id: string;
  level: 'info' | 'warn' | 'critical';
  text: string;
  zeit: string;
}

interface DashboardData {
  gesamt_score: number;
  score_ziel: number;
  alerts: string[];
  live_alerts: AlertItem[];
  kpis: KPI[];
  stunden: HourlyData[];
  fahrer: FahrerRank[];
  zonen: ZoneData[];
  wochen_trend: { tag: string; heute: number; vorwoche: number }[];
  schicht: { name: string; score: number; touren: number; umsatz: number }[];
  qualitaets_score: number;
}

const MOCK: DashboardData = {
  gesamt_score: 83,
  score_ziel: 90,
  qualitaets_score: 87,
  alerts: ['Zone Süd: SLA unter 80%', 'Storno-Rate heute erhöht (+2%)'],
  live_alerts: [
    { id:'a1', level:'critical', text:'Zone Süd: SLA 76% — 2 Fahrer fehlen', zeit:'17:42' },
    { id:'a2', level:'warn',     text:'Storno-Rate: 4.2% (+2% vs. gestern)',  zeit:'17:38' },
    { id:'a3', level:'info',     text:'Fahrer Marco S. auf Platin-Kurs',      zeit:'17:30' },
    { id:'a4', level:'warn',     text:'Ø Lieferzeit Zone Nord steigt: 28min', zeit:'17:21' },
    { id:'a5', level:'info',     text:'Bestellspitze 17:00–18:00 erwartet',   zeit:'17:00' },
  ],
  kpis: [
    { key:'bestellungen', label:'Bestellungen',  value:127, unit:'',    delta:+8,  ziel:150, aktuell:127, status:'warn', icon:<BarChart3 className="w-4 h-4" /> },
    { key:'umsatz',       label:'Umsatz',         value:'2.840', unit:'€', delta:+12, ziel:3500,aktuell:2840,status:'warn',icon:<Euro className="w-4 h-4" /> },
    { key:'lieferzeit',   label:'Ø Lieferzeit',   value:28,  unit:'min', delta:-2,  ziel:30,  aktuell:28,  status:'ok',   icon:<Clock className="w-4 h-4" /> },
    { key:'puenktl',      label:'Pünktlichkeit',  value:87,  unit:'%',   delta:+1,  ziel:90,  aktuell:87,  status:'warn', icon:<CheckCircle2 className="w-4 h-4" /> },
    { key:'fahrer',       label:'Akt. Fahrer',    value:6,   unit:'',    delta:0,   ziel:8,   aktuell:6,   status:'warn', icon:<Users className="w-4 h-4" /> },
    { key:'bewertung',    label:'Bewertung',       value:4.7, unit:'★',   delta:+0.1,ziel:4.8, aktuell:4.7, status:'ok',   icon:<Star className="w-4 h-4" /> },
    { key:'storno',       label:'Storno-Rate',     value:4.2, unit:'%',   delta:+2,  ziel:3,   aktuell:4.2, status:'alert',icon:<AlertTriangle className="w-4 h-4" /> },
    { key:'marge',        label:'Marge',           value:31,  unit:'%',   delta:-1,  ziel:35,  aktuell:31,  status:'warn', icon:<TrendingUp className="w-4 h-4" /> },
    { key:'qualitaet',    label:'Qualitäts-Score', value:87,  unit:'',    delta:+2,  ziel:90,  aktuell:87,  status:'warn', icon:<Shield className="w-4 h-4" /> },
  ],
  stunden: [
    { h:'10', bestellungen:4,  umsatz:89,  puenktlichkeit:100 },
    { h:'11', bestellungen:7,  umsatz:164, puenktlichkeit:95  },
    { h:'12', bestellungen:18, umsatz:412, puenktlichkeit:90  },
    { h:'13', bestellungen:22, umsatz:498, puenktlichkeit:82  },
    { h:'14', bestellungen:15, umsatz:341, puenktlichkeit:88  },
    { h:'15', bestellungen:9,  umsatz:207, puenktlichkeit:92  },
    { h:'16', bestellungen:11, umsatz:253, puenktlichkeit:89  },
    { h:'17', bestellungen:21, umsatz:476, puenktlichkeit:85, jetzt:true },
    { h:'18', bestellungen:0,  umsatz:0,   puenktlichkeit:0   },
    { h:'19', bestellungen:0,  umsatz:0,   puenktlichkeit:0   },
  ],
  fahrer: [
    { name:'Marco S.', score:94, touren:14, trinkgeld:48, puenktlichkeit:97, tier:'platin', km_heute:42 },
    { name:'Anna M.',  score:87, touren:11, trinkgeld:37, puenktlichkeit:91, tier:'gut',    km_heute:31 },
    { name:'Lena K.',  score:81, touren:9,  trinkgeld:29, puenktlichkeit:86, tier:'gold',   km_heute:27 },
  ],
  zonen: [
    { name:'Mitte', sla_pct:93, avg_min:24, umsatz:1240, kapazitaet_pct:85 },
    { name:'Nord',  sla_pct:88, avg_min:28, umsatz:720,  kapazitaet_pct:60 },
    { name:'West',  sla_pct:84, avg_min:31, umsatz:580,  kapazitaet_pct:70 },
    { name:'Süd',   sla_pct:76, avg_min:36, umsatz:300,  kapazitaet_pct:45 },
  ],
  wochen_trend: [
    { tag:'Mo', heute:82,  vorwoche:78 },
    { tag:'Di', heute:89,  vorwoche:84 },
    { tag:'Mi', heute:75,  vorwoche:80 },
    { tag:'Do', heute:91,  vorwoche:82 },
    { tag:'Fr', heute:83,  vorwoche:79 },
    { tag:'Sa', heute:0,   vorwoche:95 },
    { tag:'So', heute:0,   vorwoche:88 },
  ],
  schicht: [
    { name:'Mittag',     score:91, touren:47, umsatz:1040 },
    { name:'Nachmittag', score:82, touren:38, umsatz:840  },
    { name:'Abend',      score:0,  touren:0,  umsatz:0    },
  ],
};

const TIER_MEDAL = { platin: '🥇', gold: '🥈', gut: '🥉', schwach: '' };
const TIER_BAR = { platin: 'bg-violet-400', gold: 'bg-amber-400', gut: 'bg-emerald-400', schwach: 'bg-slate-500' };

const KPI_STATUS = {
  ok:    { dot: 'bg-emerald-500', text: 'text-emerald-400' },
  warn:  { dot: 'bg-amber-500',   text: 'text-amber-400' },
  alert: { dot: 'bg-red-500',     text: 'text-red-400' },
};

const ALERT_STYLE = {
  critical: { bg: 'bg-red-500/10 border-red-500/20',    icon: 'text-red-400',    dot: 'bg-red-500' },
  warn:     { bg: 'bg-amber-500/10 border-amber-500/20', icon: 'text-amber-400',  dot: 'bg-amber-500' },
  info:     { bg: 'bg-blue-500/10 border-blue-500/20',   icon: 'text-blue-400',   dot: 'bg-blue-400' },
};

type TabKey = 'stunden' | 'fahrer' | 'zonen' | 'woche' | 'alerts';

export function LieferdienstPhase5142StatistikenDashboardV35() {
  const [data, setData] = useState<DashboardData>(MOCK);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('stunden');
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz' | 'puenktlichkeit'>('bestellungen');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const sb = createClient();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const { count: bestellCount } = await sb
          .from('customer_orders')
          .select('id', { count: 'exact', head: true })
          .gte('bestellt_am', today.toISOString());
        if (active) {
          setData(prev => ({
            ...prev,
            kpis: prev.kpis.map(k => k.key === 'bestellungen' ? { ...k, value: bestellCount ?? k.value } : k),
          }));
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => { active = false; clearInterval(iv); };
  }, []);

  const scorePct = Math.round((data.gesamt_score / data.score_ziel) * 100);
  const criticalAlerts = data.live_alerts.filter(a => a.level === 'critical').length;

  if (loading) return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-400 text-sm">Lade Statistiken…</div>
  );

  const chartData = data.stunden.map(h => ({
    ...h,
    val: chartMode === 'bestellungen' ? h.bestellungen : chartMode === 'umsatz' ? h.umsatz : h.puenktlichkeit,
  }));

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-800/60">
        <Activity className="w-5 h-5 text-teal-400" />
        <div>
          <span className="font-semibold text-sm">Statistiken V35</span>
          <span className="ml-2 text-[10px] text-slate-500">9-KPI · Woche · Schicht · Fahrer · Zonen · Live-Alerts</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {criticalAlerts > 0 && (
            <div className="flex items-center gap-1 text-red-400">
              <Bell className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{criticalAlerts}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">Score</span>
            <span className="text-lg font-bold text-teal-400">{data.gesamt_score}</span>
            <span className="text-xs text-slate-500">/ {data.score_ziel}</span>
          </div>
        </div>
      </div>

      {/* Score + Qualitäts Progress */}
      <div className="px-4 pt-3 pb-2 grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Gesamt-Score</span><span>{scorePct}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-700">
            <div className="h-2 rounded-full bg-teal-500 transition-all" style={{ width: `${scorePct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Qualitäts-Score</span><span>{data.qualitaets_score}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-700">
            <div className={cn('h-2 rounded-full transition-all', data.qualitaets_score >= 85 ? 'bg-emerald-500' : 'bg-amber-500')}
                 style={{ width: `${data.qualitaets_score}%` }} />
          </div>
        </div>
      </div>

      {/* Alert Strip */}
      {data.alerts.length > 0 && (
        <div className="px-4 py-2 border-y border-slate-700/50 space-y-1">
          {data.alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-amber-300">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* 9-KPI Grid 3-col */}
      <div className="grid grid-cols-3 divide-x divide-y divide-slate-700/50 border-b border-slate-700">
        {data.kpis.map(k => {
          const st = KPI_STATUS[k.status];
          const zielPct = k.ziel && k.aktuell ? Math.min(100, Math.round((k.aktuell / k.ziel) * 100)) : null;
          return (
            <div key={k.key} className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <div className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />
                <span className="text-[10px] text-slate-500 truncate">{k.label}</span>
              </div>
              <div className="flex items-end gap-1">
                <span className={cn('text-base font-bold tabular-nums', st.text)}>{k.value}</span>
                {k.unit && <span className="text-[10px] text-slate-500 mb-0.5">{k.unit}</span>}
                {k.delta != null && (
                  <span className={cn('text-[10px] ml-auto mb-0.5', k.delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {k.delta > 0 ? '+' : ''}{k.delta}
                  </span>
                )}
              </div>
              {zielPct != null && (
                <div className="mt-1 h-1 rounded-full bg-slate-700">
                  <div className={cn('h-1 rounded-full', st.dot)} style={{ width: `${zielPct}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tab Nav */}
      <div className="flex overflow-x-auto border-b border-slate-700">
        {(['stunden', 'fahrer', 'zonen', 'woche', 'alerts'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2 text-xs font-medium transition-colors shrink-0 relative',
              tab === t ? 'text-teal-400 border-b-2 border-teal-400 bg-slate-800/30' : 'text-slate-500 hover:text-slate-300')}>
            {t === 'stunden' ? 'Stunden' : t === 'fahrer' ? 'Fahrer' : t === 'zonen' ? 'Zonen' : t === 'woche' ? 'Woche' : 'Alerts'}
            {t === 'alerts' && criticalAlerts > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {tab === 'stunden' && (
        <div className="p-3">
          <div className="flex gap-1.5 mb-3">
            {(['bestellungen', 'umsatz', 'puenktlichkeit'] as const).map(m => (
              <button key={m} onClick={() => setChartMode(m)}
                className={cn('text-[10px] px-2 py-0.5 rounded-full transition-colors',
                  chartMode === m ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600')}>
                {m === 'bestellungen' ? 'Bestellungen' : m === 'umsatz' ? 'Umsatz' : 'Pünktl.'}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} barSize={14}>
              <XAxis dataKey="h" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#14b8a6' }}
              />
              <Bar dataKey="val" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.jetzt ? '#14b8a6' : '#1d4ed8'} opacity={entry.jetzt ? 1 : 0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'fahrer' && (
        <div className="divide-y divide-slate-700/50">
          {data.fahrer.map((f, i) => (
            <div key={f.name} className="px-4 py-3 flex items-center gap-3">
              <span className="text-lg">{TIER_MEDAL[f.tier] || `${i + 1}`}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold">{f.name}</span>
                  <span className="text-[10px] text-amber-400">★ {(f.puenktlichkeit / 20).toFixed(1)}</span>
                  {f.km_heute != null && (
                    <span className="text-[10px] text-slate-500">{f.km_heute}km</span>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-slate-700">
                  <div className={cn('h-1.5 rounded-full', TIER_BAR[f.tier])} style={{ width: `${f.score}%` }} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-bold tabular-nums">{f.score}</div>
                <div className="text-[10px] text-slate-500">{f.touren} Touren · {f.trinkgeld}€</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'zonen' && (
        <div className="divide-y divide-slate-700/50">
          {data.zonen.map(z => (
            <div key={z.name} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">{z.name}</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className={cn(z.sla_pct >= 90 ? 'text-emerald-400' : z.sla_pct >= 80 ? 'text-amber-400' : 'text-red-400')}>
                    SLA {z.sla_pct}%
                  </span>
                  <span className="text-slate-500">{z.avg_min}min</span>
                  <span className="text-emerald-400">{z.umsatz}€</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                    <span>SLA</span><span>{z.sla_pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700">
                    <div className={cn('h-1.5 rounded-full', z.sla_pct >= 90 ? 'bg-emerald-400' : z.sla_pct >= 80 ? 'bg-amber-400' : 'bg-red-400')}
                         style={{ width: `${z.sla_pct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                    <span>Kapazität</span><span>{z.kapazitaet_pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700">
                    <div className={cn('h-1.5 rounded-full', z.kapazitaet_pct >= 70 ? 'bg-emerald-400' : z.kapazitaet_pct >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                         style={{ width: `${z.kapazitaet_pct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'woche' && (
        <div className="p-3">
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={data.wochen_trend}>
              <XAxis dataKey="tag" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[60, 100]} tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line type="monotone" dataKey="heute" stroke="#14b8a6" strokeWidth={2} dot={{ fill: '#14b8a6', r: 2 }} name="Heute" />
              <Line type="monotone" dataKey="vorwoche" stroke="#475569" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Vorwoche" />
            </LineChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {data.schicht.map(s => (
              <div key={s.name} className={cn('rounded-lg p-2 text-center', s.score > 0 ? 'bg-slate-800' : 'bg-slate-800/30')}>
                <div className={cn('text-lg font-bold tabular-nums', s.score >= 85 ? 'text-emerald-400' : s.score >= 70 ? 'text-amber-400' : 'text-slate-500')}>
                  {s.score > 0 ? s.score : '–'}
                </div>
                <div className="text-[10px] text-slate-500">{s.name}</div>
                {s.touren > 0 && <div className="text-[9px] text-slate-600">{s.touren}T · {s.umsatz}€</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'alerts' && (
        <div className="p-3 space-y-2">
          {data.live_alerts.length === 0 && (
            <div className="text-center text-slate-500 py-6 text-sm flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/40" />
              Keine aktiven Alerts
            </div>
          )}
          {data.live_alerts.map(alert => {
            const st = ALERT_STYLE[alert.level];
            return (
              <div key={alert.id} className={cn('rounded-lg border p-3 flex items-start gap-3', st.bg)}>
                <div className={cn('w-2 h-2 rounded-full mt-1 shrink-0', st.dot)} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-200">{alert.text}</p>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0">{alert.zeit}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
