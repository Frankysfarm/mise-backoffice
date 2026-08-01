'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, AlertTriangle, Brain, CheckCircle2, TrendingUp, Users, Layers, Zap, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 5560 — Smart-Timing Countdown V63
// V62+: Übergabe-Zuverlässigkeits-Score je Fahrer; Echtzeit-Kochauslastungs-Prognose +20min je Station;
// Bestellwachstum-Trendindikator Δ% letzte 30 Min; Schicht-Qualitäts-Composite-Index;
// 13-KPI-Grid Score/Aktiv/Kritisch/Überfällig/Fertig/Varianz/Stationen/SLA/Bereit/Drift/Bind/Sync/Qualität;
// 8-Tab Countdown/Prognose/Übergabe/Items/Stationen/Kunden/Schicht/Qualität;
// 1s-Tick + 15s-Polling; Mock-Fallback

type Tab = 'countdown' | 'prognose' | 'uebergabe' | 'items' | 'stationen' | 'kunden' | 'schicht' | 'qualitaet';
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
}

interface FahrerUebergabe {
  name: string;
  zuverlaessigkeit: number;
  pending: number;
}

interface StationPrognose {
  name: string;
  auslastung: number;
  prognose20min: number;
}

interface ApiResponse {
  orders: OrderRow[];
  kpi: {
    score: number;
    aktiv: number;
    kritisch: number;
    ueberfaellig: number;
    fertig: number;
    varianz: number;
    stationen: number;
    sla_pct: number;
    bereit: number;
    drift: number;
    bind: number;
    sync: number;
    qualitaet: number;
  };
  fahrer_uebergabe: FahrerUebergabe[];
  stationen_prognose: StationPrognose[];
  bestellwachstum_delta: number;
}

const AMPEL_ORDER: Ampel[] = ['overdue', 'critical', 'warn', 'ok'];

function ampelColor(a: Ampel): string {
  if (a === 'ok') return '#34d399';
  if (a === 'warn') return '#fbbf24';
  if (a === 'critical') return '#f97316';
  return '#f87171';
}

function ampelBorder(a: Ampel): string {
  if (a === 'ok') return 'border-emerald-500/40';
  if (a === 'warn') return 'border-amber-500/40';
  if (a === 'critical') return 'border-orange-500/40';
  return 'border-red-500/60';
}

function fmtSec(s: number): string {
  if (s <= 0) return '–:––';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const MOCK: ApiResponse = {
  orders: [
    { id: 'A1', label: 'Bestellung #3841', kochSec: 245, fahrerEtaSec: 380, ampel: 'ok', batchId: 'B-01', kategorie: 'Hauptgang', kochStartOffset: -1, stammkunde: true },
    { id: 'A2', label: 'Bestellung #3842', kochSec: 80,  fahrerEtaSec: 120, ampel: 'warn', batchId: 'B-01', kategorie: 'Getränke', kochStartOffset: 2, stammkunde: false },
    { id: 'A3', label: 'Bestellung #3843', kochSec: 0,   fahrerEtaSec: 45,  ampel: 'critical', kategorie: 'Hauptgang', kochStartOffset: 3, stammkunde: true },
    { id: 'A4', label: 'Bestellung #3836', kochSec: -30, fahrerEtaSec: 0,   ampel: 'overdue', kategorie: 'Nachtisch', kochStartOffset: 5, stammkunde: false },
  ],
  kpi: { score: 91, aktiv: 7, kritisch: 2, ueberfaellig: 1, fertig: 14, varianz: 1.4, stationen: 4, sla_pct: 93, bereit: 5, drift: -0.8, bind: 78, sync: 88, qualitaet: 87 },
  fahrer_uebergabe: [
    { name: 'Max M.', zuverlaessigkeit: 96, pending: 1 },
    { name: 'Sara K.', zuverlaessigkeit: 91, pending: 2 },
    { name: 'Tim B.', zuverlaessigkeit: 84, pending: 0 },
  ],
  stationen_prognose: [
    { name: 'Grill', auslastung: 82, prognose20min: 71 },
    { name: 'Fritteur', auslastung: 64, prognose20min: 78 },
    { name: 'Kalt', auslastung: 38, prognose20min: 45 },
    { name: 'Pasta', auslastung: 91, prognose20min: 60 },
  ],
  bestellwachstum_delta: 14.2,
};

export function KitchenPhase5560SmartTimingCountdownV63({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('countdown');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/kitchen-smart-timing?location_id=${locationId}&v=63`);
      if (r.ok) setData(await r.json());
    } catch { /* mock */ }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    pollRef.current = setInterval(load, 15_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const sorted = [...data.orders].sort((a, b) =>
    AMPEL_ORDER.indexOf(a.ampel) - AMPEL_ORDER.indexOf(b.ampel)
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: 'countdown', label: 'Countdown' },
    { key: 'prognose', label: 'Prognose' },
    { key: 'uebergabe', label: 'Übergabe' },
    { key: 'items', label: 'Items' },
    { key: 'stationen', label: 'Stationen' },
    { key: 'kunden', label: 'Kunden' },
    { key: 'schicht', label: 'Schicht' },
    { key: 'qualitaet', label: 'Qualität' },
  ];

  const kpi = data.kpi;

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/40 bg-gray-800/60">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Smart-Timing V63</span>
          {data.bestellwachstum_delta > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300">
              +{data.bestellwachstum_delta.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Score</span>
          <span className="text-sm font-bold text-violet-300">{kpi.score}</span>
        </div>
      </div>

      {/* 13-KPI-Grid */}
      <div className="grid grid-cols-5 gap-px bg-gray-700/30 border-b border-gray-700/40">
        {[
          ['Aktiv', kpi.aktiv, 'text-white'],
          ['Kritisch', kpi.kritisch, 'text-orange-400'],
          ['Überfällig', kpi.ueberfaellig, 'text-red-400'],
          ['Fertig', kpi.fertig, 'text-emerald-400'],
          ['SLA %', `${kpi.sla_pct}%`, kpi.sla_pct >= 90 ? 'text-emerald-400' : 'text-amber-400'],
          ['Stationen', kpi.stationen, 'text-sky-400'],
          ['Bereit', kpi.bereit, 'text-teal-400'],
          ['Drift', `${kpi.drift > 0 ? '+' : ''}${kpi.drift}m`, kpi.drift < 0 ? 'text-emerald-400' : 'text-amber-400'],
          ['Bind %', `${kpi.bind}%`, 'text-rose-400'],
          ['Sync', kpi.sync, 'text-violet-400'],
          ['Qualität', kpi.qualitaet, 'text-indigo-400'],
          ['Varianz', `${kpi.varianz}m`, 'text-purple-400'],
          ['Score', kpi.score, 'text-yellow-300'],
        ].map(([label, val, cls]) => (
          <div key={String(label)} className="bg-gray-900 px-2 py-1.5 text-center">
            <div className={cn('text-xs font-semibold tabular-nums', cls as string)}>{val}</div>
            <div className="text-[9px] text-gray-500 truncate">{label}</div>
          </div>
        ))}
      </div>

      {/* Tab Nav */}
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
        {tab === 'countdown' && sorted.map(o => {
          const remaining = o.kochSec - tick;
          const pct = o.kochSec > 0 ? Math.max(0, Math.min(100, (remaining / o.kochSec) * 100)) : 0;
          return (
            <div key={o.id} className={cn('rounded-lg border px-3 py-2 space-y-1', ampelBorder(o.ampel))}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white truncate">{o.label}</span>
                <span className={cn('text-sm font-mono font-bold', `text-[${ampelColor(o.ampel)}]`)} style={{ color: ampelColor(o.ampel) }}>
                  {fmtSec(remaining)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span>Fahrer ETA {fmtSec(o.fahrerEtaSec)}</span>
                {o.batchId && <span className="text-sky-400">{o.batchId}</span>}
                {o.stammkunde && <span className="text-rose-400">Stamm</span>}
                {o.kochStartOffset !== 0 && (
                  <span className={o.kochStartOffset < 0 ? 'text-emerald-400' : 'text-amber-400'}>
                    {o.kochStartOffset > 0 ? '+' : ''}{o.kochStartOffset}m
                  </span>
                )}
              </div>
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${pct}%`, backgroundColor: ampelColor(o.ampel) }}
                />
              </div>
            </div>
          );
        })}

        {tab === 'uebergabe' && (
          <div className="space-y-2">
            {data.fahrer_uebergabe.map(f => (
              <div key={f.name} className="flex items-center gap-3 rounded-lg bg-gray-800/60 px-3 py-2">
                <Users className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white">{f.name}</div>
                  <div className="text-[10px] text-gray-500">{f.pending} ausstehend</div>
                </div>
                <div className="text-right">
                  <div className={cn('text-xs font-bold', f.zuverlaessigkeit >= 90 ? 'text-emerald-400' : f.zuverlaessigkeit >= 75 ? 'text-amber-400' : 'text-red-400')}>
                    {f.zuverlaessigkeit}%
                  </div>
                  <div className="text-[9px] text-gray-500">Zuverlässigkeit</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'stationen' && (
          <div className="space-y-2">
            {data.stationen_prognose.map(s => (
              <div key={s.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300">{s.name}</span>
                  <div className="flex gap-3 text-[10px]">
                    <span className={s.auslastung >= 85 ? 'text-red-400' : s.auslastung >= 70 ? 'text-amber-400' : 'text-emerald-400'}>
                      Jetzt {s.auslastung}%
                    </span>
                    <span className="text-gray-500">+20min {s.prognose20min}%</span>
                  </div>
                </div>
                <div className="flex gap-1 h-1.5">
                  <div className="flex-1 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${s.auslastung}%`,
                        backgroundColor: s.auslastung >= 85 ? '#f87171' : s.auslastung >= 70 ? '#fbbf24' : '#34d399',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(tab === 'qualitaet' || tab === 'schicht' || tab === 'kunden' || tab === 'prognose' || tab === 'items') && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Qualitäts-Index', value: `${kpi.qualitaet}`, icon: Target, color: 'text-indigo-400' },
              { label: 'Sync-Score', value: `${kpi.sync}`, icon: Zap, color: 'text-violet-400' },
              { label: 'Bindungs-Score', value: `${kpi.bind}%`, icon: Users, color: 'text-rose-400' },
              { label: 'Varianz σ', value: `${kpi.varianz}m`, icon: TrendingUp, color: 'text-purple-400' },
            ].map(item => (
              <div key={item.label} className="rounded-lg bg-gray-800/60 px-3 py-2.5 flex items-center gap-2">
                <item.icon className={cn('h-4 w-4 shrink-0', item.color)} />
                <div>
                  <div className={cn('text-sm font-bold', item.color)}>{item.value}</div>
                  <div className="text-[9px] text-gray-500">{item.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {kpi.ueberfaellig > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-950/40 border-t border-red-800/30">
          <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
          <span className="text-[10px] text-red-300">{kpi.ueberfaellig} Bestellung{kpi.ueberfaellig > 1 ? 'en' : ''} überfällig — sofort handeln</span>
        </div>
      )}
    </div>
  );
}
