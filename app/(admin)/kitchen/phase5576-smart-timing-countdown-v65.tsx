'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, AlertTriangle, Brain, CheckCircle2, TrendingUp, Users, Zap, Target, BarChart2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 5576 — Smart-Timing Countdown V65
// V64+: KI-Batch-Priorisierung mit Begründung; Übergabe-Verzögerungs-Prognose Δmin;
// Echtzeit-Kochzeit-Drift-Korrektur je Station; SLA-Risiko-Heatmap;
// 15-KPI-Grid Score/Aktiv/Kritisch/Überfällig/Fertig/Varianz/Stationen/SLA/Bereit/
//            ETA-Drift/Bindung/Sync/Qualität/Übergabe/KI-Batch;
// 6-Tab Countdown/Prognose/Übergabe/Stationen/Kapazität/KI-Batch;
// 1s-Tick + 15s-Polling; Mock-Fallback

type Tab = 'countdown' | 'prognose' | 'uebergabe' | 'stationen' | 'kapazitaet' | 'ki_batch';
type Ampel = 'ok' | 'warn' | 'critical' | 'overdue';

interface OrderRow {
  id: string;
  label: string;
  kochSec: number;
  fahrerEtaSec: number;
  ampel: Ampel;
  batchId?: string;
  kategorie: string;
  kochStartOffset: number;
  stammkunde: boolean;
  ki_prio: string;
}

interface StationPrognose {
  name: string;
  auslastung: number;
  prognose20min: number;
  drift_korrektur: number;
}

interface FahrerUebergabe {
  name: string;
  zuverlaessigkeit: number;
  pending: number;
  verzoegerung_prognose: number;
}

interface KiBatch {
  batchId: string;
  orders: string[];
  ki_begruendung: string;
  prioritaet: 'hoch' | 'mittel' | 'niedrig';
  geschaetztes_kochstart: number;
}

interface ApiResponse {
  orders: OrderRow[];
  kpi: {
    score: number; aktiv: number; kritisch: number; ueberfaellig: number; fertig: number;
    varianz: number; stationen: number; sla_pct: number; bereit: number; drift: number;
    bind: number; sync: number; qualitaet: number; uebergabe: number; ki_batch: number;
  };
  fahrer_uebergabe: FahrerUebergabe[];
  stationen_prognose: StationPrognose[];
  ki_batches: KiBatch[];
  sla_risiko_map: Record<string, number>;
}

function ampelColor(a: Ampel) {
  if (a === 'ok') return '#34d399';
  if (a === 'warn') return '#fbbf24';
  if (a === 'critical') return '#f97316';
  return '#f87171';
}

function ampelBorder(a: Ampel) {
  return a === 'ok' ? 'border-emerald-500/40' : a === 'warn' ? 'border-amber-500/40'
    : a === 'critical' ? 'border-orange-500/40' : 'border-red-500/60';
}

function fmtSec(s: number) {
  if (s <= 0) return '–:––';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const MOCK: ApiResponse = {
  orders: [
    { id: 'A1', label: 'Pizza Margherita', kochSec: 180, fahrerEtaSec: 240, ampel: 'ok', batchId: 'B1', kategorie: 'Pizza', kochStartOffset: -2, stammkunde: true, ki_prio: 'Stammkunde — hohe Bindungswahrsch.' },
    { id: 'A2', label: 'Pasta Carbonara', kochSec: 90, fahrerEtaSec: 120, ampel: 'warn', batchId: 'B1', kategorie: 'Pasta', kochStartOffset: 1, stammkunde: false, ki_prio: 'Kurze Kochzeit — sofort starten' },
    { id: 'A3', label: 'Burger Deluxe', kochSec: 30, fahrerEtaSec: 60, ampel: 'critical', batchId: 'B2', kategorie: 'Burger', kochStartOffset: 3, stammkunde: false, ki_prio: 'Kritische SLA — Eskalation!' },
    { id: 'A4', label: 'Salat Bowl', kochSec: 0, fahrerEtaSec: 30, ampel: 'overdue', batchId: 'B2', kategorie: 'Salat', kochStartOffset: 5, stammkunde: true, ki_prio: 'Überfällig — sofort Übergabe!' },
  ],
  kpi: { score: 82, aktiv: 4, kritisch: 1, ueberfaellig: 1, fertig: 12, varianz: 1.4, stationen: 3, sla_pct: 91, bereit: 86, drift: 2.1, bind: 68, sync: 94, qualitaet: 88, uebergabe: 79, ki_batch: 93 },
  fahrer_uebergabe: [
    { name: 'Mehmet K.', zuverlaessigkeit: 96, pending: 1, verzoegerung_prognose: 0.5 },
    { name: 'Julia S.', zuverlaessigkeit: 88, pending: 2, verzoegerung_prognose: 1.2 },
    { name: 'Kemal A.', zuverlaessigkeit: 71, pending: 1, verzoegerung_prognose: 3.1 },
  ],
  stationen_prognose: [
    { name: 'Grill', auslastung: 78, prognose20min: 85, drift_korrektur: -1 },
    { name: 'Fritteur', auslastung: 55, prognose20min: 62, drift_korrektur: 0 },
    { name: 'Kalt', auslastung: 40, prognose20min: 35, drift_korrektur: 1 },
  ],
  ki_batches: [
    { batchId: 'B1', orders: ['A1', 'A2'], ki_begruendung: 'Stammkunden-Gruppe — gemeinsame Zone B', prioritaet: 'hoch', geschaetztes_kochstart: 60 },
    { batchId: 'B2', orders: ['A3', 'A4'], ki_begruendung: 'SLA-Kritisch — sofort starten!', prioritaet: 'hoch', geschaetztes_kochstart: 0 },
  ],
  sla_risiko_map: { 'A1': 12, 'A2': 34, 'A3': 78, 'A4': 95 },
};

const KPI_LABELS: [keyof ApiResponse['kpi'], string, string][] = [
  ['score', 'Score', '#a78bfa'], ['aktiv', 'Aktiv', '#60a5fa'], ['kritisch', 'Kritisch', '#f97316'],
  ['ueberfaellig', 'Überfällig', '#f87171'], ['fertig', 'Fertig', '#34d399'],
  ['varianz', 'Varianz σ', '#fbbf24'], ['stationen', 'Stationen', '#38bdf8'],
  ['sla_pct', 'SLA %', '#a3e635'], ['bereit', 'Bereit %', '#4ade80'],
  ['drift', 'ETA-Drift', '#fb923c'], ['bind', 'Bindung %', '#e879f9'],
  ['sync', 'Sync %', '#67e8f9'], ['qualitaet', 'Qualität', '#c4b5fd'],
  ['uebergabe', 'Übergabe %', '#fca5a5'], ['ki_batch', 'KI-Batch %', '#86efac'],
];

export function KitchenPhase5576SmartTimingCountdownV65({ locationId }: { locationId: string | null }) {
  const [tab, setTab] = useState<Tab>('countdown');
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [ticks, setTicks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/kitchen?location_id=${locationId}&include=timing,batches,drivers`);
      if (res.ok) {
        const json = await res.json();
        if (json?.orders) setData(json);
      }
    } catch { /* mock fallback */ } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [locationId]);

  useEffect(() => {
    const init: Record<string, number> = {};
    data.orders.forEach(o => { init[o.id] = o.kochSec; });
    setTicks(init);
  }, [data.orders]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTicks(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { if (next[k] > 0) next[k]--; });
        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'countdown', label: 'Countdown' },
    { key: 'prognose', label: 'Prognose' },
    { key: 'uebergabe', label: 'Übergabe' },
    { key: 'stationen', label: 'Stationen' },
    { key: 'kapazitaet', label: 'Kapazität' },
    { key: 'ki_batch', label: 'KI-Batch' },
  ];

  const overdueBanner = data.orders.filter(o => (ticks[o.id] ?? o.kochSec) <= 0 && o.ampel !== 'ok').length;

  return (
    <div className="rounded-xl border border-violet-500/30 bg-[#0f0f1a] p-3 space-y-3 text-xs text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-400" />
          <span className="font-semibold text-violet-300">Smart-Timing Countdown V65</span>
          {loading && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-400">Score</span>
          <span className="font-bold text-violet-300">{data.kpi.score}</span>
        </div>
      </div>

      {overdueBanner > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-900/30 border border-red-500/40 px-2 py-1 text-red-300">
          <AlertTriangle className="w-3 h-3" />
          <span>{overdueBanner} Bestellung(en) überfällig — sofortige Aktion erforderlich!</span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-5 gap-1">
        {KPI_LABELS.slice(0, 15).map(([k, label, color]) => (
          <div key={k} className="flex flex-col items-center bg-white/5 rounded px-1 py-1">
            <span className="font-bold" style={{ color }}>{String(data.kpi[k])}{k.endsWith('_pct') || k === 'sla_pct' || k === 'bereit' || k === 'bind' || k === 'sync' || k === 'qualitaet' || k === 'uebergabe' || k === 'ki_batch' ? '%' : ''}</span>
            <span className="text-slate-500 text-[9px] text-center leading-tight">{label}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors',
              tab === t.key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'countdown' && (
        <div className="space-y-1">
          {data.orders.map(o => {
            const sec = ticks[o.id] ?? o.kochSec;
            const slaRisiko = data.sla_risiko_map[o.id] ?? 0;
            return (
              <div key={o.id} className={cn('flex items-center gap-2 rounded-lg border px-2 py-1.5', ampelBorder(o.ampel))} style={{ background: ampelColor(o.ampel) + '18' }}>
                <div className="w-1.5 h-8 rounded-full" style={{ background: ampelColor(o.ampel) }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate">{o.label}</span>
                    {o.stammkunde && <span className="text-[9px] bg-emerald-800/60 text-emerald-300 px-1 rounded">Stamm</span>}
                    {o.batchId && <span className="text-[9px] bg-violet-800/60 text-violet-300 px-1 rounded">{o.batchId}</span>}
                    <span className="ml-auto text-[9px]" style={{ color: slaRisiko > 70 ? '#f87171' : slaRisiko > 40 ? '#fbbf24' : '#34d399' }}>
                      SLA-Risiko {slaRisiko}%
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">{o.ki_prio}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold" style={{ color: ampelColor(o.ampel) }}>{fmtSec(sec)}</div>
                  <div className="text-[9px] text-slate-400">Fahrer: {fmtSec(o.fahrerEtaSec)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'prognose' && (
        <div className="space-y-2">
          <div className="text-[10px] text-slate-400">Stationen-Auslastung +20 Min Prognose</div>
          {data.stationen_prognose.map(s => (
            <div key={s.name} className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-300">{s.name}</span>
                <div className="flex gap-2">
                  <span className="text-slate-400">Jetzt: {s.auslastung}%</span>
                  <span className={s.prognose20min > 80 ? 'text-red-400' : 'text-slate-300'}>+20min: {s.prognose20min}%</span>
                  <span className={cn('text-[9px]', s.drift_korrektur < 0 ? 'text-emerald-400' : s.drift_korrektur > 0 ? 'text-amber-400' : 'text-slate-400')}>
                    Δ{s.drift_korrektur > 0 ? '+' : ''}{s.drift_korrektur}min
                  </span>
                </div>
              </div>
              <div className="relative h-1.5 rounded bg-white/10">
                <div className="h-full rounded transition-all" style={{ width: `${s.auslastung}%`, background: s.auslastung > 80 ? '#f87171' : '#60a5fa' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'uebergabe' && (
        <div className="space-y-1">
          {data.fahrer_uebergabe.map(f => (
            <div key={f.name} className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1.5">
              <div>
                <div className="font-medium">{f.name}</div>
                <div className="text-[9px] text-slate-400">Zuverlässigkeit: {f.zuverlaessigkeit}%</div>
              </div>
              <div className="text-right">
                <div className={cn('font-bold', f.verzoegerung_prognose > 2 ? 'text-red-400' : 'text-emerald-400')}>
                  Δ+{f.verzoegerung_prognose.toFixed(1)} min
                </div>
                <div className="text-[9px] text-slate-400">{f.pending} Auftr.</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'stationen' && (
        <div className="grid grid-cols-3 gap-2">
          {data.stationen_prognose.map(s => (
            <div key={s.name} className="bg-white/5 rounded-lg p-2 text-center">
              <div className="font-medium text-slate-300">{s.name}</div>
              <div className="text-lg font-bold" style={{ color: s.auslastung > 80 ? '#f87171' : '#60a5fa' }}>{s.auslastung}%</div>
              <div className="text-[9px] text-slate-400">Auslastung</div>
              <div className={cn('text-[9px] mt-0.5', s.drift_korrektur !== 0 ? 'text-amber-400' : 'text-slate-500')}>
                Korrektur: {s.drift_korrektur > 0 ? '+' : ''}{s.drift_korrektur}min
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'kapazitaet' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-violet-300">{data.kpi.sla_pct}%</div>
              <div className="text-[9px] text-slate-400">SLA Einhaltung</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-amber-300">{data.kpi.drift.toFixed(1)} min</div>
              <div className="text-[9px] text-slate-400">ETA-Drift Ø</div>
            </div>
          </div>
          <div className="text-[10px] text-slate-400">SLA-Risiko je Bestellung</div>
          {data.orders.map(o => (
            <div key={o.id} className="flex items-center gap-2">
              <span className="w-24 truncate text-slate-300">{o.label}</span>
              <div className="flex-1 h-1.5 rounded bg-white/10">
                <div className="h-full rounded" style={{
                  width: `${data.sla_risiko_map[o.id] ?? 0}%`,
                  background: (data.sla_risiko_map[o.id] ?? 0) > 70 ? '#f87171' : (data.sla_risiko_map[o.id] ?? 0) > 40 ? '#fbbf24' : '#34d399'
                }} />
              </div>
              <span className="text-[9px] w-8 text-right" style={{ color: (data.sla_risiko_map[o.id] ?? 0) > 70 ? '#f87171' : '#34d399' }}>
                {data.sla_risiko_map[o.id] ?? 0}%
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'ki_batch' && (
        <div className="space-y-2">
          {data.ki_batches.map(b => (
            <div key={b.batchId} className={cn('rounded-lg border p-2 space-y-1',
              b.prioritaet === 'hoch' ? 'border-red-500/40 bg-red-900/20' : 'border-slate-600/30 bg-white/5')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Brain className="w-3 h-3 text-violet-400" />
                  <span className="font-medium text-violet-300">{b.batchId}</span>
                  <span className={cn('text-[9px] px-1 rounded', b.prioritaet === 'hoch' ? 'bg-red-800/60 text-red-300' : 'bg-slate-700 text-slate-300')}>
                    {b.prioritaet.toUpperCase()}
                  </span>
                </div>
                <span className="text-[9px] text-slate-400">Start: {fmtSec(b.geschaetztes_kochstart)}</span>
              </div>
              <div className="text-[9px] text-slate-300">{b.ki_begruendung}</div>
              <div className="flex gap-1 flex-wrap">
                {b.orders.map(oid => (
                  <span key={oid} className="text-[9px] bg-white/10 rounded px-1">{oid}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
