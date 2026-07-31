'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { Activity, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Star, Clock, Users, Euro, Package, Zap, BarChart3, Target } from 'lucide-react';

interface KPI {
  label: string;
  value: string;
  delta: number;
  ziel: number;
  ist: number;
  icon: React.ReactNode;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface Driver {
  name: string;
  score: number;
  touren: number;
  trinkgeld: number;
  puenktlichkeit: number;
  tier: 'platin' | 'gold' | 'gut' | 'schwach';
}

interface HourData { h: string; value: number }
interface ZoneData { zone: string; sla: number; avg_min: number; umsatz: number; kapazitaet: number }

const MOCK_KPI: KPI[] = [
  { label:'Umsatz',       value:'€1.247',  delta:+8.2,  ziel:1400, ist:1247, icon:<Euro className="w-3.5 h-3.5" />,      ampel:'gelb'  },
  { label:'Bestellungen', value:'87',       delta:+12.3, ziel:100,  ist:87,   icon:<Package className="w-3.5 h-3.5" />,   ampel:'gelb'  },
  { label:'Ø Lieferzeit', value:'28min',    delta:-4.1,  ziel:30,   ist:28,   icon:<Clock className="w-3.5 h-3.5" />,     ampel:'gruen' },
  { label:'Pünktlichkeit',value:'89%',      delta:+2.0,  ziel:90,   ist:89,   icon:<CheckCircle2 className="w-3.5 h-3.5" />, ampel:'gelb' },
  { label:'Fahrer aktiv', value:'6',        delta:0,     ziel:8,    ist:6,    icon:<Users className="w-3.5 h-3.5" />,     ampel:'gelb'  },
  { label:'Bewertung',    value:'4.6★',    delta:+0.1,  ziel:4.5,  ist:4.6,  icon:<Star className="w-3.5 h-3.5" />,      ampel:'gruen' },
  { label:'Storno',       value:'3.4%',     delta:-1.2,  ziel:5,    ist:3.4,  icon:<AlertCircle className="w-3.5 h-3.5" />, ampel:'gruen' },
  { label:'Marge',        value:'31%',      delta:+1.5,  ziel:30,   ist:31,   icon:<TrendingUp className="w-3.5 h-3.5" />, ampel:'gruen' },
  { label:'Score',        value:'84',       delta:+3,    ziel:85,   ist:84,   icon:<Zap className="w-3.5 h-3.5" />,       ampel:'gelb'  },
];

const MOCK_DRIVERS: Driver[] = [
  { name:'Marco S.', score:92, touren:8, trinkgeld:18.50, puenktlichkeit:96, tier:'platin' },
  { name:'Anna M.',  score:85, touren:7, trinkgeld:12.00, puenktlichkeit:91, tier:'gut'    },
  { name:'Lena K.',  score:78, touren:6, trinkgeld:9.00,  puenktlichkeit:83, tier:'gold'   },
];

const MOCK_STUNDEN: HourData[] = [
  { h:'10',value:42 },{ h:'11',value:67 },{ h:'12',value:134 },{ h:'13',value:198 },
  { h:'14',value:112 },{ h:'15',value:89 },{ h:'16',value:76 },{ h:'17',value:103 },
  { h:'18',value:187 },{ h:'19',value:221 },{ h:'20',value:176 },{ h:'21',value:98 },
];

const MOCK_WOCHE: HourData[] = [
  { h:'Mo',value:68 },{ h:'Di',value:74 },{ h:'Mi',value:82 },{ h:'Do',value:79 },
  { h:'Fr',value:91 },{ h:'Sa',value:110 },{ h:'So',value:87 },
];

const MOCK_ZONEN: ZoneData[] = [
  { zone:'Mitte', sla:94, avg_min:24, umsatz:412, kapazitaet:88 },
  { zone:'Nord',  sla:86, avg_min:31, umsatz:287, kapazitaet:72 },
  { zone:'West',  sla:91, avg_min:27, umsatz:334, kapazitaet:81 },
  { zone:'Süd',   sla:78, avg_min:36, umsatz:214, kapazitaet:64 },
];

const AMPEL = {
  gruen: { text:'text-emerald-400', bg:'bg-emerald-500/10', border:'border-emerald-500/20', dot:'bg-emerald-500' },
  gelb:  { text:'text-amber-400',   bg:'bg-amber-500/10',   border:'border-amber-500/20',   dot:'bg-amber-500'   },
  rot:   { text:'text-red-400',     bg:'bg-red-500/10',     border:'border-red-500/20',     dot:'bg-red-500'     },
};

const TIER_MEDAL = { platin:'🥇', gold:'🥈', gut:'🥉', schwach:'🔸' };

type Tab = 'stunden' | 'fahrer' | 'zonen' | 'woche';

interface Props { locationId?: string | null }

export function LieferdienstPhase5140StatistikenDashboardV33({ locationId }: Props) {
  const [kpis, setKpis] = useState<KPI[]>(MOCK_KPI);
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS);
  const [stunden, setStunden] = useState<HourData[]>(MOCK_STUNDEN);
  const [woche, setWoche] = useState<HourData[]>(MOCK_WOCHE);
  const [zonen, setZonen] = useState<ZoneData[]>(MOCK_ZONEN);
  const [tab, setTab] = useState<Tab>('stunden');
  const [chartMode, setChartMode] = useState<'umsatz' | 'bestellungen' | 'puenktlichkeit'>('umsatz');

  const nowH = new Date().getHours().toString();
  const gesamtScore = Math.round(kpis.reduce((s, k) => s + k.ist, 0) / kpis.length);
  const alertKpis = kpis.filter(k => k.ampel === 'rot').length;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <Activity className="w-5 h-5 text-teal-400" />
        <span className="font-semibold text-sm">Statistiken V33</span>
        {alertKpis > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5" />{alertKpis} Alarm
          </span>
        )}
        <span className="ml-auto text-xs text-slate-400">60s · Live</span>
      </div>

      {/* Score Fortschrittsbalken */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-2xl font-bold tabular-nums text-teal-400">{gesamtScore}</span>
          <span className="text-[10px] text-slate-500">Gesamt-Score</span>
        </div>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div className={cn('h-2 rounded-full transition-all',
              gesamtScore >= 80 ? 'bg-emerald-400' : gesamtScore >= 60 ? 'bg-amber-400' : 'bg-red-400'
            )} style={{ width:`${gesamtScore}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
            <span>0</span><span>Ziel 85</span><span>100</span>
          </div>
        </div>
      </div>

      {/* 9-KPI Grid */}
      <div className="grid grid-cols-3 border-b border-slate-700 divide-y divide-slate-700">
        {kpis.map((k, i) => {
          const a = AMPEL[k.ampel];
          return (
            <div key={k.label} className={cn('p-2.5 flex flex-col gap-0.5', i % 3 !== 2 ? 'border-r border-slate-700' : '')}>
              <div className="flex items-center gap-1.5">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', a.dot)} />
                <span className="text-[10px] text-slate-500 truncate">{k.label}</span>
              </div>
              <div className="flex items-end gap-1">
                <span className={cn('text-base font-bold tabular-nums', a.text)}>{k.value}</span>
                <span className={cn('text-[10px] mb-0.5', k.delta >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                  {k.delta >= 0 ? '+' : ''}{k.delta}%
                </span>
              </div>
              {/* Ziel-Balken */}
              <div className="h-1 rounded-full bg-slate-700">
                <div className={cn('h-1 rounded-full', a.dot === 'bg-emerald-500' ? 'bg-emerald-500' : a.dot === 'bg-amber-500' ? 'bg-amber-500' : 'bg-red-500')}
                  style={{ width:`${Math.min(100, Math.round((k.ist/k.ziel)*100))}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab Nav */}
      <div className="flex border-b border-slate-700">
        {(['stunden','fahrer','zonen','woche'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2 text-[11px] font-medium capitalize transition-colors',
              tab === t ? 'text-teal-400 border-b-2 border-teal-400 bg-slate-800/30' : 'text-slate-500 hover:text-slate-300')}>
            {t === 'stunden' ? 'Stunden' : t === 'fahrer' ? 'Fahrer' : t === 'zonen' ? 'Zonen' : 'Woche'}
          </button>
        ))}
      </div>

      {/* Stunden-Tab */}
      {tab === 'stunden' && (
        <div className="p-4">
          <div className="flex gap-1 mb-3">
            {(['umsatz','bestellungen','puenktlichkeit'] as const).map(m => (
              <button key={m} onClick={() => setChartMode(m)}
                className={cn('text-[10px] px-2 py-0.5 rounded transition-colors',
                  chartMode === m ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-400')}>
                {m === 'umsatz' ? 'Umsatz' : m === 'bestellungen' ? 'Bestellungen' : 'Pünktl.'}
              </button>
            ))}
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stunden} margin={{ top:0, right:0, bottom:0, left:0 }}>
                <XAxis dataKey="h" tick={{ fontSize:9, fill:'#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', fontSize:10, borderRadius:6 }}
                  formatter={(v) => [typeof v === 'number' ? v : 0, chartMode]} />
                <Bar dataKey="value" radius={[3,3,0,0]}>
                  {stunden.map(entry => (
                    <Cell key={entry.h} fill={entry.h === nowH ? '#14b8a6' : '#334155'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Fahrer-Tab */}
      {tab === 'fahrer' && (
        <div className="p-4 flex flex-col gap-2">
          {drivers.map((d, i) => (
            <div key={d.name} className="rounded-lg bg-slate-800 border border-slate-700 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{TIER_MEDAL[d.tier]}</span>
                <span className="text-sm font-medium flex-1">{d.name}</span>
                <span className={cn('text-sm font-bold tabular-nums',
                  d.score >= 85 ? 'text-emerald-400' : d.score >= 70 ? 'text-amber-400' : 'text-red-400')}>{d.score}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-700 mb-2">
                <div className={cn('h-1.5 rounded-full', d.score >= 85 ? 'bg-emerald-400' : d.score >= 70 ? 'bg-amber-400' : 'bg-red-400')}
                  style={{ width:`${d.score}%` }} />
              </div>
              <div className="grid grid-cols-4 gap-1 text-center">
                {[
                  { label:'Touren', v:d.touren },
                  { label:'Pünktl.', v:`${d.puenktlichkeit}%` },
                  { label:'Trinkgeld', v:`€${d.trinkgeld.toFixed(0)}` },
                ].map(k => (
                  <div key={k.label} className="col-span-1">
                    <div className="text-xs font-semibold text-slate-200">{k.v}</div>
                    <div className="text-[9px] text-slate-500">{k.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zonen-Tab */}
      {tab === 'zonen' && (
        <div className="p-4 flex flex-col gap-2">
          {zonen.map(z => (
            <div key={z.zone} className="rounded-lg bg-slate-800 border border-slate-700 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium">{z.zone}</span>
                <span className={cn('text-xs font-bold tabular-nums', z.sla >= 90 ? 'text-emerald-400' : z.sla >= 80 ? 'text-amber-400' : 'text-red-400')}>
                  SLA {z.sla}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-700 mb-1.5">
                <div className={cn('h-1.5 rounded-full', z.kapazitaet >= 85 ? 'bg-emerald-400' : z.kapazitaet >= 70 ? 'bg-amber-400' : 'bg-red-400')}
                  style={{ width:`${z.kapazitaet}%` }} />
              </div>
              <div className="flex gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{z.avg_min}min</span>
                <span className="flex items-center gap-0.5 text-emerald-400"><Euro className="w-3 h-3" />€{z.umsatz}</span>
                <span className="text-slate-500">Kap. {z.kapazitaet}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Woche-Tab */}
      {tab === 'woche' && (
        <div className="p-4">
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={woche} margin={{ top:4, right:4, bottom:0, left:-24 }}>
                <XAxis dataKey="h" tick={{ fontSize:9, fill:'#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', fontSize:10, borderRadius:6 }} />
                <Line type="monotone" dataKey="value" stroke="#14b8a6" strokeWidth={2} dot={{ r:3, fill:'#14b8a6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px] text-slate-400">
            <div><div className="font-semibold text-slate-200 text-sm">€{woche.reduce((s,w)=>s+w.value,0)}</div><div>Ges. Woche</div></div>
            <div><div className="font-semibold text-emerald-400 text-sm">{Math.max(...woche.map(w=>w.value))}</div><div>Höchst.</div></div>
            <div><div className="font-semibold text-slate-200 text-sm">{Math.round(woche.reduce((s,w)=>s+w.value,0)/woche.length)}</div><div>Ø/Tag</div></div>
            <div><div className="font-semibold text-amber-400 text-sm">{Math.min(...woche.map(w=>w.value))}</div><div>Niedrigst.</div></div>
          </div>
        </div>
      )}
    </div>
  );
}
