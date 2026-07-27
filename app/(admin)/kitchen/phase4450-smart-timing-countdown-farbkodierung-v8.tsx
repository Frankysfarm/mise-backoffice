'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, AlertTriangle, CheckCircle2, Zap, ChefHat, Clock, TrendingUp } from 'lucide-react';

interface BestellungCountdown {
  order_id: string;
  bestellnummer: string;
  kunde_name: string;
  artikel_anzahl: number;
  status: 'in_zubereitung' | 'fertig' | 'scheduled';
  remaining_sec: number;
  ampel: 'gruen' | 'gelb' | 'orange' | 'rot';
  fahrer_wartet: boolean;
  station: 'pizza' | 'grill' | 'pasta' | 'salat' | 'sonstiges';
  batch_id: string | null;
}

interface StationAuslastung {
  station: string;
  aktiv: number;
  kapazitaet: number;
  pct: number;
}

interface ApiData {
  bestellungen: BestellungCountdown[];
  timing_score: number;
  on_time_pct: number;
  ueberfaellig: number;
  fahrer_warten: number;
  stationen: StationAuslastung[];
  schicht_delta_min: number;
  prognose_naechste_min: number | null;
}

const MOCK: ApiData = {
  bestellungen: [
    { order_id: 'o1', bestellnummer: '0051', kunde_name: 'L. Wagner',  artikel_anzahl: 3, status: 'in_zubereitung', remaining_sec: 540,  ampel: 'gruen',  fahrer_wartet: false, station: 'pizza', batch_id: 'b1' },
    { order_id: 'o2', bestellnummer: '0052', kunde_name: 'P. Müller',  artikel_anzahl: 2, status: 'in_zubereitung', remaining_sec: 180,  ampel: 'gelb',   fahrer_wartet: false, station: 'grill', batch_id: 'b1' },
    { order_id: 'o3', bestellnummer: '0053', kunde_name: 'A. Schulze', artikel_anzahl: 4, status: 'in_zubereitung', remaining_sec: 65,   ampel: 'orange', fahrer_wartet: true,  station: 'pasta', batch_id: null  },
    { order_id: 'o4', bestellnummer: '0050', kunde_name: 'K. Braun',   artikel_anzahl: 1, status: 'fertig',          remaining_sec: -95,  ampel: 'rot',    fahrer_wartet: true,  station: 'salat', batch_id: 'b2' },
    { order_id: 'o5', bestellnummer: '0054', kunde_name: 'N. Klein',   artikel_anzahl: 2, status: 'scheduled',       remaining_sec: 1020, ampel: 'gruen',  fahrer_wartet: false, station: 'pizza', batch_id: null  },
  ],
  timing_score: 82,
  on_time_pct: 87,
  ueberfaellig: 1,
  fahrer_warten: 2,
  stationen: [
    { station: 'Pizza',  aktiv: 3, kapazitaet: 4, pct: 75 },
    { station: 'Grill',  aktiv: 2, kapazitaet: 3, pct: 67 },
    { station: 'Pasta',  aktiv: 1, kapazitaet: 3, pct: 33 },
    { station: 'Salat',  aktiv: 1, kapazitaet: 2, pct: 50 },
  ],
  schicht_delta_min: -2,
  prognose_naechste_min: 8,
};

function fmtSec(sec: number): string {
  if (sec < 0) return `+${Math.abs(Math.floor(sec / 60))}m ${Math.abs(sec % 60)}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const AMPEL = {
  gruen:  { dot: 'bg-green-400',  ring: 'ring-green-200',  bg: 'bg-green-50',  text: 'text-green-700',  label: 'Pünktlich' },
  gelb:   { dot: 'bg-yellow-400', ring: 'ring-yellow-200', bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Bald' },
  orange: { dot: 'bg-orange-400', ring: 'ring-orange-200', bg: 'bg-orange-50', text: 'text-orange-700', label: 'Dringend' },
  rot:    { dot: 'bg-red-500',    ring: 'ring-red-300',    bg: 'bg-red-50 animate-pulse', text: 'text-red-700', label: 'Überfällig' },
} as const;

const STATION_COLORS: Record<string, string> = {
  pizza: 'bg-orange-100 text-orange-700',
  grill: 'bg-red-100 text-red-700',
  pasta: 'bg-yellow-100 text-yellow-700',
  salat: 'bg-green-100 text-green-700',
  sonstiges: 'bg-gray-100 text-gray-700',
};

interface Props { locationId: string | null; }

export function KitchenPhase4450SmartTimingCountdownFarbkodierungV8({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/kitchen/smart-timing?location_id=${locationId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 12_000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1_000); return () => clearInterval(id); }, []);

  void tick;

  const scoreColor = data.timing_score >= 90 ? 'text-green-600' : data.timing_score >= 70 ? 'text-yellow-600' : 'text-red-600';
  const scoreBg    = data.timing_score >= 90 ? 'bg-green-50 border-green-200' : data.timing_score >= 70 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  const visible = expanded ? data.bestellungen : data.bestellungen.slice(0, 4);
  const batches = Array.from(new Set(data.bestellungen.map((b) => b.batch_id).filter(Boolean)));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Timer className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold text-gray-900">Smart-Timing V8</span>
          <span className="text-[9px] text-gray-400 uppercase tracking-wider">Countdown + Farbkodierung</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.fahrer_warten > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-bold bg-amber-50 rounded px-1.5 py-0.5">
              <Zap className="w-3 h-3" />{data.fahrer_warten} wartet
            </span>
          )}
          {data.ueberfaellig > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-bold bg-red-50 rounded px-1.5 py-0.5">
              <AlertTriangle className="w-3 h-3" />{data.ueberfaellig} überfällig
            </span>
          )}
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        <div className={`rounded-lg border p-1.5 text-center ${scoreBg}`}>
          <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Score</p>
          <p className={`text-lg font-black ${scoreColor}`}>{data.timing_score}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-1.5 text-center">
          <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Pünktl.</p>
          <p className="text-lg font-black text-gray-800">{data.on_time_pct}%</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-1.5 text-center">
          <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Batches</p>
          <p className="text-lg font-black text-gray-800">{batches.length}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-1.5 text-center">
          <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Schicht Δ</p>
          <p className={`text-lg font-black ${data.schicht_delta_min <= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data.schicht_delta_min > 0 ? '+' : ''}{data.schicht_delta_min}m
          </p>
        </div>
      </div>

      {/* Stationen-Heatmap */}
      <div>
        <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
          <ChefHat className="w-3 h-3" />Stationen
        </p>
        <div className="grid grid-cols-4 gap-1">
          {data.stationen.map((s) => {
            const heatColor = s.pct >= 90 ? 'bg-red-200' : s.pct >= 70 ? 'bg-orange-200' : s.pct >= 50 ? 'bg-yellow-200' : 'bg-green-200';
            return (
              <div key={s.station} className="text-center">
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-0.5">
                  <div className={`h-full rounded-full ${heatColor} transition-all`} style={{ width: `${s.pct}%` }} />
                </div>
                <p className="text-[9px] text-gray-500">{s.station}</p>
                <p className="text-[9px] font-bold text-gray-700">{s.aktiv}/{s.kapazitaet}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Countdown-Kacheln */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3" />Bestellungen
          </p>
          <div className="flex items-center gap-2 text-[9px]">
            {(['gruen','gelb','orange','rot'] as const).map((a) => (
              <span key={a} className="flex items-center gap-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${AMPEL[a].dot}`} />
                <span className="text-gray-500">{AMPEL[a].label}</span>
              </span>
            ))}
          </div>
        </div>

        {visible.map((b) => {
          const st = AMPEL[b.ampel];
          return (
            <div key={b.order_id} className={`flex items-center gap-2 rounded-lg p-1.5 ring-1 ${st.ring} ${st.bg}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-gray-800">#{b.bestellnummer}</span>
                  <span className="text-[9px] text-gray-500 truncate">{b.kunde_name}</span>
                  {b.batch_id && <span className="text-[8px] bg-indigo-100 text-indigo-600 rounded px-1">Batch</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[9px] px-1 rounded ${STATION_COLORS[b.station] ?? ''}`}>{b.station}</span>
                  <span className="text-[9px] text-gray-500">{b.artikel_anzahl} Artikel</span>
                  {b.status === 'fertig' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-black tabular-nums ${st.text}`}>{fmtSec(b.remaining_sec)}</p>
                {b.fahrer_wartet && (
                  <p className="text-[8px] text-amber-600 font-bold flex items-center gap-0.5 justify-end">
                    <Zap className="w-2.5 h-2.5" />Fahrer
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {data.bestellungen.length > 4 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full text-[10px] text-indigo-600 font-medium py-0.5 hover:underline"
          >
            {expanded ? 'Weniger anzeigen' : `+${data.bestellungen.length - 4} weitere`}
          </button>
        )}
      </div>

      {/* Prognose */}
      {data.prognose_naechste_min !== null && (
        <div className="flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-100 px-2 py-1.5">
          <TrendingUp className="w-3 h-3 text-indigo-500 flex-shrink-0" />
          <p className="text-[10px] text-indigo-700">
            Nächste Bestellung in ca. <span className="font-bold">{data.prognose_naechste_min} min</span> erwartet
          </p>
        </div>
      )}
    </div>
  );
}
