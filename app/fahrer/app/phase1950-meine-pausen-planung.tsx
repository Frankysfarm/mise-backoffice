'use client';

import { useState, useEffect } from 'react';
import { Coffee, ChevronUp, ChevronDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PauseMonitorData {
  fahrer: Array<{
    fahrer_id: string;
    letzte_pause_vor_min: number | null;
    pausen_anzahl: number;
    gesamtpausenzeit_min: number;
    status: string;
    alert: boolean;
  }>;
}

export default function FahrerPhase1950MeinePausenPlanung({
  locationId,
  driverId,
  isOnline,
  className,
}: {
  locationId: string | null;
  driverId: string | null;
  isOnline: boolean;
  className?: string;
}) {
  const [daten, setDaten] = useState<PauseMonitorData | null>(null);
  const [offen, setOffen] = useState(true);

  const laden = async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-pause-monitor?location_id=${locationId}`);
      if (!res.ok) return;
      setDaten(await res.json());
    } catch {}
  };

  useEffect(() => {
    if (!isOnline) return;
    laden();
    const id = setInterval(laden, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline, locationId, driverId]);

  if (!isOnline) return null;

  const ich = daten?.fahrer.find((f) => f.fahrer_id === driverId) ?? null;
  const letztePause = ich?.letzte_pause_vor_min ?? null;
  const gesamtPause = ich?.gesamtpausenzeit_min ?? 0;
  const anzahl = ich?.pausen_anzahl ?? 0;
  const alert = ich?.alert ?? false;

  const empfehlung = (() => {
    if (letztePause === null) return 'Noch keine Pause heute — plane eine kurze Erholungspause ein.';
    if (letztePause > 180) return 'Dringend! Du arbeitest schon über 3 Stunden ohne Pause.';
    if (letztePause > 120) return 'Zeit für eine Pause! Über 2 Stunden seit deiner letzten Erholung.';
    if (letztePause > 60) return 'Noch gut — aber nach einer weiteren Stunde Pause einlegen.';
    return 'Super! Du hast dich kürzlich erholt.';
  })();

  return (
    <div className={cn('rounded-xl border border-orange-200 dark:border-orange-700 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Coffee className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Meine Pausen-Planung</span>
          {alert && (
            <span className="text-[10px] bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">
              Pause fällig!
            </span>
          )}
        </div>
        {offen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {offen && (
        <div className="border-t border-orange-100 dark:border-orange-800 px-4 pb-4 pt-3 space-y-3">
          {alert && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                Warnung: Über 2 Stunden ohne Pause!
              </p>
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 px-3 py-2 text-center">
              <p className="text-xs font-black tabular-nums text-orange-700 dark:text-orange-300">
                {letztePause !== null ? `${letztePause} Min` : '—'}
              </p>
              <p className="text-[9px] text-slate-500 mt-0.5">Letzte Pause</p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2 text-center">
              <p className="text-xs font-black tabular-nums text-slate-700 dark:text-slate-300">
                {gesamtPause} Min
              </p>
              <p className="text-[9px] text-slate-500 mt-0.5">Gesamt heute</p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2 text-center">
              <p className="text-xs font-black tabular-nums text-slate-700 dark:text-slate-300">
                {anzahl}×
              </p>
              <p className="text-[9px] text-slate-500 mt-0.5">Pausen</p>
            </div>
          </div>

          {/* Empfehlung */}
          <div className={cn(
            'flex items-start gap-2 rounded-lg px-3 py-2',
            alert
              ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
              : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700',
          )}>
            {alert
              ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              : <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            }
            <p className={cn(
              'text-xs leading-relaxed',
              alert ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300',
            )}>
              {empfehlung}
            </p>
          </div>

          {/* Pausenzähler-Balken */}
          <div>
            <div className="flex justify-between text-[9px] text-slate-400 mb-1">
              <span>Empfehlung: 2× Pause/Schicht</span>
              <span>{Math.min(anzahl, 2)}/2</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  anzahl >= 2 ? 'bg-green-500' : anzahl >= 1 ? 'bg-amber-400' : 'bg-red-400',
                )}
                style={{ width: `${Math.min((anzahl / 2) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
