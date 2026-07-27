'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, AlertTriangle, Flame, CheckCircle, Clock } from 'lucide-react';

interface Bestellung {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  prep_start_iso: string | null;
  target_min: number;
  status: 'kocht' | 'wartend' | 'bereit' | 'ueberfallig';
  fahrer_eta_min: number | null;
}

interface ApiData {
  bestellungen: Bestellung[];
  kochstart_score: number;
  on_time_rate: number;
  avg_prep_min: number;
  ueberfallig_count: number;
  fahrer_sync_count: number;
}

const MOCK: ApiData = {
  kochstart_score: 82,
  on_time_rate: 78,
  avg_prep_min: 14,
  ueberfallig_count: 2,
  fahrer_sync_count: 3,
  bestellungen: [
    { id: 'o1', bestellnummer: 'FF-1042', kunde_name: 'Müller, A.', prep_start_iso: new Date(Date.now() - 8 * 60000).toISOString(), target_min: 15, status: 'kocht', fahrer_eta_min: 7 },
    { id: 'o2', bestellnummer: 'FF-1043', kunde_name: 'Schmidt, B.', prep_start_iso: new Date(Date.now() - 18 * 60000).toISOString(), target_min: 15, status: 'ueberfallig', fahrer_eta_min: 2 },
    { id: 'o3', bestellnummer: 'FF-1044', kunde_name: 'Weber, C.', prep_start_iso: new Date(Date.now() - 12 * 60000).toISOString(), target_min: 15, status: 'kocht', fahrer_eta_min: null },
    { id: 'o4', bestellnummer: 'FF-1045', kunde_name: 'Fischer, D.', prep_start_iso: null, target_min: 15, status: 'wartend', fahrer_eta_min: 20 },
  ],
};

function getRemSec(b: Bestellung): number | null {
  if (!b.prep_start_iso) return null;
  const elapsed = (Date.now() - new Date(b.prep_start_iso).getTime()) / 1000;
  return b.target_min * 60 - elapsed;
}

function farbklasse(remSec: number | null, status: Bestellung['status']): string {
  if (status === 'ueberfallig' || (remSec !== null && remSec < 0)) return 'bg-red-50 border-red-300 text-red-700';
  if (remSec !== null && remSec < 120) return 'bg-orange-50 border-orange-300 text-orange-700';
  if (remSec !== null && remSec < 300) return 'bg-yellow-50 border-yellow-300 text-yellow-700';
  return 'bg-emerald-50 border-emerald-200 text-emerald-700';
}

function dotColor(remSec: number | null, status: Bestellung['status']): string {
  if (status === 'ueberfallig' || (remSec !== null && remSec < 0)) return 'bg-red-500';
  if (remSec !== null && remSec < 120) return 'bg-orange-500';
  if (remSec !== null && remSec < 300) return 'bg-yellow-400';
  return 'bg-emerald-500';
}

function formatSec(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = Math.floor(abs % 60);
  return `${sec < 0 ? '+' : ''}${m}:${String(s).padStart(2, '0')}`;
}

interface Props { locationId: string | null; }

export function KitchenPhase4175SmartTimingCountdownFarbkodierungUltimate({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/smart-timing-countdown?location_id=${locationId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 15_000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(t); }, []);

  const scoreColor = data.kochstart_score >= 85 ? 'text-emerald-600' : data.kochstart_score >= 70 ? 'text-yellow-600' : 'text-red-600';
  const scoreBarColor = data.kochstart_score >= 85 ? 'bg-emerald-500' : data.kochstart_score >= 70 ? 'bg-yellow-400' : 'bg-red-500';

  return (
    <div className="bg-white rounded-xl border border-indigo-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-gray-900">Smart-Timing Countdown Ultimate</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.ueberfallig_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3.5 h-3.5" /> {data.ueberfallig_count} überfällig
          </span>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-indigo-50 rounded-lg p-2">
          <p className="text-[10px] text-indigo-500 font-medium">Score</p>
          <p className={`text-base font-black ${scoreColor}`}>{data.kochstart_score}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-2">
          <p className="text-[10px] text-emerald-600 font-medium">On-Time</p>
          <p className="text-base font-black text-emerald-700">{data.on_time_rate}%</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-[10px] text-gray-500 font-medium">Ø Prep</p>
          <p className="text-base font-black text-gray-700">{data.avg_prep_min}min</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2">
          <p className="text-[10px] text-blue-500 font-medium">Fahrer-Sync</p>
          <p className="text-base font-black text-blue-700">{data.fahrer_sync_count}</p>
        </div>
      </div>

      {/* Score-Balken */}
      <div className="space-y-0.5">
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>Kochstart-Score</span><span className={scoreColor}>{data.kochstart_score}/100</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${scoreBarColor}`} style={{ width: `${data.kochstart_score}%` }} />
        </div>
      </div>

      {/* Countdown-Kacheln */}
      <div className="grid grid-cols-2 gap-2">
        {data.bestellungen.map(b => {
          const remSec = getRemSec(b);
          const cardClass = farbklasse(remSec, b.status);
          const dot = dotColor(remSec, b.status);
          return (
            <div key={b.id} className={`rounded-lg border p-2.5 ${cardClass}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold font-mono">{b.bestellnummer.replace('FF-', '#')}</span>
                <span className={`w-2 h-2 rounded-full ${dot} ${b.status === 'ueberfallig' ? 'animate-pulse' : ''}`} />
              </div>
              <div className="text-[10px] truncate text-gray-600">{b.kunde_name}</div>
              <div className="mt-1.5 flex items-end justify-between">
                <span className="text-xl font-black font-mono tabular-nums leading-none">
                  {b.status === 'wartend' ? <span className="text-sm text-gray-400">wartend</span>
                   : b.status === 'bereit' ? <CheckCircle className="w-5 h-5 text-emerald-600" />
                   : remSec !== null ? formatSec(remSec) : '—'}
                </span>
                {b.fahrer_eta_min !== null && (
                  <span className="text-[9px] text-blue-600 font-medium flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />{b.fahrer_eta_min}min
                  </span>
                )}
              </div>
              {b.status === 'ueberfallig' && (
                <div className="mt-1 flex items-center gap-0.5 text-[9px] text-red-600 font-bold">
                  <Flame className="w-2.5 h-2.5" /> JETZT FERTIGSTELLEN!
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span className="flex items-center gap-0.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />gut&nbsp;
          <span className="w-2 h-2 rounded-full bg-yellow-400" />bald&nbsp;
          <span className="w-2 h-2 rounded-full bg-orange-400" />kritisch&nbsp;
          <span className="w-2 h-2 rounded-full bg-red-500" />überfällig
        </span>
        <span>15-Sek-Polling</span>
      </div>
    </div>
  );
}
