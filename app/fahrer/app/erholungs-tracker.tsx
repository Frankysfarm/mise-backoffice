'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type FatigueLevel = 'fresh' | 'moderate' | 'tired' | 'exhausted';

interface ErholungsData {
  activeMinutes: number;
  pauseMinutes: number;
  totalOnShiftMinutes: number;
  fatigueLevel: FatigueLevel;
  lastPauseAt: string | null;
  minutesSinceLastPause: number | null;
  recommendation: string;
  toursToday: number;
  deliveriesToday: number;
}

interface ApiResponse extends ErholungsData {
  ok: boolean;
  generatedAt: string;
}

interface Props {
  driverId: string;
  locationId: string | null;
  onlineSeit: string | null;
}

const fatigueStyle: Record<FatigueLevel, {
  border: string; bg: string; bar: string; title: string; body: string; icon: string; label: string
}> = {
  fresh:    { border: 'border-green-700/30',  bg: 'bg-green-900/15',  bar: 'bg-green-500',  title: 'text-green-300',  body: 'text-green-200',  icon: '💪', label: 'Fit' },
  moderate: { border: 'border-blue-700/30',   bg: 'bg-blue-900/15',   bar: 'bg-blue-400',   title: 'text-blue-300',   body: 'text-blue-200',   icon: '🙂', label: 'Gut' },
  tired:    { border: 'border-amber-700/40',  bg: 'bg-amber-900/20',  bar: 'bg-amber-400',  title: 'text-amber-300',  body: 'text-amber-200',  icon: '😴', label: 'Müde' },
  exhausted:{ border: 'border-red-700/40',    bg: 'bg-red-900/20',    bar: 'bg-red-500',    title: 'text-red-300',    body: 'text-red-200',    icon: '⚠️', label: 'Erschöpft' },
};

function fmtMin(min: number): string {
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function FahrerErholungsTracker({ driverId, locationId, onlineSeit }: Props) {
  const [data, setData] = useState<ErholungsData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!driverId || !locationId) return;

    const load = () => {
      const params = new URLSearchParams({ driver_id: driverId, location_id: locationId });
      fetch(`/api/delivery/driver/erholungs-tracker?${params.toString()}`)
        .then((r) => r.json())
        .then((d: ApiResponse) => {
          if (d.ok) setData(d);
        })
        .catch(() => {});
    };

    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [driverId, locationId]);

  // Only show once online for ≥ 2h or fatigue is moderate+
  if (!onlineSeit || !data || dismissed) return null;
  const onlineMin = Math.floor((Date.now() - new Date(onlineSeit).getTime()) / 60_000);
  if (onlineMin < 120 && data.fatigueLevel === 'fresh') return null;

  const s = fatigueStyle[data.fatigueLevel];
  const fatigueBarPct = Math.min(100, (data.activeMinutes / 360) * 100);

  return (
    <section className={cn('rounded-2xl border p-4 space-y-3', s.bg, s.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{s.icon}</span>
          <div>
            <div className={cn('text-xs font-bold uppercase tracking-wide', s.title)}>
              Erholungs-Tracker
            </div>
            <div className="text-sm font-bold text-white">
              Status: {s.label}
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/40 hover:text-white/80 text-lg leading-none shrink-0"
          aria-label="Schließen"
        >
          ✕
        </button>
      </div>

      {/* Fatigue Bar */}
      <div>
        <div className="flex justify-between text-[10px] text-white/60 mb-1">
          <span>Aktivzeit</span>
          <span>{fmtMin(data.activeMinutes)} / 6h</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', s.bar)}
            style={{ width: `${fatigueBarPct}%` }}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/10 rounded-xl p-2 text-center">
          <div className="text-xs font-black text-white">{fmtMin(data.activeMinutes)}</div>
          <div className="text-[9px] text-white/50">Aktivzeit</div>
        </div>
        <div className="bg-white/10 rounded-xl p-2 text-center">
          <div className="text-xs font-black text-white">{fmtMin(data.pauseMinutes)}</div>
          <div className="text-[9px] text-white/50">Pausen</div>
        </div>
        <div className="bg-white/10 rounded-xl p-2 text-center">
          <div className="text-xs font-black text-white">{data.deliveriesToday}</div>
          <div className="text-[9px] text-white/50">Lieferungen</div>
        </div>
      </div>

      {/* Recommendation */}
      <p className={cn('text-xs leading-relaxed', s.body)}>
        {data.recommendation}
      </p>

      {data.lastPauseAt && data.minutesSinceLastPause !== null && (
        <p className="text-[10px] text-white/40">
          Letzte Pause vor {fmtMin(data.minutesSinceLastPause)}
        </p>
      )}
    </section>
  );
}
