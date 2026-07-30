'use client';

import { useEffect, useState } from 'react';
import {
  Clock, AlertTriangle, ChefHat, CheckCircle2, Flame, Zap, TrendingUp,
  Thermometer, BarChart2, RefreshCw,
} from 'lucide-react';

// Phase 5036 — Smart Timing Countdown V33
// Countdown-Wall farbkodiert rot<5min/gelb<10min/grün≥10min;
// Stations-Workload-Balken je Station; Batch-Fertigstellung-Prognose;
// Temperatur-Ampel je Station; Schicht-Velocity-Ticker; 15-Sek-Polling; Mock-Fallback

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
}

interface StationLoad {
  name: string;
  auslastung: number;
  temp_status: TempStatus;
  aktive_orders: number;
}

interface ApiData {
  bestellungen: BestellungCountdown[];
  schicht_score: number;
  schicht_velocity: number;
  aktive_batches: number;
  kritische_anzahl: number;
  stationen: StationLoad[];
  batch_prognose_min: number | null;
  alert: string | null;
}

const MOCK: ApiData = {
  schicht_score: 87,
  schicht_velocity: 14,
  aktive_batches: 3,
  kritische_anzahl: 2,
  batch_prognose_min: 7,
  alert: null,
  stationen: [
    { name: 'Ofen',   auslastung: 90, temp_status: 'kritisch', aktive_orders: 3 },
    { name: 'Grill',  auslastung: 70, temp_status: 'heiss',    aktive_orders: 2 },
    { name: 'Kalt',   auslastung: 40, temp_status: 'kalt',     aktive_orders: 1 },
    { name: 'Herd',   auslastung: 55, temp_status: 'warm',     aktive_orders: 2 },
  ],
  bestellungen: [
    { id: '1', nr: '#0051', artikel: 'Pizza Margherita',  minuten_verbleibend: 3,  ziel_min: 12, station: 'Ofen',  batch_id: 'B1', status: 'kritisch', prioritaet: 1 },
    { id: '2', nr: '#0052', artikel: 'Burger Classic',    minuten_verbleibend: 2,  ziel_min: 10, station: 'Grill', batch_id: null, status: 'kritisch', prioritaet: 1 },
    { id: '3', nr: '#0053', artikel: 'Pasta Carbonara',   minuten_verbleibend: 8,  ziel_min: 14, station: 'Herd',  batch_id: 'B2', status: 'warnung',  prioritaet: 2 },
    { id: '4', nr: '#0054', artikel: 'Salat César',       minuten_verbleibend: 9,  ziel_min: 8,  station: 'Kalt',  batch_id: null, status: 'warnung',  prioritaet: 2 },
    { id: '5', nr: '#0055', artikel: 'Schnitzel Wien.',   minuten_verbleibend: 15, ziel_min: 16, station: 'Grill', batch_id: 'B1', status: 'ok',       prioritaet: 3 },
    { id: '6', nr: '#0056', artikel: 'Döner Teller',      minuten_verbleibend: 0,  ziel_min: 14, station: 'Grill', batch_id: 'B3', status: 'fertig',   prioritaet: 1 },
  ],
};

const STATUS_STYLES: Record<ZeitStatus, { card: string; timer: string; badge: string }> = {
  kritisch: { card: 'border-red-400 bg-red-50',     timer: 'text-red-600',     badge: 'bg-red-600 text-white'    },
  warnung:  { card: 'border-amber-300 bg-amber-50', timer: 'text-amber-600',   badge: 'bg-amber-500 text-white'  },
  ok:       { card: 'border-emerald-200 bg-white',  timer: 'text-emerald-600', badge: 'bg-emerald-600 text-white'},
  fertig:   { card: 'border-slate-200 bg-slate-50', timer: 'text-slate-400',   badge: 'bg-slate-500 text-white'  },
};

const TEMP_DOT: Record<TempStatus, string> = {
  kalt:     'bg-sky-400',
  warm:     'bg-amber-400',
  heiss:    'bg-orange-500',
  kritisch: 'bg-red-600 animate-pulse',
};

const TEMP_LABEL: Record<TempStatus, string> = {
  kalt: 'Kalt', warm: 'Warm', heiss: 'Heiß', kritisch: 'Kritisch',
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

export function KitchenPhase5036SmartTimingCountdownV33({ locationId }: { locationId?: string | null }) {
  const [data, setData]   = useState<ApiData | null>(null);
  const [tick, setTick]   = useState(0);

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
    <div className="rounded-2xl border border-amber-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-amber-700 text-white">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-300" />
          <span className="font-bold text-sm">Smart Timing V33</span>
        </div>
        <div className="flex items-center gap-3">
          {d.kritische_anzahl > 0 && (
            <div className="flex items-center gap-1 bg-red-600 rounded-full px-2 py-0.5">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-xs font-bold">{d.kritische_anzahl} kritisch</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-xs opacity-80">
            <RefreshCw className="h-3 w-3" />#{tick}
          </div>
        </div>
      </div>

      {d.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />{d.alert}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center">
            <div className={`text-xl font-black ${d.schicht_score >= 85 ? 'text-emerald-600' : d.schicht_score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
              {d.schicht_score}%
            </div>
            <div className="text-[10px] text-muted-foreground">Schicht-Score</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center">
            <div className="text-xl font-black text-indigo-600">{d.aktive_batches}</div>
            <div className="text-[10px] text-muted-foreground">Batches</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center">
            <div className="text-xl font-black text-violet-600">{d.schicht_velocity}<span className="text-xs font-normal">/h</span></div>
            <div className="text-[10px] text-muted-foreground">Velocity</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center">
            {d.batch_prognose_min != null ? (
              <>
                <div className="text-xl font-black text-amber-600">{d.batch_prognose_min} min</div>
                <div className="text-[10px] text-muted-foreground">Batch fertig</div>
              </>
            ) : (
              <>
                <div className="text-xl font-black text-muted-foreground">—</div>
                <div className="text-[10px] text-muted-foreground">Batch fertig</div>
              </>
            )}
          </div>
        </div>

        {/* Stations-Workload */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-1">
            <Thermometer className="h-3.5 w-3.5" />Stationen Auslastung
          </div>
          {d.stationen.map((st) => (
            <div key={st.name} className="flex items-center gap-2">
              <div className="w-12 text-xs font-semibold text-foreground shrink-0">{st.name}</div>
              <div className="flex-1 h-4 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className={`h-4 rounded-full transition-all ${st.auslastung >= 85 ? 'bg-red-500' : st.auslastung >= 60 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                  style={{ width: `${st.auslastung}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-foreground w-7 text-right">{st.auslastung}%</span>
              <span className={`h-2 w-2 rounded-full shrink-0 ${TEMP_DOT[st.temp_status]}`} title={TEMP_LABEL[st.temp_status]} />
              <span className="text-[10px] text-muted-foreground w-4 text-right">{st.aktive_orders}</span>
            </div>
          ))}
        </div>

        {/* Countdown Wall */}
        <div>
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-2">
            <BarChart2 className="h-3.5 w-3.5" />Bestellungen Live
          </div>
          <div className="grid grid-cols-2 gap-2">
            {sorted.map((b) => {
              const st = STATUS_STYLES[b.status];
              const fortschritt = b.status === 'fertig' ? 100 : Math.min(100, Math.round(((b.ziel_min - b.minuten_verbleibend) / b.ziel_min) * 100));
              return (
                <div key={b.id} className={`rounded-xl border p-3 ${st.card}`}>
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <div className="flex items-center gap-1">
                        {PRIO_ICON[b.prioritaet]}
                        <span className="text-xs font-bold text-foreground">{b.nr}</span>
                        {b.batch_id && (
                          <span className="rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold px-1">{b.batch_id}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{b.artikel}</div>
                      <div className="text-[9px] text-muted-foreground">{b.station}</div>
                    </div>
                    <div className={`text-xl font-black font-mono tabular-nums ${st.timer}`}>
                      <CountdownMinutes minuten={b.minuten_verbleibend} status={b.status} />
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40">
                    <div
                      className={`h-1.5 rounded-full transition-all ${b.status === 'fertig' ? 'bg-emerald-500' : b.status === 'kritisch' ? 'bg-red-500' : b.status === 'warnung' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${fortschritt}%` }}
                    />
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

        {/* Footer */}
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
