'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, AlertTriangle, Flame, CheckCircle, Clock, Zap, Target } from 'lucide-react';

interface Bestellung {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  prep_start_iso: string | null;
  target_min: number;
  status: 'kocht' | 'wartend' | 'bereit' | 'ueberfallig';
  fahrer_eta_min: number | null;
  komplexitaet: 'niedrig' | 'mittel' | 'hoch';
}

interface ApiData {
  bestellungen: Bestellung[];
  kochstart_score: number;
  on_time_rate: number;
  avg_prep_min: number;
  ueberfallig_count: number;
  fahrer_sync_count: number;
  kochzeit_ziel_min: number;
  queue_prognose_15min: number;
}

const MOCK: ApiData = {
  kochstart_score: 87,
  on_time_rate: 82,
  avg_prep_min: 13,
  ueberfallig_count: 1,
  fahrer_sync_count: 4,
  kochzeit_ziel_min: 15,
  queue_prognose_15min: 6,
  bestellungen: [
    { id: 'o1', bestellnummer: 'FF-1042', kunde_name: 'Müller, A.', prep_start_iso: new Date(Date.now() - 7 * 60000).toISOString(), target_min: 15, status: 'kocht', fahrer_eta_min: 8, komplexitaet: 'niedrig' },
    { id: 'o2', bestellnummer: 'FF-1043', kunde_name: 'Schmidt, B.', prep_start_iso: new Date(Date.now() - 17 * 60000).toISOString(), target_min: 15, status: 'ueberfallig', fahrer_eta_min: 2, komplexitaet: 'mittel' },
    { id: 'o3', bestellnummer: 'FF-1044', kunde_name: 'Weber, C.', prep_start_iso: new Date(Date.now() - 11 * 60000).toISOString(), target_min: 15, status: 'kocht', fahrer_eta_min: null, komplexitaet: 'hoch' },
    { id: 'o4', bestellnummer: 'FF-1045', kunde_name: 'Fischer, D.', prep_start_iso: null, target_min: 15, status: 'wartend', fahrer_eta_min: 22, komplexitaet: 'niedrig' },
    { id: 'o5', bestellnummer: 'FF-1046', kunde_name: 'Becker, E.', prep_start_iso: new Date(Date.now() - 14 * 60000).toISOString(), target_min: 15, status: 'bereit', fahrer_eta_min: 3, komplexitaet: 'mittel' },
  ],
};

function getRemSec(b: Bestellung): number | null {
  if (!b.prep_start_iso) return null;
  const elapsed = (Date.now() - new Date(b.prep_start_iso).getTime()) / 1000;
  return b.target_min * 60 - elapsed;
}

type Stufe = 'gut' | 'bald' | 'kritisch' | 'ueberfallig' | 'wartend' | 'bereit';

function getStufe(remSec: number | null, status: Bestellung['status']): Stufe {
  if (status === 'bereit') return 'bereit';
  if (status === 'wartend') return 'wartend';
  if (status === 'ueberfallig' || (remSec !== null && remSec < 0)) return 'ueberfallig';
  if (remSec !== null && remSec < 120) return 'kritisch';
  if (remSec !== null && remSec < 300) return 'bald';
  return 'gut';
}

const STUFE_STYLES: Record<Stufe, { card: string; dot: string; label: string }> = {
  gut:        { card: 'bg-emerald-50 border-emerald-200 text-emerald-800', dot: 'bg-emerald-500', label: 'OK' },
  bald:       { card: 'bg-yellow-50 border-yellow-300 text-yellow-800',    dot: 'bg-yellow-400', label: 'bald' },
  kritisch:   { card: 'bg-orange-50 border-orange-300 text-orange-800',    dot: 'bg-orange-500', label: 'kritisch' },
  ueberfallig:{ card: 'bg-red-50 border-red-300 text-red-800',             dot: 'bg-red-500',    label: 'überfällig' },
  wartend:    { card: 'bg-gray-50 border-gray-200 text-gray-600',          dot: 'bg-gray-400',   label: 'wartend' },
  bereit:     { card: 'bg-blue-50 border-blue-200 text-blue-800',          dot: 'bg-blue-500',   label: 'bereit' },
};

const KOMPLEXITAET_ICON: Record<Bestellung['komplexitaet'], string> = {
  niedrig: '○', mittel: '◐', hoch: '●',
};

function formatSec(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = Math.floor(abs % 60);
  return `${sec < 0 ? '+' : ''}${m}:${String(s).padStart(2, '0')}`;
}

interface Props { locationId: string | null }

export function KitchenPhase4586SmartTimingMasterCockpit({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const [timingRes, forecastRes] = await Promise.all([
        fetch(`/api/delivery/admin/smart-timing-countdown?location_id=${locationId}`),
        fetch(`/api/delivery/kitchen/queue-forecast?location_id=${locationId}`),
      ]);
      if (timingRes.ok) {
        const j = await timingRes.json();
        if (!j.error) {
          const qp = forecastRes.ok ? await forecastRes.json() : null;
          setData({ ...j, queue_prognose_15min: qp?.horizons?.[0]?.predicted ?? j.queue_prognose_15min ?? 0 });
        }
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 15_000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(t); }, []);

  const scoreColor = data.kochstart_score >= 85 ? 'text-emerald-600' : data.kochstart_score >= 70 ? 'text-yellow-600' : 'text-red-600';
  const scoreBarColor = data.kochstart_score >= 85 ? 'bg-emerald-500' : data.kochstart_score >= 70 ? 'bg-yellow-400' : 'bg-red-500';

  const sortedBest = [...data.bestellungen].sort((a, b) => {
    const order: Record<Stufe, number> = { ueberfallig: 0, kritisch: 1, bald: 2, gut: 3, wartend: 4, bereit: 5 };
    return order[getStufe(getRemSec(a), a.status)] - order[getStufe(getRemSec(b), b.status)];
  });

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-indigo-200 dark:border-indigo-800 p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Smart-Timing Master Cockpit</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.ueberfallig_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-semibold bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-full animate-pulse">
            <Flame className="w-3 h-3" /> {data.ueberfallig_count} überfällig
          </span>
        )}
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="bg-indigo-50 dark:bg-indigo-950 rounded-lg p-2">
          <p className="text-[9px] text-indigo-500 font-medium uppercase tracking-wide">Score</p>
          <p className={`text-lg font-black ${scoreColor}`}>{data.kochstart_score}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950 rounded-lg p-2">
          <p className="text-[9px] text-emerald-600 font-medium uppercase tracking-wide">On-Time</p>
          <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{data.on_time_rate}%</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
          <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wide">Ø Prep</p>
          <p className="text-lg font-black text-gray-700 dark:text-gray-200">{data.avg_prep_min}m</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-2">
          <p className="text-[9px] text-blue-500 font-medium uppercase tracking-wide">+15m</p>
          <p className="text-lg font-black text-blue-700 dark:text-blue-300">{data.queue_prognose_15min}</p>
        </div>
      </div>

      {/* Kochstart-Score-Balken */}
      <div className="space-y-0.5">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <Target className="w-3 h-3" /> Kochstart-Score
          </div>
          <span className={`text-[10px] font-bold ${scoreColor}`}>{data.kochstart_score}/100</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${scoreBarColor}`}
            style={{ width: `${data.kochstart_score}%` }}
          />
        </div>
      </div>

      {/* Countdown-Kacheln — sortiert nach Dringlichkeit */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {sortedBest.map(b => {
          const remSec = getRemSec(b);
          const stufe = getStufe(remSec, b.status);
          const st = STUFE_STYLES[stufe];
          return (
            <div key={b.id} className={`rounded-lg border p-2.5 ${st.card} relative overflow-hidden`}>
              {/* Komplexitäts-Indikator */}
              <span className="absolute top-1.5 right-2 text-[10px] opacity-50">
                {KOMPLEXITAET_ICON[b.komplexitaet]}
              </span>

              <div className="flex items-center justify-between mb-1 pr-4">
                <span className="text-[10px] font-bold font-mono">#{b.bestellnummer.slice(-4)}</span>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot} ${stufe === 'ueberfallig' ? 'animate-pulse' : ''}`} />
              </div>

              <div className="text-[9px] truncate opacity-70">{b.kunde_name}</div>

              <div className="mt-1.5 flex items-end justify-between">
                <span className="text-xl font-black font-mono tabular-nums leading-none">
                  {stufe === 'wartend'
                    ? <span className="text-sm text-gray-400">warte</span>
                    : stufe === 'bereit'
                    ? <CheckCircle className="w-5 h-5 text-blue-500" />
                    : remSec !== null
                    ? formatSec(remSec)
                    : '—'}
                </span>
                {b.fahrer_eta_min !== null && (
                  <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />{b.fahrer_eta_min}m
                  </span>
                )}
              </div>

              {stufe === 'ueberfallig' && (
                <div className="mt-1 flex items-center gap-0.5 text-[9px] text-red-700 font-black uppercase tracking-wide">
                  <AlertTriangle className="w-2.5 h-2.5" /> fertigstellen!
                </div>
              )}
              {stufe === 'kritisch' && (
                <div className="mt-1 flex items-center gap-0.5 text-[9px] text-orange-700 font-semibold">
                  <Zap className="w-2.5 h-2.5" /> jetzt abschließen
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legende + Meta */}
      <div className="flex items-center justify-between text-[9px] text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
        <span className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />gut</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-yellow-400" />bald</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-orange-400" />krit.</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-red-500" />über.</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="opacity-50">○◐●</span> Komplexität · 15s-Polling
        </span>
      </div>
    </div>
  );
}
