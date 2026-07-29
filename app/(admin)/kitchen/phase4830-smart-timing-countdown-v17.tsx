'use client';

import { useEffect, useRef, useState } from 'react';
import { ChefHat, Clock, Zap, AlertTriangle, CheckCircle2, Timer } from 'lucide-react';

interface OrderTiming {
  order_id: string;
  bestellnummer: string;
  status: string;
  restzeit_sek: number;
  kochzeit_soll_min: number;
  kochzeit_ist_min: number;
  batch_gruppe: string | null;
  komplexitaet: 'hoch' | 'mittel' | 'gering';
  fahrer_eta_min: number | null;
  ampel: 'gruen' | 'gelb' | 'orange' | 'rot' | 'kritisch' | 'fertig';
  prioritaet: number;
}

interface ApiResponse {
  orders: OrderTiming[];
  score: number;
  score_delta: number;
  aktiv: number;
  kritisch: number;
  fertig: number;
  puenktlichkeit_pct: number;
  durchschnitt_prep_min: number;
  alert: string | null;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'border-green-700 bg-green-950/30';
  if (a === 'gelb') return 'border-yellow-700 bg-yellow-950/30';
  if (a === 'orange') return 'border-orange-700 bg-orange-950/30';
  if (a === 'rot') return 'border-red-700 bg-red-950/30';
  if (a === 'kritisch') return 'border-red-500 bg-red-900/40 animate-pulse';
  return 'border-slate-700 bg-slate-900/30';
}

function ampelText(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  if (a === 'orange') return 'text-orange-400';
  if (a === 'rot') return 'text-red-400';
  if (a === 'kritisch') return 'text-red-300 font-bold';
  return 'text-slate-400';
}

function formatCountdown(sek: number): string {
  if (sek <= 0) return '00:00';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const MOCK: ApiResponse = {
  orders: [
    { order_id: '1', bestellnummer: '#1042', status: 'in_zubereitung', restzeit_sek: 180, kochzeit_soll_min: 12, kochzeit_ist_min: 9, batch_gruppe: 'A', komplexitaet: 'hoch', fahrer_eta_min: 4, ampel: 'gelb', prioritaet: 1 },
    { order_id: '2', bestellnummer: '#1043', status: 'in_zubereitung', restzeit_sek: 45, kochzeit_soll_min: 10, kochzeit_ist_min: 9.25, batch_gruppe: 'A', komplexitaet: 'mittel', fahrer_eta_min: 1, ampel: 'kritisch', prioritaet: 0 },
    { order_id: '3', bestellnummer: '#1044', status: 'in_zubereitung', restzeit_sek: 480, kochzeit_soll_min: 15, kochzeit_ist_min: 7, batch_gruppe: null, komplexitaet: 'gering', fahrer_eta_min: 12, ampel: 'gruen', prioritaet: 3 },
    { order_id: '4', bestellnummer: '#1040', status: 'fertig', restzeit_sek: 0, kochzeit_soll_min: 11, kochzeit_ist_min: 10.5, batch_gruppe: 'B', komplexitaet: 'mittel', fahrer_eta_min: null, ampel: 'fertig', prioritaet: 10 },
  ],
  score: 82,
  score_delta: +4,
  aktiv: 3,
  kritisch: 1,
  fertig: 1,
  puenktlichkeit_pct: 78,
  durchschnitt_prep_min: 11.2,
  alert: '1 Bestellung kritisch — Fahrer wartet!',
};

export function KitchenPhase4830SmartTimingCountdownV17({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/kitchen/smart-timing-countdown?location_id=${locationId}`
      : '/api/delivery/kitchen/smart-timing-countdown';
    try {
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 15_000);
    tickRef.current = setInterval(() => setTick(t => t + 1), 1_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.orders].sort((a, b) => a.prioritaet - b.prioritaet);
  const liveOrders = sorted.map(o => ({
    ...o,
    restzeit_sek: Math.max(0, o.restzeit_sek - tick),
  }));

  const scoreColor = data.score >= 85 ? 'text-green-400' : data.score >= 70 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <ChefHat className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-slate-300">Smart-Timing Countdown V17</span>
        <span className="ml-auto text-xs text-gray-500">15-Sek-Polling · 1-Sek-Tick</span>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 text-xs text-red-300 bg-red-900/30 rounded px-3 py-1.5 mb-3">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {data.alert}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        <div className="bg-black/20 rounded p-2 text-center">
          <div className="text-xs text-gray-400">Score</div>
          <div className={`text-lg font-bold ${scoreColor}`}>{data.score}</div>
          <div className="text-xs text-gray-500">{data.score_delta >= 0 ? '+' : ''}{data.score_delta}</div>
        </div>
        <div className="bg-black/20 rounded p-2 text-center">
          <div className="text-xs text-gray-400">Aktiv</div>
          <div className="text-lg font-bold text-blue-400">{data.aktiv}</div>
        </div>
        <div className="bg-black/20 rounded p-2 text-center">
          <div className="text-xs text-gray-400">Kritisch</div>
          <div className={`text-lg font-bold ${data.kritisch > 0 ? 'text-red-400' : 'text-slate-500'}`}>{data.kritisch}</div>
        </div>
        <div className="bg-black/20 rounded p-2 text-center">
          <div className="text-xs text-gray-400">Fertig</div>
          <div className="text-lg font-bold text-green-400">{data.fertig}</div>
        </div>
        <div className="bg-black/20 rounded p-2 text-center">
          <div className="text-xs text-gray-400">Pünktl.</div>
          <div className={`text-lg font-bold ${data.puenktlichkeit_pct >= 80 ? 'text-green-400' : data.puenktlichkeit_pct >= 65 ? 'text-yellow-400' : 'text-red-400'}`}>
            {data.puenktlichkeit_pct}%
          </div>
        </div>
      </div>

      {/* Countdown Cards */}
      <div className="space-y-2">
        {liveOrders.map(o => {
          const progress = o.kochzeit_soll_min > 0
            ? Math.min(100, ((o.kochzeit_soll_min * 60 - o.restzeit_sek) / (o.kochzeit_soll_min * 60)) * 100)
            : 100;
          return (
            <div key={o.order_id} className={`rounded-lg border p-3 ${ampelBg(o.ampel)}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-slate-300">{o.bestellnummer}</span>
                {o.batch_gruppe && (
                  <span className="text-xs bg-indigo-900/60 text-indigo-300 rounded px-1">Batch {o.batch_gruppe}</span>
                )}
                <span className={`text-xs rounded px-1 ml-1 ${o.komplexitaet === 'hoch' ? 'bg-orange-900/60 text-orange-300' : o.komplexitaet === 'mittel' ? 'bg-yellow-900/60 text-yellow-300' : 'bg-green-900/60 text-green-300'}`}>
                  {o.komplexitaet}
                </span>
                <span className={`ml-auto text-xl font-mono font-bold tabular-nums ${ampelText(o.ampel)}`}>
                  {o.ampel === 'fertig' ? <CheckCircle2 className="w-5 h-5 text-green-400 inline" /> : formatCountdown(o.restzeit_sek)}
                </span>
              </div>
              {/* Progress bar */}
              {o.ampel !== 'fertig' && (
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-1.5">
                  <div
                    className={`h-full rounded-full transition-all ${o.ampel === 'gruen' ? 'bg-green-500' : o.ampel === 'gelb' ? 'bg-yellow-500' : o.ampel === 'orange' ? 'bg-orange-500' : 'bg-red-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{o.kochzeit_soll_min}min Soll</span>
                {o.fahrer_eta_min !== null && (
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    Fahrer in {o.fahrer_eta_min}min
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-xs text-gray-500 text-center">
        Ø Prep: {data.durchschnitt_prep_min.toFixed(1)}min
      </div>
    </div>
  );
}
