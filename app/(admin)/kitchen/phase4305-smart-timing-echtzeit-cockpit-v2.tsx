'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, AlertTriangle, CheckCircle2, Zap, ChefHat, TrendingUp, Clock } from 'lucide-react';

interface KochBestellung {
  order_id: string;
  bestellnummer: string;
  artikel_liste: string;
  kochstart_am: string | null;
  ziel_min: number;
  elapsed_sec: number;
  remaining_sec: number;
  fahrer_eta_min: number | null;
  ampel: 'gruen' | 'gelb' | 'orange' | 'rot';
  status: 'wartend' | 'in_zubereitung' | 'fertig';
}

interface TimingData {
  bestellungen: KochBestellung[];
  score: number;
  on_time_pct: number;
  avg_prep_min: number;
  ueberfaellig: number;
  fahrer_sync_ok: number;
  prognose_min: number;
}

const MOCK: TimingData = {
  bestellungen: [
    { order_id: 'a1', bestellnummer: '0051', artikel_liste: 'Döner + Pommes', kochstart_am: null, ziel_min: 18, elapsed_sec: 240,  remaining_sec: 840,  fahrer_eta_min: 16, ampel: 'gruen',  status: 'in_zubereitung' },
    { order_id: 'a2', bestellnummer: '0052', artikel_liste: 'Pizza Margherita', kochstart_am: null, ziel_min: 20, elapsed_sec: 960,  remaining_sec: 240,  fahrer_eta_min: 3,  ampel: 'gelb',   status: 'in_zubereitung' },
    { order_id: 'a3', bestellnummer: '0053', artikel_liste: 'Lahmacun ×3', kochstart_am: null, ziel_min: 15, elapsed_sec: 1020, remaining_sec: 60,   fahrer_eta_min: 2,  ampel: 'orange', status: 'in_zubereitung' },
    { order_id: 'a4', bestellnummer: '0049', artikel_liste: 'Hamburger Menü', kochstart_am: null, ziel_min: 16, elapsed_sec: 1320, remaining_sec: -180, fahrer_eta_min: 0,  ampel: 'rot',    status: 'fertig' },
    { order_id: 'a5', bestellnummer: '0050', artikel_liste: 'Wraps ×2', kochstart_am: null, ziel_min: 22, elapsed_sec: 0,    remaining_sec: 1320, fahrer_eta_min: 20, ampel: 'gruen',  status: 'wartend' },
  ],
  score: 81,
  on_time_pct: 85,
  avg_prep_min: 17,
  ueberfaellig: 1,
  fahrer_sync_ok: 3,
  prognose_min: 22,
};

const AMPEL = {
  gruen:  { ring: 'border-green-400',  bg: 'bg-green-50',   dot: 'bg-green-400',   text: 'text-green-700',  label: '>5 min' },
  gelb:   { ring: 'border-yellow-400', bg: 'bg-yellow-50',  dot: 'bg-yellow-400',  text: 'text-yellow-700', label: '2–5 min' },
  orange: { ring: 'border-orange-400', bg: 'bg-orange-50',  dot: 'bg-orange-400',  text: 'text-orange-700', label: '0–2 min' },
  rot:    { ring: 'border-red-500',    bg: 'bg-red-50 animate-pulse', dot: 'bg-red-500', text: 'text-red-700', label: 'überfällig' },
} as const;

function fmtSec(s: number): string {
  if (s < 0) return `+${Math.abs(Math.ceil(s / 60))}m`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 85 ? '#22c55e' : score >= 70 ? '#eab308' : '#ef4444';
  const r = 22, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 28 28)" />
      <text x="28" y="33" textAnchor="middle" fontSize="12" fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

interface Props { locationId: string | null; }

export function KitchenPhase4305SmartTimingEchtzeitCockpitV2({ locationId }: Props) {
  const [data, setData] = useState<TimingData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/kitchen/smart-timing?location_id=${locationId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1_000); return () => clearInterval(id); }, []);

  const scoreColor = data.score >= 85 ? 'text-green-600' : data.score >= 70 ? 'text-yellow-600' : 'text-red-500';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ChefHat className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold text-gray-900">Smart-Timing Echtzeit V2</span>
          {loading && <span className="w-2 h-2 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.ueberfaellig > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-50 rounded-full px-1.5 py-0.5">
            <AlertTriangle className="w-2.5 h-2.5" />{data.ueberfaellig} überfällig
          </span>
        )}
      </div>

      {/* KPI Row */}
      <div className="flex items-center gap-2">
        <ScoreRing score={data.score} />
        <div className="flex-1 grid grid-cols-3 gap-1.5">
          <div className="bg-indigo-50 rounded-lg px-2 py-1.5 text-center">
            <p className="text-[9px] text-indigo-500 font-semibold uppercase">On-Time</p>
            <p className={`text-sm font-bold ${scoreColor}`}>{data.on_time_pct}%</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
            <p className="text-[9px] text-gray-500 font-semibold uppercase">Ø Prep</p>
            <p className="text-sm font-bold text-gray-700">{data.avg_prep_min}m</p>
          </div>
          <div className="bg-emerald-50 rounded-lg px-2 py-1.5 text-center">
            <p className="text-[9px] text-emerald-600 font-semibold uppercase">Synced</p>
            <p className="text-sm font-bold text-emerald-700">{data.fahrer_sync_ok}</p>
          </div>
        </div>
      </div>

      {/* Countdown Cards */}
      <div className="space-y-1">
        {data.bestellungen.map((b) => {
          const st = AMPEL[b.ampel];
          const live = b.remaining_sec - tick;
          return (
            <div key={b.order_id} className={`flex items-center gap-2 rounded-lg border-l-4 px-2 py-1.5 ${st.bg} ${st.ring}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-bold text-gray-500">#{b.bestellnummer}</span>
                  {b.status === 'wartend' && <span className="text-[8px] bg-gray-100 text-gray-400 rounded px-0.5">wartend</span>}
                  {b.status === 'fertig'  && <span className="text-[8px] bg-green-100 text-green-600 rounded px-0.5 flex items-center gap-0.5"><CheckCircle2 className="w-2 h-2" />fertig</span>}
                </div>
                <p className="text-[10px] text-gray-600 truncate">{b.artikel_liste}</p>
              </div>
              {b.fahrer_eta_min !== null && b.fahrer_eta_min > 0 && (
                <span className="text-[9px] text-indigo-500 font-medium flex-shrink-0">ETA {b.fahrer_eta_min}m</span>
              )}
              {b.fahrer_eta_min === 0 && <Zap className="w-3 h-3 text-amber-500 flex-shrink-0" />}
              <span className={`text-[12px] font-bold tabular-nums flex-shrink-0 ${st.text}`}>{fmtSec(live)}</span>
            </div>
          );
        })}
      </div>

      {/* Legend Footer */}
      <div className="flex items-center justify-between text-[9px] text-gray-400 border-t border-gray-100 pt-1.5">
        <div className="flex items-center gap-1.5">
          {(['gruen','gelb','orange','rot'] as const).map((a) => (
            <span key={a} className={`flex items-center gap-0.5`}>
              <span className={`w-1.5 h-1.5 rounded-full ${AMPEL[a].dot}`} />
              <span>{AMPEL[a].label}</span>
            </span>
          ))}
        </div>
        <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />15s</span>
      </div>
    </div>
  );
}
