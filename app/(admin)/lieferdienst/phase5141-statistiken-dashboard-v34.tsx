'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, TrendingUp, TrendingDown, BarChart3, CheckCircle2,
  AlertTriangle, Users, Clock, Euro, Star, Target, Zap,
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
}

interface ZoneData {
  name: string;
  sla_pct: number;
  avg_min: number;
  umsatz: number;
  kapazitaet_pct: number;
}

interface DashboardData {
  gesamt_score: number;
  score_ziel: number;
  alerts: string[];
  kpis: KPI[];
  stunden: HourlyData[];
  fahrer: FahrerRank[];
  zonen: ZoneData[];
  wochen_trend: { tag: string; heute: number; vorwoche: number }[];
  schicht: { name: string; score: number; touren: number; umsatz: number }[];
}

const MOCK: DashboardData = {
  gesamt_score: 83,
  score_ziel: 90,
  alerts: ['Zone Süd: SLA unter 80%', 'Storno-Rate heute erhöht (+2%)'],
  kpis: [
    { key:'bestellungen', label:'Bestellungen',  value:127, unit:'',    delta:+8,  ziel:150, aktuell:127, status:'warn', icon:<BarChart3 className="w-4 h-4" /> },
    { key:'umsatz',       label:'Umsatz',         value:'2.840', unit:'€', delta:+12, ziel:3500,aktuell:2840,status:'warn',icon:<Euro className="w-4 h-4" /> },
    { key:'lieferzeit',   label:'Ø Lieferzeit',   value:28,  unit:'min', delta:-2,  ziel:30,  aktuell:28,  status:'ok',   icon:<Clock className="w-4 h-4" /> },
    { key:'puenktl',      label:'Pünktlichkeit',  value:87,  unit:'%',   delta:+1,  ziel:90,  aktuell:87,  status:'warn', icon:<CheckCircle2 className="w-4 h-4" /> },
    { key:'fahrer',       label:'Akt. Fahrer',    value:6,   unit:'',    delta:0,   ziel:8,   aktuell:6,   status:'warn', icon:<Users className="w-4 h-4" /> },
    { key:'bewertung',    label:'Bewertung',       value:4.7, unit:'★',   delta:+0.1,ziel:4.8, aktuell:4.7, status:'ok',   icon:<Star className="w-4 h-4" /> },
    { key:'storno',       label:'Storno-Rate',     value:4.2, unit:'%',   delta:+2,  ziel:3,   aktuell:4.2, status:'alert',icon:<AlertTriangle className="w-4 h-4" /> },
    { key:'marge',        label:'Marge',           value:31,  unit:'%',   delta:-1,  ziel:35,  aktuell:31,  status:'warn', icon:<TrendingUp className="w-4 h-4" /> },
    { key:'trinkgeld',    label:'Trinkgeld',       value:184, unit:'€',   delta:+22, ziel:200, aktuell:184, status:'warn', icon:<Zap className="w-4 h-4" /> },
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
    { name:'Marco S.', score:94, touren:14, trinkgeld:48, puenktlichkeit:97, tier:'platin' },
    { name:'Anna M.',  score:87, touren:11, trinkgeld:37, puenktlichkeit:91, tier:'gut'    },
    { name:'Lena K.',  score:81, touren:9,  trinkgeld:29, puenktlichkeit:86, tier:'gold'   },
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

type TabKey = 'stunden' | 'fahrer' | 'zonen' | 'woche';

export function LieferdienstPhase5141StatistikenDashboardV34() {
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

  if (loading) return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-400 text-sm">Lade Statistiken…</div>
  );

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-800/60">
        <Activity className="w-5 h-5 text-teal-400" />
        <div>
          <span className="font-semibold text-sm">Statistiken V34</span>
          <span className="ml-2 text-[10px] text-slate-500">9-KPI · Woche · Schicht · Fahrer · Zonen</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">Score</span>
            <span className="text-lg font-bold text-teal-400">{data.gesamt_score}</span>
            <span className="text-xs text-slate-500">/ {data.score_ziel}</span>
          </div>
        </div>
      </div>

      {/* Score progress bar */}
      <div className="px-4 py-2 border-b border-slate-700/50">
        <div className="h-2 rounded-full bg-slate-700">
          <div className="h-2 rounded-full bg-teal-500 transition-all" style={{ width: `${Math.min(100, scorePct)}%` }} />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] text-slate-500">{data.gesamt_score} Punkte</span>
          <span className="text-[10px] text-slate-500">Ziel: {data.score_ziel}</span>
        </div>
      </div>

      {/* Alert strip */}
      {data.alerts.length > 0 && (
        <div className="border-b border-red-500/20 bg-red-500/5 px-4 py-2 flex flex-col gap-1">
          {data.alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-red-300">
              <AlertTriangle className="w-3 h-3 shrink-0" />{a}
            </div>
          ))}
        </div>
      )}

      {/* 9-KPI-Grid */}
      <div className="grid grid-cols-3 divide-x divide-slate-700 border-b border-slate-700">
        {data.kpis.map(k => {
          const st = KPI_STATUS[k.status];
          const zielPct = k.ziel && k.aktuell ? Math.min(100, Math.round((k.aktuell / k.ziel) * 100)) : null;
          return (
            <div key={k.key} className="flex flex-col items-center py-2.5 px-2 border-b border-slate-700/50 last:border-b-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span className={cn('text-slate-500', st.text)}>{k.icon}</span>
                <span className="text-[9px] text-slate-500 truncate max-w-[64px]">{k.label}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={cn('text-base font-bold tabular-nums', st.text)}>{k.value}</span>
                {k.unit && <span className="text-[10px] text-slate-500">{k.unit}</span>}
              </div>
              {k.delta != null && (
                <div className={cn('flex items-center gap-0.5 text-[9px]', k.delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {k.delta >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {k.delta > 0 ? '+' : ''}{k.delta}{k.unit}
                </div>
              )}
              {zielPct != null && (
                <div className="w-full mt-1 h-1 rounded-full bg-slate-700">
                  <div className={cn('h-1 rounded-full', k.status === 'ok' ? 'bg-emerald-500' : k.status === 'warn' ? 'bg-amber-500' : 'bg-red-500')}
                    style={{ width: `${zielPct}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tab Nav */}
      <div className="flex border-b border-slate-700">
        {(['stunden', 'fahrer', 'zonen', 'woche'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2 text-[10px] font-medium transition-colors capitalize',
              tab === t ? 'text-teal-400 border-b-2 border-teal-400 bg-slate-800/30' : 'text-slate-500 hover:text-slate-300')}>
            {t === 'stunden' ? 'Stunden' : t === 'fahrer' ? 'Fahrer' : t === 'zonen' ? 'Zonen' : 'Woche'}
          </button>
        ))}
      </div>

      {/* Stunden Tab */}
      {tab === 'stunden' && (
        <div className="p-3">
          <div className="flex gap-1.5 mb-3">
            {(['bestellungen', 'umsatz', 'puenktlichkeit'] as const).map(m => (
              <button key={m} onClick={() => setChartMode(m)}
                className={cn('text-[10px] px-2 py-0.5 rounded-full transition-colors',
                  chartMode === m ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-400')}>
                {m === 'bestellungen' ? 'Bestellungen' : m === 'umsatz' ? 'Umsatz €' : 'Pünktl. %'}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data.stunden} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="h" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 10, borderRadius: 6 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Bar dataKey={chartMode} fill="#14b8a6" radius={[2, 2, 0, 0]} label={false}>
                {data.stunden.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.jetzt ? '#0f766e' : '#14b8a6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Fahrer Tab */}
      {tab === 'fahrer' && (
        <div className="divide-y divide-slate-700/50">
          {data.fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-3 px-4 py-3">
              <span className="text-lg">{TIER_MEDAL[f.tier] || `${i + 1}`}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{f.name}</span>
                  <span className="text-sm font-bold text-teal-400">{f.score}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700">
                  <div className={cn('h-1.5 rounded-full', TIER_BAR[f.tier])} style={{ width: `${f.score}%` }} />
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                  <span>{f.touren} Touren</span>
                  <span className="text-amber-400">{f.trinkgeld}€ TG</span>
                  <span className={f.puenktlichkeit >= 90 ? 'text-emerald-400' : 'text-amber-400'}>{f.puenktlichkeit}% pünktl.</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zonen Tab */}
      {tab === 'zonen' && (
        <div className="divide-y divide-slate-700/50">
          {data.zonen.map(z => (
            <div key={z.name} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">{z.name}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-400">{z.avg_min}min ∅</span>
                  <span className="text-emerald-400">{z.umsatz}€</span>
                  <span className={cn('font-semibold', z.sla_pct >= 90 ? 'text-emerald-400' : z.sla_pct >= 80 ? 'text-amber-400' : 'text-red-400')}>
                    {z.sla_pct}% SLA
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-slate-700">
                <div
                  className={cn('h-2 rounded-full', z.sla_pct >= 90 ? 'bg-emerald-400' : z.sla_pct >= 80 ? 'bg-amber-400' : 'bg-red-400')}
                  style={{ width: `${z.kapazitaet_pct}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-600">Kapazität {z.kapazitaet_pct}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Woche Tab */}
      {tab === 'woche' && (
        <div className="p-3">
          <p className="text-[10px] text-slate-500 mb-2">Schicht-Score Heute vs. Vorwoche</p>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={data.wochen_trend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[60, 100]} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 10, borderRadius: 6 }} />
              <Line type="monotone" dataKey="heute" stroke="#14b8a6" strokeWidth={2} dot={false} name="Heute" />
              <Line type="monotone" dataKey="vorwoche" stroke="#64748b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Vorwoche" />
            </LineChart>
          </ResponsiveContainer>
          {/* Schicht-Kacheln */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {data.schicht.map(s => (
              <div key={s.name} className="rounded-lg bg-slate-800 border border-slate-700 p-2 text-center">
                <span className="text-[10px] text-slate-500 block">{s.name}</span>
                <span className={cn('text-base font-bold', s.score > 0 ? 'text-teal-400' : 'text-slate-600')}>{s.score > 0 ? s.score : '—'}</span>
                {s.touren > 0 && <span className="text-[9px] text-slate-500 block">{s.touren} Touren · {s.umsatz}€</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
