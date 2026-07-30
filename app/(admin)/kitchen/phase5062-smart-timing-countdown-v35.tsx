'use client';

import { useEffect, useState } from 'react';
import {
  Clock, AlertTriangle, ChefHat, CheckCircle2, Flame, Zap, TrendingUp,
  Thermometer, BarChart2, RefreshCw, Activity, Target, Layers, Timer,
} from 'lucide-react';

// Phase 5062 — Smart Timing Countdown V35
// Neu: Schicht-Auslastungs-KPI; Fahrer-Sync-Warnung; Cook-Effizienz-Gauge;
// Stations-Temperatur-Verlauf; Live-Batch-Countdown; 15-Sek-Polling; Mock-Fallback

type ZeitStatus = 'kritisch' | 'warnung' | 'ok' | 'fertig';
type TempStatus = 'kalt' | 'warm' | 'heiss' | 'kritisch';

interface BestellungCountdown {
  id: string;
  nr: string;
  artikel: string;
  minuten_verbleibend: number;
  ziel_min: number;
  station: string;
  batch_id: string | null;
  status: ZeitStatus;
  prioritaet: 1 | 2 | 3;
  cook_dauer_ist: number;
  cook_dauer_ziel: number;
}

interface StationLoad {
  name: string;
  auslastung: number;
  temp_status: TempStatus;
  aktive_orders: number;
  sync_score: number;
  kochstart_empfehlung: string | null;
  temp_verlauf: number[];
}

interface HeatmapSlot {
  stunde: string;
  orders: number;
  avg_cook_dauer: number;
}

interface ApiData {
  bestellungen: BestellungCountdown[];
  schicht_score: number;
  schicht_velocity: number;
  aktive_batches: number;
  kritische_anzahl: number;
  stationen: StationLoad[];
  batch_prognose_min: number | null;
  batch_queue_laenge: number;
  sync_score_gesamt: number;
  heatmap: HeatmapSlot[];
  peak_alarm: string | null;
  alert: string | null;
  schicht_auslastung: number;
  cook_effizienz: number;
  fahrer_sync_warnung: string | null;
}

const MOCK: ApiData = {
  schicht_score: 91,
  schicht_velocity: 18,
  aktive_batches: 3,
  kritische_anzahl: 1,
  batch_prognose_min: 5,
  batch_queue_laenge: 4,
  sync_score_gesamt: 87,
  peak_alarm: null,
  alert: null,
  schicht_auslastung: 84,
  cook_effizienz: 93,
  fahrer_sync_warnung: null,
  heatmap: [
    { stunde: '11h', orders: 3,  avg_cook_dauer: 10 },
    { stunde: '12h', orders: 11, avg_cook_dauer: 13 },
    { stunde: '13h', orders: 17, avg_cook_dauer: 15 },
    { stunde: '14h', orders: 9,  avg_cook_dauer: 12 },
    { stunde: '15h', orders: 7,  avg_cook_dauer: 11 },
    { stunde: '16h', orders: 13, avg_cook_dauer: 14 },
  ],
  stationen: [
    { name: 'Ofen',  auslastung: 88, temp_status: 'heiss',    aktive_orders: 3, sync_score: 82, kochstart_empfehlung: 'Fahrer in 7 min — jetzt starten', temp_verlauf: [60, 72, 80, 85, 88] },
    { name: 'Grill', auslastung: 64, temp_status: 'warm',     aktive_orders: 2, sync_score: 92, kochstart_empfehlung: null,                              temp_verlauf: [50, 55, 60, 63, 64] },
    { name: 'Kalt',  auslastung: 30, temp_status: 'kalt',     aktive_orders: 1, sync_score: 97, kochstart_empfehlung: null,                              temp_verlauf: [20, 22, 25, 28, 30] },
    { name: 'Herd',  auslastung: 55, temp_status: 'warm',     aktive_orders: 2, sync_score: 85, kochstart_empfehlung: 'Batch B2 vorbereiten',            temp_verlauf: [40, 44, 48, 52, 55] },
  ],
  bestellungen: [
    { id: '1', nr: '#0071', artikel: 'Pizza Margherita',  minuten_verbleibend: 3,  ziel_min: 12, station: 'Ofen',  batch_id: 'B1', status: 'kritisch', prioritaet: 1, cook_dauer_ist: 9,  cook_dauer_ziel: 12 },
    { id: '2', nr: '#0072', artikel: 'Burger Classic',    minuten_verbleibend: 6,  ziel_min: 10, station: 'Grill', batch_id: null, status: 'warnung',  prioritaet: 2, cook_dauer_ist: 4,  cook_dauer_ziel: 10 },
    { id: '3', nr: '#0073', artikel: 'Pasta Carbonara',   minuten_verbleibend: 10, ziel_min: 14, station: 'Herd',  batch_id: 'B2', status: 'ok',       prioritaet: 2, cook_dauer_ist: 4,  cook_dauer_ziel: 14 },
    { id: '4', nr: '#0074', artikel: 'Caesar Salat',      minuten_verbleibend: 5,  ziel_min: 8,  station: 'Kalt',  batch_id: null, status: 'warnung',  prioritaet: 3, cook_dauer_ist: 3,  cook_dauer_ziel: 8  },
    { id: '5', nr: '#0075', artikel: 'Schnitzel Wiener',  minuten_verbleibend: 0,  ziel_min: 14, station: 'Grill', batch_id: 'B1', status: 'fertig',   prioritaet: 1, cook_dauer_ist: 14, cook_dauer_ziel: 14 },
  ],
};

const STATUS_STYLES: Record<ZeitStatus, { card: string; timer: string }> = {
  kritisch: { card: 'border-red-400 bg-red-50',     timer: 'text-red-600'     },
  warnung:  { card: 'border-amber-300 bg-amber-50', timer: 'text-amber-600'   },
  ok:       { card: 'border-emerald-200 bg-white',  timer: 'text-emerald-600' },
  fertig:   { card: 'border-slate-200 bg-slate-50', timer: 'text-slate-400'   },
};

const TEMP_DOT: Record<TempStatus, string> = {
  kalt: 'bg-sky-400', warm: 'bg-amber-400', heiss: 'bg-orange-500', kritisch: 'bg-red-600 animate-pulse',
};

const PRIO_ICON: Record<1 | 2 | 3, React.ReactNode> = {
  1: <Flame   className="h-3.5 w-3.5 text-red-500" />,
  2: <Zap     className="h-3.5 w-3.5 text-amber-500" />,
  3: <ChefHat className="h-3.5 w-3.5 text-emerald-500" />,
};

function CountdownMinutes({ minuten, status }: { minuten: number; status: ZeitStatus }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => (s + 1) % 60), 1000);
    return () => clearInterval(t);
  }, []);
  if (status === 'fertig') return <span>✓</span>;
  return <span>{minuten}:{String(59 - secs).padStart(2, '0')}</span>;
}

const HEATMAP_COLOR = (orders: number) => {
  if (orders >= 15) return 'bg-red-500 text-white';
  if (orders >= 10) return 'bg-amber-400 text-amber-900';
  if (orders >= 6)  return 'bg-yellow-200 text-yellow-900';
  return 'bg-emerald-100 text-emerald-800';
};

export function KitchenPhase5062SmartTimingCountdownV35({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);

  async function fetchData() {
    try {
      const params = locationId ? `?locationId=${locationId}` : '';
      const r = await fetch(`/api/delivery/kitchen/timing${params}`, { cache: 'no-store' });
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData(MOCK);
    }
    setTick((t) => t + 1);
  }

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 15_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const d = data ?? MOCK;
  const sorted = [...d.bestellungen].sort((a, b) => a.prioritaet - b.prioritaet || a.minuten_verbleibend - b.minuten_verbleibend);

  return (
    <div className="rounded-2xl border border-orange-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-orange-700 text-white">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-orange-200" />
          <span className="font-bold text-sm">Smart Timing V35</span>
        </div>
        <div className="flex items-center gap-3">
          {d.kritische_anzahl > 0 && (
            <div className="flex items-center gap-1 bg-red-600 rounded-full px-2 py-0.5">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-xs font-bold">{d.kritische_anzahl} kritisch</span>
            </div>
          )}
          <span className="text-xs opacity-70 flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />#{tick}
          </span>
        </div>
      </div>

      {d.fahrer_sync_warnung && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-semibold">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />{d.fahrer_sync_warnung}
        </div>
      )}
      {d.peak_alarm && (
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border-b border-orange-300 text-orange-800 text-xs font-semibold">
          <Activity className="h-4 w-4 shrink-0 text-orange-600" />{d.peak_alarm}
        </div>
      )}
      {d.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />{d.alert}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* KPI Row (6 KPIs) */}
        <div className="grid grid-cols-6 gap-1.5">
          {[
            { label: 'Score',      val: `${d.schicht_score}%`,      color: d.schicht_score >= 85 ? 'text-emerald-600' : d.schicht_score >= 70 ? 'text-amber-600' : 'text-red-600' },
            { label: 'Auslastung', val: `${d.schicht_auslastung}%`, color: d.schicht_auslastung >= 75 ? 'text-emerald-600' : 'text-amber-600' },
            { label: 'Effizienz',  val: `${d.cook_effizienz}%`,     color: d.cook_effizienz >= 85 ? 'text-emerald-600' : 'text-amber-600' },
            { label: 'Batches',    val: `${d.aktive_batches}`,       color: 'text-indigo-600' },
            { label: 'Queue',      val: `${d.batch_queue_laenge}`,   color: d.batch_queue_laenge >= 6 ? 'text-red-600' : 'text-foreground' },
            { label: 'Sync',       val: `${d.sync_score_gesamt}%`,  color: d.sync_score_gesamt >= 80 ? 'text-emerald-600' : 'text-amber-600' },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-border bg-muted/20 p-1.5 text-center">
              <div className={`text-sm font-black ${kpi.color}`}>{kpi.val}</div>
              <div className="text-[9px] text-muted-foreground">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Stationen mit Temperatur-Verlauf */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-1">
            <Thermometer className="h-3.5 w-3.5" />Stationen · Auslastung + Temp-Verlauf
          </div>
          {d.stationen.map((st) => (
            <div key={st.name} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="w-12 text-xs font-semibold text-foreground shrink-0">{st.name}</div>
                <div className="flex-1 h-3.5 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className={`h-3.5 rounded-full transition-all ${st.auslastung >= 85 ? 'bg-red-500' : st.auslastung >= 60 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                    style={{ width: `${st.auslastung}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-foreground w-7 text-right">{st.auslastung}%</span>
                <span className={`h-2 w-2 rounded-full shrink-0 ${TEMP_DOT[st.temp_status]}`} />
                <div className="flex gap-0.5 shrink-0">
                  {st.temp_verlauf.map((v, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-sm bg-orange-400 opacity-70"
                      style={{ height: `${Math.round((v / 100) * 16) + 2}px` }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-0.5 w-14">
                  <Target className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                  <span className={`text-[10px] font-bold ${st.sync_score >= 85 ? 'text-emerald-600' : st.sync_score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{st.sync_score}%</span>
                </div>
              </div>
              {st.kochstart_empfehlung && (
                <div className="ml-14 text-[10px] text-orange-700 bg-orange-50 rounded px-1.5 py-0.5 flex items-center gap-1">
                  <Layers className="h-2.5 w-2.5 shrink-0" />{st.kochstart_empfehlung}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Cook-Duration Heatmap */}
        <div>
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-2">
            <BarChart2 className="h-3.5 w-3.5" />Kochdauer-Heatmap (Stunden)
          </div>
          <div className="flex gap-1">
            {d.heatmap.map((h) => (
              <div key={h.stunde} className="flex-1 text-center">
                <div className={`rounded-md py-1 text-[10px] font-bold ${HEATMAP_COLOR(h.orders)}`}>
                  {h.orders}
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5">{h.avg_cook_dauer}m</div>
                <div className="text-[9px] text-muted-foreground">{h.stunde}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Batch Queue Prognose */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Timer className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-800">Batch-Queue-Prognose</span>
            </div>
            <div className="text-sm font-black text-indigo-700">
              {d.batch_prognose_min != null ? `${d.batch_prognose_min} min` : '—'}
            </div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-indigo-200">
            <div
              className="h-2 rounded-full bg-indigo-600 transition-all"
              style={{ width: `${Math.min(100, (d.batch_queue_laenge / 10) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-indigo-600 mt-0.5">
            <span>{d.batch_queue_laenge} Batches in Queue</span>
            <span>Max 10</span>
          </div>
        </div>

        {/* Countdown Wall */}
        <div>
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-2">
            <Clock className="h-3.5 w-3.5" />Bestellungen Live
          </div>
          <div className="grid grid-cols-2 gap-2">
            {sorted.map((b) => {
              const st = STATUS_STYLES[b.status];
              const fortschritt = b.status === 'fertig' ? 100 : Math.min(100, Math.round(((b.ziel_min - b.minuten_verbleibend) / b.ziel_min) * 100));
              const cookPct = Math.min(100, Math.round((b.cook_dauer_ist / b.cook_dauer_ziel) * 100));
              return (
                <div key={b.id} className={`rounded-xl border p-3 ${st.card}`}>
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        {PRIO_ICON[b.prioritaet]}
                        <span className="text-xs font-bold text-foreground">{b.nr}</span>
                        {b.batch_id && (
                          <span className="rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold px-1">{b.batch_id}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">{b.artikel}</div>
                      <div className="text-[9px] text-muted-foreground">{b.station}</div>
                    </div>
                    <div className={`text-xl font-black font-mono tabular-nums ${st.timer}`}>
                      <CountdownMinutes minuten={b.minuten_verbleibend} status={b.status} />
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40 mb-1">
                    <div
                      className={`h-1.5 rounded-full transition-all ${b.status === 'fertig' ? 'bg-emerald-500' : b.status === 'kritisch' ? 'bg-red-500' : b.status === 'warnung' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${fortschritt}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-muted-foreground shrink-0">Koch</span>
                    <div className="flex-1 h-1 rounded-full bg-muted/30">
                      <div
                        className={`h-1 rounded-full ${cookPct >= 90 ? 'bg-emerald-500' : cookPct >= 60 ? 'bg-amber-400' : 'bg-blue-400'}`}
                        style={{ width: `${cookPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground shrink-0">{b.cook_dauer_ist}/{b.cook_dauer_ziel}m</span>
                  </div>
                  {b.status === 'fertig' && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600 font-semibold">
                      <CheckCircle2 className="h-3 w-3" />Fertig
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground border-t border-border pt-2">
          <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-red-500" />Prio 1</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-amber-500" />Prio 2</span>
          <span className="flex items-center gap-1"><ChefHat className="h-3 w-3 text-emerald-500" />Prio 3</span>
          <span className="ml-auto flex items-center gap-1"><TrendingUp className="h-3 w-3" />15 Sek Polling</span>
        </div>
      </div>
    </div>
  );
}
