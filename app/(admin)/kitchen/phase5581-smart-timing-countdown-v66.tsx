'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, AlertTriangle, Brain, CheckCircle2, TrendingUp, Zap, Target, BarChart2, RefreshCw, Thermometer, Pause, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 5581 — Smart-Timing Countdown V66
// V65+: Schicht-Temperatur-Indikator (Auslastungs-Grad °C-Metapher);
// Batch-Synchronisations-Score (wie gut Batches zeitlich abgestimmt sind);
// Automatische Pausenplanung (nächste Pause-Empfehlung bei Überauslastung);
// Koch-Fehler-Erkennung (abweichende Zeiten vs. Ziel-Kochzeit);
// 16-KPI-Grid Score/Aktiv/Kritisch/Überfällig/Fertig/Varianz/Stationen/SLA/
//             Bereit/Drift/Sync/Qualität/Übergabe/KI-Batch/Temp/Fehler;
// 7-Tab Countdown/Prognose/Übergabe/Stationen/Kapazität/KI-Batch/Fehler;
// 1s-Tick + 15s-Polling; Mock-Fallback

type Tab = 'countdown' | 'prognose' | 'uebergabe' | 'stationen' | 'kapazitaet' | 'ki_batch' | 'fehler';
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
  ki_prio: string;
  zielKochzeit: number;
  abweichung: number;
}

interface StationPrognose {
  name: string;
  auslastung: number;
  temperatur: number;
  prognose20min: number;
  drift: number;
}

interface FahrerUebergabe {
  name: string;
  zuverlaessigkeit: number;
  pending: number;
  verzoegerung: number;
}

interface KiBatch {
  batchId: string;
  orders: string[];
  sync_score: number;
  ki_begruendung: string;
  prioritaet: 'hoch' | 'mittel' | 'niedrig';
}

interface FehlerEntry {
  orderId: string;
  station: string;
  abweichungSec: number;
  grund: string;
}

interface PauseEmpfehlung {
  station: string;
  empfohleneMinute: number;
  dauer: number;
  grund: string;
}

interface ApiResponse {
  orders: OrderRow[];
  kpi: {
    score: number; aktiv: number; kritisch: number; ueberfaellig: number; fertig: number;
    varianz: number; stationen: number; sla_pct: number; bereit: number; drift: number;
    sync: number; qualitaet: number; uebergabe: number; ki_batch: number;
    temperatur: number; fehler: number;
  };
  stationen: StationPrognose[];
  fahrer: FahrerUebergabe[];
  ki_batches: KiBatch[];
  fehler: FehlerEntry[];
  pause_empfehlung: PauseEmpfehlung | null;
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

function tempColor(t: number) {
  if (t < 30) return 'text-emerald-400';
  if (t < 60) return 'text-amber-400';
  if (t < 85) return 'text-orange-400';
  return 'text-red-400';
}

const MOCK: ApiResponse = {
  orders: [
    { id: 'A01', label: 'Tisch 3', kochSec: 480, fahrerEtaSec: 720, ampel: 'ok', batchId: 'B1', kategorie: 'Pizza', kochStartOffset: 0, ki_prio: 'normal', zielKochzeit: 500, abweichung: 20 },
    { id: 'A02', label: 'Tisch 7', kochSec: 120, fahrerEtaSec: 90, ampel: 'critical', batchId: 'B1', kategorie: 'Burger', kochStartOffset: 60, ki_prio: 'hoch', zielKochzeit: 300, abweichung: -180 },
    { id: 'A03', label: 'Online #44', kochSec: 0, fahrerEtaSec: 0, ampel: 'overdue', batchId: 'B2', kategorie: 'Salat', kochStartOffset: 0, ki_prio: 'kritisch', zielKochzeit: 240, abweichung: 60 },
    { id: 'A04', label: 'Tisch 12', kochSec: 840, fahrerEtaSec: 1080, ampel: 'ok', batchId: 'B2', kategorie: 'Pasta', kochStartOffset: 120, ki_prio: 'niedrig', zielKochzeit: 800, abweichung: -40 },
    { id: 'A05', label: 'Online #45', kochSec: 300, fahrerEtaSec: 360, ampel: 'warn', kategorie: 'Pizza', kochStartOffset: 30, ki_prio: 'hoch', zielKochzeit: 500, abweichung: 200 },
  ],
  kpi: { score: 82, aktiv: 5, kritisch: 1, ueberfaellig: 1, fertig: 12, varianz: 47, stationen: 4, sla_pct: 91, bereit: 3, drift: 1.4, sync: 78, qualitaet: 88, uebergabe: 94, ki_batch: 3, temperatur: 62, fehler: 2 },
  stationen: [
    { name: 'Kalt', auslastung: 40, temperatur: 28, prognose20min: 55, drift: -0.5 },
    { name: 'Grill', auslastung: 85, temperatur: 92, prognose20min: 78, drift: 1.8 },
    { name: 'Fritte', auslastung: 65, temperatur: 58, prognose20min: 70, drift: 0.4 },
    { name: 'Pasta', auslastung: 50, temperatur: 44, prognose20min: 60, drift: -0.2 },
  ],
  fahrer: [
    { name: 'Mehmet K.', zuverlaessigkeit: 96, pending: 1, verzoegerung: 0.5 },
    { name: 'Julia S.', zuverlaessigkeit: 88, pending: 2, verzoegerung: 1.2 },
    { name: 'Kemal A.', zuverlaessigkeit: 74, pending: 0, verzoegerung: 3.1 },
  ],
  ki_batches: [
    { batchId: 'B1', orders: ['A01', 'A02'], sync_score: 91, ki_begruendung: 'Gleiche Zone + ähnliche Kochzeit', prioritaet: 'hoch' },
    { batchId: 'B2', orders: ['A03', 'A04'], sync_score: 64, ki_begruendung: 'Nahe Zieladressen, Kochzeit-Offset beachten', prioritaet: 'mittel' },
  ],
  fehler: [
    { orderId: 'A02', station: 'Grill', abweichungSec: -180, grund: 'Grill-Überlast – 3 min früher als Ziel' },
    { orderId: 'A05', station: 'Kalt', abweichungSec: 200, grund: 'Zubereitung 3,3 min später als Ziel' },
  ],
  pause_empfehlung: { station: 'Grill', empfohleneMinute: 8, dauer: 5, grund: 'Auslastung >85% seit 20 min' },
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'countdown', label: 'Countdown' },
  { id: 'prognose', label: 'Prognose' },
  { id: 'uebergabe', label: 'Übergabe' },
  { id: 'stationen', label: 'Stationen' },
  { id: 'kapazitaet', label: 'Kapazität' },
  { id: 'ki_batch', label: 'KI-Batch' },
  { id: 'fehler', label: 'Fehler' },
];

export function KitchenPhase5581SmartTimingCountdownV66({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('countdown');
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/kitchen-timing?locationId=${locationId}`);
      if (res.ok) { const j = await res.json(); if (j) setData(j); }
    } catch { /* use mock */ }
  };

  useEffect(() => {
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1000);
    pollRef.current = setInterval(() => { setLoading(true); fetchData().finally(() => setLoading(false)); }, 15000);
    fetchData();
    return () => { clearInterval(intervalRef.current!); clearInterval(pollRef.current!); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const kpi = data.kpi;

  const KPI_ITEMS = [
    { label: 'Score', value: kpi.score, unit: '', icon: <Target size={11} className="text-emerald-400" /> },
    { label: 'Aktiv', value: kpi.aktiv, unit: '', icon: <Timer size={11} className="text-blue-400" /> },
    { label: 'Kritisch', value: kpi.kritisch, unit: '', icon: <AlertTriangle size={11} className="text-orange-400" /> },
    { label: 'Überfällig', value: kpi.ueberfaellig, unit: '', icon: <AlertTriangle size={11} className="text-red-400" /> },
    { label: 'Fertig', value: kpi.fertig, unit: '', icon: <CheckCircle2 size={11} className="text-emerald-400" /> },
    { label: 'Varianz', value: kpi.varianz, unit: 's', icon: <TrendingUp size={11} className="text-amber-400" /> },
    { label: 'Stationen', value: kpi.stationen, unit: '', icon: <BarChart2 size={11} className="text-purple-400" /> },
    { label: 'SLA', value: kpi.sla_pct, unit: '%', icon: <Target size={11} className="text-teal-400" /> },
    { label: 'Bereit', value: kpi.bereit, unit: '', icon: <CheckCircle2 size={11} className="text-green-400" /> },
    { label: 'ETA-Drift', value: kpi.drift.toFixed(1), unit: 'min', icon: <Timer size={11} className="text-sky-400" /> },
    { label: 'Sync', value: kpi.sync, unit: '', icon: <Zap size={11} className="text-indigo-400" /> },
    { label: 'Qualität', value: kpi.qualitaet, unit: '%', icon: <Target size={11} className="text-cyan-400" /> },
    { label: 'Übergabe', value: kpi.uebergabe, unit: '%', icon: <TrendingUp size={11} className="text-fuchsia-400" /> },
    { label: 'KI-Batch', value: kpi.ki_batch, unit: '', icon: <Brain size={11} className="text-violet-400" /> },
    { label: 'Temp', value: kpi.temperatur, unit: '°', icon: <Thermometer size={11} className={tempColor(kpi.temperatur)} /> },
    { label: 'Fehler', value: kpi.fehler, unit: '', icon: <Search size={11} className="text-red-400" /> },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Timer size={14} className="text-emerald-400" />
          <span className="font-semibold text-white/90 text-sm">Smart-Timing V66</span>
          <span className="text-white/40 text-[10px]">Schicht-Temp · Batch-Sync · Fehler</span>
        </div>
        <div className="flex items-center gap-2">
          {data.pause_empfehlung && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
              <Pause size={10} />
              Pause {data.pause_empfehlung.station} in {data.pause_empfehlung.empfohleneMinute} Min
            </span>
          )}
          {loading && <RefreshCw size={11} className="animate-spin text-white/30" />}
        </div>
      </div>

      {/* 16-KPI Grid */}
      <div className="grid grid-cols-8 gap-1">
        {KPI_ITEMS.map(k => (
          <div key={k.label} className="rounded bg-white/5 px-1.5 py-1 text-center">
            <div className="flex items-center justify-center gap-0.5 text-[9px] text-white/40 mb-0.5">{k.icon}{k.label}</div>
            <div className="font-bold text-white/90 text-xs">{k.value}{k.unit}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('px-2 py-0.5 rounded text-[10px] transition-colors',
              tab === t.id ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/5 text-white/50 hover:bg-white/10')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'countdown' && (
        <div className="space-y-1">
          {data.orders.map(o => {
            const remaining = Math.max(0, o.kochSec - tick);
            return (
              <div key={o.id} className={cn('flex items-center gap-2 rounded border px-2 py-1.5', ampelBorder(o.ampel))}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ampelColor(o.ampel) }} />
                <span className="text-white/80 truncate flex-1">{o.label}</span>
                <span className="text-white/40 text-[10px]">{o.kategorie}</span>
                <span className="font-mono font-bold text-white/90 w-12 text-right">{fmtSec(remaining)}</span>
                <span className="text-white/30 text-[10px]">🚴{fmtSec(o.fahrerEtaSec)}</span>
                {o.ampel === 'critical' && <AlertTriangle size={11} className="text-orange-400 flex-shrink-0" />}
                {o.ampel === 'overdue' && <AlertTriangle size={11} className="text-red-400 flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'prognose' && (
        <div className="space-y-2">
          <div className="text-white/50 text-[10px]">Kochzeit-Prognose vs. Ziel</div>
          {data.orders.map(o => {
            const pct = Math.min(100, Math.round((tick / Math.max(1, o.zielKochzeit)) * 100));
            const color = o.abweichung > 60 ? 'bg-red-500' : o.abweichung > 0 ? 'bg-amber-500' : 'bg-emerald-500';
            return (
              <div key={o.id} className="rounded bg-white/5 px-2 py-1.5">
                <div className="flex justify-between mb-1">
                  <span className="text-white/70">{o.label}</span>
                  <span className={cn('text-[10px]', o.abweichung > 0 ? 'text-red-400' : 'text-emerald-400')}>
                    {o.abweichung > 0 ? '+' : ''}{o.abweichung}s vs. Ziel
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'uebergabe' && (
        <div className="space-y-1">
          {data.fahrer.map(f => (
            <div key={f.name} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1.5">
              <div className="flex-1">
                <span className="text-white/80">{f.name}</span>
                <div className="text-white/40 text-[10px]">Ausstehend: {f.pending} · Verzögerung: {f.verzoegerung} min</div>
              </div>
              <div className="text-right">
                <div className={cn('font-bold', f.zuverlaessigkeit >= 90 ? 'text-emerald-400' : f.zuverlaessigkeit >= 75 ? 'text-amber-400' : 'text-red-400')}>
                  {f.zuverlaessigkeit}%
                </div>
                <div className="text-white/30 text-[10px]">Zuverlässigkeit</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'stationen' && (
        <div className="space-y-1">
          {data.stationen.map(s => (
            <div key={s.name} className="rounded bg-white/5 px-2 py-1.5">
              <div className="flex justify-between mb-1">
                <span className="text-white/80 font-medium">{s.name}</span>
                <span className={cn('font-bold text-sm', tempColor(s.temperatur))}>
                  {s.temperatur}°
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-0.5">
                <div
                  className={cn('h-full rounded-full', s.auslastung > 80 ? 'bg-red-500' : s.auslastung > 60 ? 'bg-amber-500' : 'bg-emerald-500')}
                  style={{ width: `${s.auslastung}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/40">
                <span>Auslastung {s.auslastung}%</span>
                <span>20-min: {s.prognose20min}%</span>
                <span>Drift {s.drift > 0 ? '+' : ''}{s.drift} min</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'kapazitaet' && (
        <div className="space-y-2">
          <div className="rounded bg-white/5 px-3 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Thermometer size={13} className={tempColor(kpi.temperatur)} />
              <span className="text-white/70">Schicht-Temperatur</span>
              <span className={cn('ml-auto font-bold text-lg', tempColor(kpi.temperatur))}>{kpi.temperatur}°</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', kpi.temperatur > 80 ? 'bg-red-500' : kpi.temperatur > 55 ? 'bg-amber-500' : 'bg-emerald-500')}
                style={{ width: `${kpi.temperatur}%` }}
              />
            </div>
            <div className="text-[10px] text-white/40 mt-1">
              {kpi.temperatur < 30 ? 'Küche stark unterlastet' : kpi.temperatur < 60 ? 'Normalbetrieb' : kpi.temperatur < 85 ? 'Hohe Auslastung' : '⚠ Überhitzung'}
            </div>
          </div>
          {data.pause_empfehlung && (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              <div className="flex items-center gap-1 text-amber-300 mb-1">
                <Pause size={11} />
                <span className="font-medium">Pausen-Empfehlung</span>
              </div>
              <div className="text-white/70">{data.pause_empfehlung.station}: Pause in {data.pause_empfehlung.empfohleneMinute} Min ({data.pause_empfehlung.dauer} min)</div>
              <div className="text-white/40 text-[10px] mt-0.5">{data.pause_empfehlung.grund}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'ki_batch' && (
        <div className="space-y-2">
          {data.ki_batches.map(b => (
            <div key={b.batchId} className={cn('rounded border px-2 py-1.5',
              b.sync_score >= 85 ? 'border-emerald-500/40' : b.sync_score >= 65 ? 'border-amber-500/40' : 'border-red-500/40')}>
              <div className="flex justify-between mb-1">
                <span className="text-white/70 font-medium">Batch {b.batchId}</span>
                <div className="flex items-center gap-1">
                  <span className={cn('text-xs font-bold',
                    b.sync_score >= 85 ? 'text-emerald-400' : b.sync_score >= 65 ? 'text-amber-400' : 'text-red-400')}>
                    Sync {b.sync_score}
                  </span>
                  <span className={cn('text-[10px] px-1 rounded',
                    b.prioritaet === 'hoch' ? 'bg-red-500/20 text-red-300' : b.prioritaet === 'mittel' ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/50')}>
                    {b.prioritaet}
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-white/50">{b.orders.join(' + ')} · {b.ki_begruendung}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'fehler' && (
        <div className="space-y-1">
          {data.fehler.length === 0 ? (
            <div className="text-white/40 text-center py-3">Keine Kochzeit-Fehler erkannt</div>
          ) : data.fehler.map((f, i) => (
            <div key={i} className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5">
              <div className="flex justify-between mb-0.5">
                <span className="text-white/70">{f.orderId} · {f.station}</span>
                <span className={cn('font-mono font-bold text-xs', f.abweichungSec < 0 ? 'text-orange-400' : 'text-red-400')}>
                  {f.abweichungSec > 0 ? '+' : ''}{f.abweichungSec}s
                </span>
              </div>
              <div className="text-[10px] text-white/50">{f.grund}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
