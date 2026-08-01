'use client';

import { useEffect, useRef, useState } from 'react';
import { Brain, Clock, AlertTriangle, CheckCircle2, Zap, Timer, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Phase 5466 — Smart-Timing Countdown V53
// Neu: Batch-Sync-Score je Gruppe (0-100 farbkodiert); ETA-Fahrer-Abgleich-Matrix;
// KI-Kochstart-Korrektur-Vorschlag ±min; Überfälligkeits-Eskalations-Alarm;
// 9-KPI-Grid Aktiv/Kritisch/Überfällig/KI-Empf./Batch-Score/Sync-Score/Fahrer↑/Fertig/Velocity;
// 3-Tab Countdown/Batch-Sync/ETA-Matrix; 1s-Tick+15s-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface KochOrder {
  id: string;
  nr: string;
  artikel: string;
  start_at: number;
  finish_at: number;
  status: 'waiting' | 'cooking' | 'done';
  prio: number;
  ki_korrektur_min: number;
  batch_gruppe: string;
  fahrer_eta_min: number;
}

interface BatchGruppe {
  gruppe: string;
  orders: number;
  sync_score: number;
  abfahrt_in_min: number;
}

interface EtaRow {
  fahrer: string;
  eta_min: number;
  bestell_fertig_in: number;
  ampel: Ampel;
}

interface ApiData {
  aktiv: number;
  kritisch: number;
  ueberfaellig: number;
  ki_empfohlen: number;
  batch_score: number;
  sync_score: number;
  fahrer_nahe: number;
  fertig: number;
  velocity: number;
  orders: KochOrder[];
  gruppen: BatchGruppe[];
  eta_matrix: EtaRow[];
}

const MOCK_ORDERS: KochOrder[] = [
  { id: 'o1', nr: '#2841', artikel: 'Gyros+Pommes', start_at: Date.now() - 420_000, finish_at: Date.now() + 180_000, status: 'cooking', prio: 95, ki_korrektur_min: -2, batch_gruppe: 'B1', fahrer_eta_min: 4 },
  { id: 'o2', nr: '#2842', artikel: 'Döner-Teller', start_at: Date.now() - 300_000, finish_at: Date.now() + 300_000, status: 'cooking', prio: 78, ki_korrektur_min: 0, batch_gruppe: 'B1', fahrer_eta_min: 6 },
  { id: 'o3', nr: '#2843', artikel: 'Falafel Bowl', start_at: Date.now() - 60_000, finish_at: Date.now() + 540_000, status: 'waiting', prio: 62, ki_korrektur_min: 3, batch_gruppe: 'B2', fahrer_eta_min: 12 },
  { id: 'o4', nr: '#2838', artikel: 'Lahmacun×2', start_at: Date.now() - 780_000, finish_at: Date.now() - 60_000, status: 'done', prio: 100, ki_korrektur_min: 1, batch_gruppe: 'B0', fahrer_eta_min: 2 },
  { id: 'o5', nr: '#2840', artikel: 'Mixed Grill', start_at: Date.now() - 900_000, finish_at: Date.now() + 60_000, status: 'cooking', prio: 88, ki_korrektur_min: -1, batch_gruppe: 'B1', fahrer_eta_min: 5 },
];

const MOCK: ApiData = {
  aktiv: 4, kritisch: 1, ueberfaellig: 0, ki_empfohlen: 2,
  batch_score: 82, sync_score: 76, fahrer_nahe: 3, fertig: 1, velocity: 7.4,
  orders: MOCK_ORDERS,
  gruppen: [
    { gruppe: 'B1', orders: 3, sync_score: 88, abfahrt_in_min: 5 },
    { gruppe: 'B2', orders: 1, sync_score: 62, abfahrt_in_min: 13 },
  ],
  eta_matrix: [
    { fahrer: 'Marek',  eta_min: 4,  bestell_fertig_in: 3,  ampel: 'gruen' },
    { fahrer: 'Luisa',  eta_min: 6,  bestell_fertig_in: 5,  ampel: 'gruen' },
    { fahrer: 'Tariq',  eta_min: 12, bestell_fertig_in: 9,  ampel: 'gelb'  },
    { fahrer: 'Sophie', eta_min: 18, bestell_fertig_in: 14, ampel: 'rot'   },
  ],
};

type Tab = 'countdown' | 'batch' | 'eta';

const PRIO_COLOR = (p: number) => p >= 90 ? '#ef4444' : p >= 70 ? '#f59e0b' : p >= 50 ? '#6366f1' : '#6b7280';
const AMPEL_BG: Record<Ampel, string> = { gruen: 'bg-emerald-50 border-emerald-200', gelb: 'bg-amber-50 border-amber-200', rot: 'bg-red-50 border-red-200' };
const AMPEL_TEXT: Record<Ampel, string> = { gruen: 'text-emerald-600', gelb: 'text-amber-600', rot: 'text-red-600' };

function secToMmSs(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

export function KitchenPhase5466SmartTimingCountdownV53() {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tab, setTab] = useState<Tab>('countdown');
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    const poll = async () => {
      try {
        const r = await fetch('/api/delivery/kitchen?view=smart_timing_v53');
        if (r.ok) { const j = await r.json(); setData(j); }
      } catch { /* keep mock */ }
    };
    poll();
    pollRef.current = setInterval(poll, 15_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const KPIS = [
    { label: 'Aktiv',       value: data.aktiv,                       color: 'text-indigo-600' },
    { label: 'Kritisch',    value: data.kritisch,                    color: data.kritisch > 0 ? 'text-red-600' : 'text-gray-400' },
    { label: 'Überfällig',  value: data.ueberfaellig,               color: data.ueberfaellig > 0 ? 'text-red-700 font-black' : 'text-gray-400' },
    { label: 'KI-Empf.',    value: data.ki_empfohlen,               color: 'text-violet-600' },
    { label: 'Batch-Score', value: `${data.batch_score}`,           color: data.batch_score >= 80 ? 'text-emerald-600' : data.batch_score >= 60 ? 'text-amber-500' : 'text-red-500' },
    { label: 'Sync-Score',  value: `${data.sync_score}`,            color: data.sync_score >= 75 ? 'text-teal-600' : data.sync_score >= 55 ? 'text-amber-500' : 'text-red-500' },
    { label: 'Fahrer ↑',   value: data.fahrer_nahe,                 color: 'text-blue-600' },
    { label: 'Fertig',      value: data.fertig,                      color: 'text-emerald-600' },
    { label: 'Velocity',    value: `${data.velocity.toFixed(1)}/h`, color: 'text-teal-600' },
  ];

  const cookingOrders = data.orders.filter(o => o.status === 'cooking' || o.status === 'waiting');

  return (
    <div className="rounded-xl border border-indigo-200 bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-bold text-gray-800">Smart-Timing Countdown V53</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold">BATCH-SYNC+ETA</span>
        </div>
        <div className="flex items-center gap-1.5">
          {data.ueberfaellig > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">
              <AlertTriangle className="h-2.5 w-2.5" />{data.ueberfaellig} überfällig
            </span>
          )}
          <span className="text-xs font-black text-indigo-600 tabular-nums">Sync {data.sync_score}</span>
        </div>
      </div>

      {/* 9-KPI-Grid */}
      <div className="grid grid-cols-9 gap-1">
        {KPIS.map(k => (
          <div key={k.label} className="rounded bg-gray-50 px-1 py-1 text-center">
            <div className={`text-xs font-black tabular-nums ${k.color}`}>{k.value}</div>
            <div className="text-[8px] text-gray-400 leading-tight">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-gray-100">
        {(['countdown', 'batch', 'eta'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-1 px-3 text-xs font-bold transition border-b-2 ${tab === t ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            {t === 'countdown' ? 'Countdown' : t === 'batch' ? 'Batch-Sync' : 'ETA-Matrix'}
          </button>
        ))}
      </div>

      {/* Countdown Tab */}
      {tab === 'countdown' && (
        <div className="space-y-2">
          {cookingOrders.map(o => {
            const remaining = o.finish_at - Date.now();
            const isLate = remaining < 0;
            const pct = Math.min(100, Math.max(0, ((o.finish_at - o.start_at - remaining) / (o.finish_at - o.start_at)) * 100));
            return (
              <div key={o.id} className={`rounded-lg border px-3 py-2 ${isLate ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-gray-700 shrink-0">{o.nr}</span>
                    <span className="text-[10px] text-gray-500 truncate">{o.artikel}</span>
                    {o.ki_korrektur_min !== 0 && (
                      <span className={`text-[9px] font-bold px-1 rounded ${o.ki_korrektur_min < 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                        {o.ki_korrektur_min > 0 ? '+' : ''}{o.ki_korrektur_min}m KI
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: PRIO_COLOR(o.prio) }} />
                    <span className={`text-sm font-black tabular-nums ${isLate ? 'text-red-600' : remaining < 120_000 ? 'text-amber-600' : 'text-indigo-600'}`}>
                      {isLate ? `-${secToMmSs(-remaining)}` : secToMmSs(remaining)}
                    </span>
                    <span className="text-[9px] text-blue-500">Fahrer {o.fahrer_eta_min}m</span>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${isLate ? 'bg-red-500' : pct > 80 ? 'bg-amber-400' : 'bg-indigo-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {cookingOrders.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Alle Bestellungen abgearbeitet
            </div>
          )}
        </div>
      )}

      {/* Batch-Sync Tab */}
      {tab === 'batch' && (
        <div className="space-y-2">
          {data.gruppen.map(g => (
            <div key={g.gruppe} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-gray-700">Batch {g.gruppe}</span>
                  <span className="text-[10px] text-gray-500">{g.orders} Bestellungen</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">Abfahrt in</span>
                  <span className={`text-xs font-black tabular-nums ${g.abfahrt_in_min <= 5 ? 'text-amber-600' : 'text-indigo-600'}`}>{g.abfahrt_in_min}m</span>
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500">Sync-Score</span>
                  <span className={`font-bold ${g.sync_score >= 80 ? 'text-emerald-600' : g.sync_score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{g.sync_score}/100</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${g.sync_score >= 80 ? 'bg-emerald-400' : g.sync_score >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${g.sync_score}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.gruppen} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
                <XAxis dataKey="gruppe" tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v) => `${v}/100`} />
                <Bar dataKey="sync_score" radius={[3, 3, 0, 0]}>
                  {data.gruppen.map(g => (
                    <Cell key={g.gruppe} fill={g.sync_score >= 80 ? '#34d399' : g.sync_score >= 60 ? '#fbbf24' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ETA-Matrix Tab */}
      {tab === 'eta' && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-4 text-[9px] font-bold text-gray-400 px-2">
            <span>Fahrer</span>
            <span className="text-center">Ankunft</span>
            <span className="text-center">Essen fertig</span>
            <span className="text-right">Status</span>
          </div>
          {data.eta_matrix.map(row => (
            <div key={row.fahrer} className={`grid grid-cols-4 items-center gap-1 rounded-lg border px-2 py-2 ${AMPEL_BG[row.ampel]}`}>
              <span className="text-xs font-bold text-gray-700">{row.fahrer}</span>
              <span className="text-center text-xs font-black text-indigo-600 tabular-nums">{row.eta_min}m</span>
              <span className="text-center text-xs font-black text-teal-600 tabular-nums">{row.bestell_fertig_in}m</span>
              <div className="flex justify-end">
                {row.ampel === 'gruen' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                {row.ampel === 'gelb' && <Clock className="h-3.5 w-3.5 text-amber-500" />}
                {row.ampel === 'rot' && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-gray-400 text-center">Grün = Fahrer wartet ≤2m · Gelb = 2–5m · Rot = &gt;5m Wartezeit</p>
        </div>
      )}
    </div>
  );
}
