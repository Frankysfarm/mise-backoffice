'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, AlertTriangle, CheckCircle, Clock, Flame, Zap, Target } from 'lucide-react';

interface Bestellung {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  prep_start_iso: string | null;
  target_min: number;
  status: 'kocht' | 'wartend' | 'bereit' | 'ueberfallig';
  fahrer_eta_min: number | null;
  komplexitaet: 'niedrig' | 'mittel' | 'hoch';
  zone?: string;
}

interface ApiData {
  bestellungen: Bestellung[];
  kochstart_score: number;
  on_time_rate: number;
  avg_prep_min: number;
  ueberfallig_count: number;
  ziel_min: number;
}

const MOCK: ApiData = {
  kochstart_score: 84,
  on_time_rate: 79,
  avg_prep_min: 14,
  ueberfallig_count: 2,
  ziel_min: 15,
  bestellungen: [
    { id: 'o1', bestellnummer: 'FF-2041', kunde_name: 'Müller, A.', prep_start_iso: new Date(Date.now() - 6 * 60000).toISOString(),  target_min: 15, status: 'kocht',       fahrer_eta_min: 9,    komplexitaet: 'niedrig', zone: 'Nord' },
    { id: 'o2', bestellnummer: 'FF-2042', kunde_name: 'Schmidt, B.', prep_start_iso: new Date(Date.now() - 16 * 60000).toISOString(), target_min: 15, status: 'ueberfallig', fahrer_eta_min: 2,    komplexitaet: 'mittel',  zone: 'Süd'  },
    { id: 'o3', bestellnummer: 'FF-2043', kunde_name: 'Weber, C.',   prep_start_iso: new Date(Date.now() - 13 * 60000).toISOString(), target_min: 15, status: 'kocht',       fahrer_eta_min: null, komplexitaet: 'hoch',    zone: 'West' },
    { id: 'o4', bestellnummer: 'FF-2044', kunde_name: 'Fischer, D.', prep_start_iso: null,                                             target_min: 15, status: 'wartend',     fahrer_eta_min: 20,   komplexitaet: 'niedrig', zone: 'Ost'  },
    { id: 'o5', bestellnummer: 'FF-2045', kunde_name: 'Becker, E.',  prep_start_iso: new Date(Date.now() - 15 * 60000).toISOString(), target_min: 15, status: 'bereit',      fahrer_eta_min: 4,    komplexitaet: 'mittel',  zone: 'Nord' },
    { id: 'o6', bestellnummer: 'FF-2046', kunde_name: 'Krause, F.',  prep_start_iso: new Date(Date.now() - 11 * 60000).toISOString(), target_min: 15, status: 'kocht',       fahrer_eta_min: 5,    komplexitaet: 'hoch',    zone: 'Süd'  },
  ],
};

function getRemSec(b: Bestellung, now: number): number | null {
  if (!b.prep_start_iso) return null;
  const elapsed = (now - new Date(b.prep_start_iso).getTime()) / 1000;
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

const STUFE: Record<Stufe, { card: string; badge: string; dot: string; label: string }> = {
  gut:         { card: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',   badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', dot: 'bg-emerald-500', label: 'OK'         },
  bald:        { card: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-700',       badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',    dot: 'bg-yellow-400',  label: 'bald fällig' },
  kritisch:    { card: 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700',       badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',    dot: 'bg-orange-500',  label: 'kritisch'    },
  ueberfallig: { card: 'bg-red-50 dark:bg-red-950/30 border-red-400 dark:border-red-700',                   badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',                dot: 'bg-red-500',     label: 'überfällig'  },
  wartend:     { card: 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700',               badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',               dot: 'bg-gray-400',    label: 'wartend'     },
  bereit:      { card: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',               badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',            dot: 'bg-blue-500',    label: 'bereit'      },
};

const KOMPLEX: Record<Bestellung['komplexitaet'], { icon: string; color: string }> = {
  niedrig: { icon: '○', color: 'text-gray-400' },
  mittel:  { icon: '◐', color: 'text-yellow-500' },
  hoch:    { icon: '●', color: 'text-red-500' },
};

function fmtSec(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = Math.floor(abs % 60);
  return `${sec < 0 ? '+' : ''}${m}:${String(s).padStart(2, '0')}`;
}

interface Props { locationId: string | null }

export function KitchenPhase4611SmartCountdownFarbkodierungLive({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/kitchen/timing?location_id=${locationId}`);
      if (res.ok) {
        const j = await res.json();
        if (j.bestellungen) setData(j);
      }
    } catch { /* Mock-Fallback */ }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 15_000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);

  const sorted = [...data.bestellungen].sort((a, b) => {
    const order: Record<Stufe, number> = { ueberfallig: 0, kritisch: 1, bald: 2, kocht: 3, gut: 4, wartend: 5, bereit: 6 } as unknown as Record<Stufe, number>;
    const sa = getStufe(getRemSec(a, now), a.status);
    const sb = getStufe(getRemSec(b, now), b.status);
    return (order[sa] ?? 5) - (order[sb] ?? 5);
  });

  const scoreColor = data.kochstart_score >= 80 ? 'text-emerald-600' : data.kochstart_score >= 60 ? 'text-yellow-600' : 'text-red-600';
  const onTimeColor = data.on_time_rate >= 80 ? 'text-emerald-600' : data.on_time_rate >= 65 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-indigo-500" />
          <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Smart Countdown · Farbkodierung</span>
        </div>
        {data.ueberfallig_count > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" /> {data.ueberfallig_count} überfällig
          </span>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
          <div className={`text-xl font-bold ${scoreColor}`}>{data.kochstart_score}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Kochstart-Score</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
          <div className={`text-xl font-bold ${onTimeColor}`}>{data.on_time_rate}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Pünktlichkeit</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
          <div className="text-xl font-bold text-gray-700 dark:text-gray-200">{data.avg_prep_min}min</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Ø Zubereitungszeit</div>
        </div>
      </div>

      {/* Farbkodierte Countdown-Kacheln */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sorted.map((b) => {
          const remSec = getRemSec(b, now);
          const stufe = getStufe(remSec, b.status);
          const st = STUFE[stufe];
          const kx = KOMPLEX[b.komplexitaet];
          return (
            <div key={b.id} className={`rounded-lg border p-3 ${st.card}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${st.dot} flex-shrink-0`} />
                  <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-200">{b.bestellnummer}</span>
                  <span className={`text-xs ${kx.color}`} title={`Komplexität: ${b.komplexitaet}`}>{kx.icon}</span>
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${st.badge}`}>{st.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{b.kunde_name}{b.zone ? ` · ${b.zone}` : ''}</span>
                <span className={`font-mono text-lg font-bold tabular-nums ${stufe === 'ueberfallig' ? 'text-red-600 dark:text-red-400' : stufe === 'kritisch' ? 'text-orange-600 dark:text-orange-400' : stufe === 'bald' ? 'text-yellow-600 dark:text-yellow-400' : stufe === 'bereit' ? 'text-blue-600 dark:text-blue-400' : stufe === 'wartend' ? 'text-gray-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {stufe === 'wartend' ? '—:——' : stufe === 'bereit' ? '✓' : remSec !== null ? fmtSec(remSec) : '—:——'}
                </span>
              </div>
              {b.fahrer_eta_min !== null && (
                <div className="flex items-center gap-1 mt-1">
                  <Zap className="h-3 w-3 text-indigo-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Fahrer in {b.fahrer_eta_min} min</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legende */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {(Object.entries(STUFE) as [Stufe, typeof STUFE[Stufe]][]).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${v.dot}`} />
            <span className="text-xs text-gray-500 dark:text-gray-400">{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
