'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LineChart, Line, YAxis } from 'recharts';
import { Activity, TrendingUp, TrendingDown, Award, Star, AlertCircle, Euro, Clock, Target, Users, Percent, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPI {
  label: string;
  wert: number | string;
  delta?: number;
  ziel?: number;
  einheit?: string;
  ampel: 'gruen' | 'gelb' | 'rot';
  icon?: React.ReactNode;
}

interface Fahrer { name: string; score: number; touren: number; trinkgeld: number; puenktl: number; delta: number; }
interface ZoneRow { zone: string; sla: number; avg_min: number; umsatz: number; kapazitaet: number; }
interface StundeBar { stunde: string; wert: number; jetzt: boolean; }
interface WocheBar { tag: string; heute: number; vw: number; }

interface DashData {
  gesamt_score: number;
  score_delta: number;
  ziel_score: number;
  kpis: KPI[];
  stunden: StundeBar[];
  wochen: WocheBar[];
  fahrer: Fahrer[];
  zonen: ZoneRow[];
  alerts: string[];
}

const MOCK: DashData = {
  gesamt_score: 89,
  score_delta: +5,
  ziel_score: 93,
  alerts: ['Zone Süd: SLA unter 78%', '2 Fahrer offline'],
  kpis: [
    { label: 'Umsatz',        wert: '2.016 €',  ampel: 'gruen', delta: +9,   ziel: 2200, icon: <Euro className="w-3 h-3" /> },
    { label: 'Bestellungen',  wert: 54,          ampel: 'gruen', delta: +6,   ziel: 60,   icon: <Target className="w-3 h-3" /> },
    { label: 'Lieferzeit',    wert: '23 min',    ampel: 'gelb',  delta: +1,   ziel: 22,   icon: <Clock className="w-3 h-3" /> },
    { label: 'Pünktlichkeit', wert: '84 %',      ampel: 'gelb',  delta: -2,   ziel: 90,   icon: <Percent className="w-3 h-3" /> },
    { label: 'Storno-Quote',  wert: '2.8 %',     ampel: 'gelb',  delta: -0.5, ziel: 2,    icon: <AlertCircle className="w-3 h-3" /> },
    { label: 'Bewertung',     wert: '4.7 ★',     ampel: 'gruen', delta: +0.1, ziel: 4.5,  icon: <Star className="w-3 h-3" /> },
    { label: 'Trinkgeld',     wert: '148 €',     ampel: 'gruen', delta: +11,  ziel: 140,  icon: <Award className="w-3 h-3" /> },
    { label: 'Marge',         wert: '36 %',      ampel: 'gelb',  delta: -1,   ziel: 40,   icon: <BarChart3 className="w-3 h-3" /> },
    { label: 'Fahrer aktiv',  wert: 7,           ampel: 'gruen', delta: 0,    ziel: 8,    icon: <Users className="w-3 h-3" /> },
  ],
  stunden: [
    { stunde: '11', wert: 4,  jetzt: false },
    { stunde: '12', wert: 9,  jetzt: false },
    { stunde: '13', wert: 11, jetzt: false },
    { stunde: '14', wert: 7,  jetzt: false },
    { stunde: '15', wert: 5,  jetzt: false },
    { stunde: '16', wert: 6,  jetzt: false },
    { stunde: '17', wert: 8,  jetzt: false },
    { stunde: '18', wert: 12, jetzt: false },
    { stunde: '19', wert: 15, jetzt: true  },
    { stunde: '20', wert: 0,  jetzt: false },
  ],
  wochen: [
    { tag: 'Mo', heute: 38, vw: 32 },
    { tag: 'Di', heute: 44, vw: 39 },
    { tag: 'Mi', heute: 51, vw: 46 },
    { tag: 'Do', heute: 49, vw: 52 },
    { tag: 'Fr', heute: 54, vw: 48 },
    { tag: 'Sa', heute: 0,  vw: 62 },
    { tag: 'So', heute: 0,  vw: 58 },
  ],
  fahrer: [
    { name: 'Marco R.',  score: 94, touren: 12, trinkgeld: 34, puenktl: 97, delta: +3 },
    { name: 'Lena K.',   score: 81, touren: 9,  trinkgeld: 22, puenktl: 88, delta: -2 },
    { name: 'Tobias M.', score: 67, touren: 7,  trinkgeld: 18, puenktl: 74, delta: +1 },
  ],
  zonen: [
    { zone: 'Nord',  sla: 92, avg_min: 21, umsatz: 780, kapazitaet: 85 },
    { zone: 'Mitte', sla: 88, avg_min: 24, umsatz: 640, kapazitaet: 72 },
    { zone: 'Süd',   sla: 76, avg_min: 28, umsatz: 420, kapazitaet: 58 },
    { zone: 'West',  sla: 90, avg_min: 22, umsatz: 560, kapazitaet: 80 },
  ],
};

const AMP: Record<string, { bg: string; text: string; dot: string }> = {
  gruen: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  gelb:  { bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  rot:   { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-500' },
};

type TabKey = 'stunden' | 'fahrer' | 'zonen' | 'woche';

export function LieferdienstPhase5137StatistikenDashboardV32({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<DashData>(MOCK);
  const [tab, setTab] = useState<TabKey>('stunden');

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/lieferdienst/stats?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch { /* keep mock */ }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const scorePct = Math.round((data.gesamt_score / data.ziel_score) * 100);

  return (
    <div className="rounded-xl border border-teal-500/20 bg-slate-900/80 backdrop-blur p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-400" />
          <span className="font-semibold text-white text-sm">Statistiken V32</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-white tabular-nums">{data.gesamt_score}</span>
          <div>
            {data.score_delta > 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
            <span className={cn('text-xs', data.score_delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
              {data.score_delta > 0 ? '+' : ''}{data.score_delta}
            </span>
          </div>
        </div>
      </div>

      {/* Score Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Score-Ziel: {data.ziel_score}</span>
          <span>{scorePct}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-teal-500 transition-all"
            style={{ width: `${Math.min(100, scorePct)}%` }}
          />
        </div>
      </div>

      {/* Alert Strip */}
      {data.alerts.length > 0 && (
        <div className="space-y-1">
          {data.alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded px-2 py-1 text-xs text-red-400">
              <AlertCircle className="w-3 h-3 shrink-0" />{a}
            </div>
          ))}
        </div>
      )}

      {/* 9-KPI Grid */}
      <div className="grid grid-cols-3 gap-2">
        {data.kpis.map(k => {
          const ac = AMP[k.ampel];
          return (
            <div key={k.label} className={cn('rounded-lg p-2 space-y-1', ac.bg)}>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className={ac.text}>{k.icon}</span>
                <span>{k.label}</span>
              </div>
              <div className={cn('text-sm font-bold tabular-nums', ac.text)}>{k.wert}</div>
              {k.delta !== undefined && (
                <div className="flex items-center gap-0.5 text-[10px] text-slate-500">
                  {k.delta > 0 ? <TrendingUp className="w-2.5 h-2.5 text-emerald-400" /> : k.delta < 0 ? <TrendingDown className="w-2.5 h-2.5 text-red-400" /> : null}
                  <span>{k.delta > 0 ? '+' : ''}{k.delta}</span>
                  {k.ziel !== undefined && <span className="text-slate-600">/ Ziel {k.ziel}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1">
        {(['stunden', 'fahrer', 'zonen', 'woche'] as TabKey[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 text-xs py-1 rounded-lg font-medium transition-colors capitalize',
              tab === t ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            )}
          >{t}</button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'stunden' && (
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={data.stunden} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="stunde" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="wert" radius={[3, 3, 0, 0]}>
              {data.stunden.map((s, i) => (
                <rect key={i} fill={s.jetzt ? '#14b8a6' : '#1d4ed8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {tab === 'fahrer' && (
        <div className="space-y-2">
          {data.fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2">
              <span className="text-base">{['🥇', '🥈', '🥉'][i] ?? ''}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-white">{f.name}</span>
                  <div className="flex items-center gap-1">
                    {f.delta > 0 ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
                    <span className="text-slate-300 font-bold">{f.score}</span>
                  </div>
                </div>
                <div className="h-1 bg-slate-700 rounded-full mt-0.5">
                  <div className="h-full rounded-full bg-teal-500" style={{ width: `${f.score}%` }} />
                </div>
                <div className="flex gap-3 text-[10px] text-slate-500 mt-0.5">
                  <span>{f.touren} Touren</span>
                  <span>{f.trinkgeld}€ TG</span>
                  <span>{f.puenktl}% Pünktl</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'zonen' && (
        <div className="space-y-1.5">
          {data.zonen.map(z => (
            <div key={z.zone} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white font-medium">{z.zone}</span>
                <div className="flex gap-3 text-slate-400">
                  <span>SLA {z.sla}%</span>
                  <span>{z.avg_min}min</span>
                  <span>{z.umsatz}€</span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full', z.sla >= 90 ? 'bg-emerald-500' : z.sla >= 80 ? 'bg-amber-500' : 'bg-red-500')}
                  style={{ width: `${z.kapazitaet}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'woche' && (
        <ResponsiveContainer width="100%" height={80}>
          <LineChart data={data.wochen} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="tag" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="heute" stroke="#14b8a6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="vw" stroke="#475569" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="text-[10px] text-slate-600 text-right">60-Sek-Polling · Mock-Fallback</div>
    </div>
  );
}
