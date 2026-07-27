'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Timer, CheckCircle2, AlertTriangle, Zap, Clock, ChefHat } from 'lucide-react';

type FarbStufe = 'gruen' | 'gelb' | 'orange' | 'rot' | 'erledigt';

interface BestellungCountdown {
  order_id: string;
  order_nr: string;
  prep_start_at: string | null;
  prep_soll_min: number;
  prep_ist_min: number;
  restzeit_sek: number;
  stufe: FarbStufe;
  fahrer_wartet: boolean;
  artikel_preview: string;
}

interface ApiData {
  bestellungen: BestellungCountdown[];
  timing_score: number;
  on_time_pct: number;
  fahrer_warten_count: number;
  ueberfaellig_count: number;
}

const MOCK: ApiData = {
  timing_score: 82,
  on_time_pct: 78,
  fahrer_warten_count: 1,
  ueberfaellig_count: 1,
  bestellungen: [
    { order_id: 'o1', order_nr: '#3041', prep_start_at: null, prep_soll_min: 12, prep_ist_min: 4,  restzeit_sek: 480, stufe: 'gruen',   fahrer_wartet: false, artikel_preview: 'Burger + Pommes' },
    { order_id: 'o2', order_nr: '#3042', prep_start_at: null, prep_soll_min: 10, prep_ist_min: 8,  restzeit_sek: 120, stufe: 'gelb',    fahrer_wartet: false, artikel_preview: 'Pizza Margherita' },
    { order_id: 'o3', order_nr: '#3043', prep_start_at: null, prep_soll_min: 8,  prep_ist_min: 9,  restzeit_sek: -60, stufe: 'rot',     fahrer_wartet: true,  artikel_preview: 'Döner + Ayran' },
    { order_id: 'o4', order_nr: '#3044', prep_start_at: null, prep_soll_min: 15, prep_ist_min: 11, restzeit_sek: 240, stufe: 'orange',  fahrer_wartet: false, artikel_preview: '2× Pasta Bolognese' },
    { order_id: 'o5', order_nr: '#3045', prep_start_at: null, prep_soll_min: 12, prep_ist_min: 12, restzeit_sek: 0,   stufe: 'erledigt',fahrer_wartet: false, artikel_preview: 'Sushi Mix' },
  ],
};

const STUFE_STYLE: Record<FarbStufe, { bg: string; border: string; text: string; badge: string; label: string }> = {
  gruen:    { bg: 'bg-green-50',   border: 'border-green-300',  text: 'text-green-700',  badge: 'bg-green-500',   label: 'Grün' },
  gelb:     { bg: 'bg-yellow-50',  border: 'border-yellow-300', text: 'text-yellow-700', badge: 'bg-yellow-400',  label: 'Gelb' },
  orange:   { bg: 'bg-orange-50',  border: 'border-orange-300', text: 'text-orange-700', badge: 'bg-orange-500',  label: 'Orange' },
  rot:      { bg: 'bg-red-50',     border: 'border-red-300',    text: 'text-red-700',    badge: 'bg-red-500',     label: 'Rot' },
  erledigt: { bg: 'bg-gray-50',    border: 'border-gray-200',   text: 'text-gray-400',   badge: 'bg-gray-300',    label: 'Fertig' },
};

function formatSek(sek: number): string {
  if (sek < 0) return `+${Math.abs(Math.round(sek / 60))}m`;
  const m = Math.floor(sek / 60);
  const s = Math.abs(sek) % 60;
  return `${m}:${String(Math.round(s)).padStart(2, '0')}`;
}

interface Props { locationId: string | null; }

export function KitchenPhase4351SmartTimingCountdownV3({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/kitchen/countdown-timing?location_id=${locationId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  const scoreColor = data.timing_score >= 85 ? 'text-green-600' : data.timing_score >= 70 ? 'text-yellow-600' : 'text-red-500';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="bg-indigo-600 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-indigo-200" />
            <span className="text-sm font-bold text-white">Smart-Timing Countdown V3</span>
            {loading && <span className="w-2.5 h-2.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-[8px] text-indigo-300">Score</p>
              <p className="text-sm font-black text-white">{data.timing_score}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-indigo-300">On-Time</p>
              <p className="text-sm font-black text-white">{data.on_time_pct}%</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {data.ueberfaellig_count > 0 && (
            <span className="flex items-center gap-1 bg-red-500/20 border border-red-400/40 rounded-full px-2 py-0.5 text-[10px] text-red-200 font-semibold">
              <AlertTriangle className="w-2.5 h-2.5" />{data.ueberfaellig_count} überfällig
            </span>
          )}
          {data.fahrer_warten_count > 0 && (
            <span className="flex items-center gap-1 bg-amber-400/20 border border-amber-300/40 rounded-full px-2 py-0.5 text-[10px] text-amber-200 font-semibold">
              <Zap className="w-2.5 h-2.5" />{data.fahrer_warten_count} Fahrer wartet
            </span>
          )}
        </div>
      </div>

      {/* Farb-Legende */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-gray-50 border-b border-gray-100 text-[9px] text-gray-500">
        {(['gruen','gelb','orange','rot'] as FarbStufe[]).map(s => (
          <span key={s} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${STUFE_STYLE[s].badge}`} />
            {STUFE_STYLE[s].label}
          </span>
        ))}
      </div>

      {/* Countdown-Kacheln */}
      <div className="grid grid-cols-1 gap-px bg-gray-100">
        {data.bestellungen.map((b) => {
          const ss = STUFE_STYLE[b.stufe];
          const countdown = b.stufe !== 'erledigt' ? b.restzeit_sek - tick : 0;
          const isUeberfaellig = countdown < 0 && b.stufe !== 'erledigt';
          return (
            <div key={b.order_id} className={`flex items-center gap-3 px-4 py-3 ${ss.bg}`}>
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${ss.badge} ${b.stufe === 'rot' ? 'animate-pulse' : ''}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-700">{b.order_nr}</span>
                  {b.fahrer_wartet && <Zap className="w-3 h-3 text-amber-500" />}
                </div>
                <p className="text-[10px] text-gray-500 truncate">{b.artikel_preview}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                {b.stufe === 'erledigt' ? (
                  <CheckCircle2 className="w-5 h-5 text-gray-300" />
                ) : (
                  <span className={`text-sm font-black tabular-nums ${isUeberfaellig ? 'text-red-600' : ss.text}`}>
                    {formatSek(countdown)}
                  </span>
                )}
                <p className="text-[9px] text-gray-400">{b.prep_ist_min}m/{b.prep_soll_min}m Ziel</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 text-[9px] text-gray-400 flex items-center justify-between border-t border-gray-100">
        <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />1s Tick · 15s API</span>
        <span className="flex items-center gap-1"><ChefHat className="w-2.5 h-2.5" />grün→gelb→orange→rot</span>
      </div>
    </div>
  );
}
