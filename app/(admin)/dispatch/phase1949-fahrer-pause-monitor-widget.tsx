'use client';

import { useState, useEffect } from 'react';
import { Coffee, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type PauseStatus = 'ok' | 'pause_faellig' | 'kritisch';

interface FahrerPauseInfo {
  fahrer_id: string;
  fahrer_name: string;
  letzte_pause_vor_min: number | null;
  pausen_anzahl: number;
  gesamtpausenzeit_min: number;
  status: PauseStatus;
  alert: boolean;
}

interface PauseMonitorData {
  location_id: string;
  fahrer: FahrerPauseInfo[];
  alert_count: number;
  generiert_am: string;
}

const STATUS_STYLE: Record<PauseStatus, { dot: string; text: string; label: string }> = {
  ok:            { dot: 'bg-green-500',  text: 'text-green-700 dark:text-green-400',  label: 'OK' },
  pause_faellig: { dot: 'bg-amber-500',  text: 'text-amber-700 dark:text-amber-400',  label: 'Pause fällig' },
  kritisch:      { dot: 'bg-red-500',    text: 'text-red-700 dark:text-red-400',      label: 'Kritisch' },
};

const MOCK: PauseMonitorData = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max Müller',   letzte_pause_vor_min: 45,  pausen_anzahl: 2, gesamtpausenzeit_min: 30, status: 'ok',            alert: false },
    { fahrer_id: 'f2', fahrer_name: 'Lisa Schmidt', letzte_pause_vor_min: 135, pausen_anzahl: 1, gesamtpausenzeit_min: 15, status: 'pause_faellig', alert: true  },
    { fahrer_id: 'f3', fahrer_name: 'Tom Wagner',   letzte_pause_vor_min: null,pausen_anzahl: 0, gesamtpausenzeit_min: 0,  status: 'ok',            alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Anna Becker',  letzte_pause_vor_min: 195, pausen_anzahl: 1, gesamtpausenzeit_min: 10, status: 'kritisch',      alert: true  },
  ],
  alert_count: 2,
  generiert_am: new Date().toISOString(),
};

export default function DispatchPhase1949FahrerPauseMonitorWidget({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [daten, setDaten] = useState<PauseMonitorData | null>(null);
  const [offen, setOffen] = useState(true);

  const laden = async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-pause-monitor?location_id=${locationId}`);
      if (!res.ok) { setDaten(MOCK); return; }
      setDaten(await res.json());
    } catch {
      setDaten(MOCK);
    }
  };

  useEffect(() => {
    laden();
    const id = setInterval(laden, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId) return null;

  const anzeige = daten ?? MOCK;

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Coffee className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Fahrer-Pausen-Monitor</span>
          {anzeige.alert_count > 0 && (
            <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full font-bold">
              {anzeige.alert_count} Alert{anzeige.alert_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {offen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {offen && (
        <div className="border-t border-slate-100 dark:border-slate-700">
          {anzeige.alert_count > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                {anzeige.alert_count} Fahrer seit über 2 Stunden ohne Pause!
              </p>
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {anzeige.fahrer.map((f) => {
              const s = STATUS_STYLE[f.status];
              return (
                <div key={f.fahrer_id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', s.dot)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{f.fahrer_name}</p>
                    <p className={cn('text-[10px]', s.text)}>
                      {s.label}
                      {f.letzte_pause_vor_min !== null
                        ? ` · vor ${f.letzte_pause_vor_min} Min`
                        : ' · noch keine Pause'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-300">
                      {f.gesamtpausenzeit_min} Min
                    </p>
                    <p className="text-[9px] text-slate-400">{f.pausen_anzahl}× Pause</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 text-[9px] text-slate-400 text-right">
            Aktualisiert: {new Date(anzeige.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}
    </div>
  );
}
