'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChevronDown, ChevronUp, AlertTriangle, UserCheck } from 'lucide-react';

interface FahrerPausenzeit {
  driver_id: string;
  name: string;
  avg_idle_min: number;
  idle_over_15_count: number;
  aktiv_min: number;
  gesamt_min: number;
  effizienz_pct: number;
  alert: boolean;
}

interface SchichtPausenzeitData {
  fahrer: FahrerPausenzeit[];
  team_avg_idle_min: number;
  alert_count: number;
}

const MOCK: SchichtPausenzeitData = {
  fahrer: [
    { driver_id: 'd3', name: 'Tom B.', avg_idle_min: 22.1, idle_over_15_count: 3, aktiv_min: 120, gesamt_min: 270, effizienz_pct: 44, alert: true },
    { driver_id: 'd4', name: 'Anna L.', avg_idle_min: 11.0, idle_over_15_count: 1, aktiv_min: 195, gesamt_min: 270, effizienz_pct: 72, alert: false },
    { driver_id: 'd1', name: 'Max M.', avg_idle_min: 8.2, idle_over_15_count: 0, aktiv_min: 210, gesamt_min: 270, effizienz_pct: 78, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', avg_idle_min: 5.4, idle_over_15_count: 0, aktiv_min: 240, gesamt_min: 270, effizienz_pct: 89, alert: false },
  ],
  team_avg_idle_min: 11.7,
  alert_count: 1,
};

const POLL_MS = 15 * 60 * 1000;
const IDLE_ALERT = 15;

function barColor(avgIdle: number) {
  if (avgIdle <= 8) return 'bg-green-500';
  if (avgIdle <= 15) return 'bg-amber-400';
  return 'bg-red-500';
}

function barWidth(avgIdle: number, max = 30) {
  return Math.min((avgIdle / max) * 100, 100);
}

export function DispatchPhase2061IdleZeitMonitor({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<SchichtPausenzeitData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/schicht-pausenzeit?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: SchichtPausenzeitData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;
  const alertFahrer = d.fahrer.filter(f => f.alert);

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          Idle-Zeit-Monitor
          <span className="text-xs text-gray-400 font-normal">Pausenzeiten heute</span>
          {d.alert_count > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-red-950 text-red-300">
              <AlertTriangle className="w-3 h-3" />
              {d.alert_count} Alert
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-center">
              <div className="text-lg font-black tabular-nums text-amber-300">{d.team_avg_idle_min} Min</div>
              <div className="text-[10px] text-gray-400">Team-Ø Idle</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-center">
              <div className={cn('text-lg font-black tabular-nums', d.alert_count > 0 ? 'text-red-400' : 'text-green-400')}>
                {d.alert_count}
              </div>
              <div className="text-[10px] text-gray-400">Fahrer &gt;15 Min</div>
            </div>
          </div>

          {/* Alert banner */}
          {alertFahrer.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-red-950/60 border border-red-800 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div className="text-xs text-red-300">
                <strong>{alertFahrer.map(f => f.name).join(', ')}</strong> — lange Pausenzeit. Jetzt zuweisen!
              </div>
            </div>
          )}

          {/* Fahrer list */}
          <div className="space-y-2">
            {d.fahrer.map(f => (
              <div key={f.driver_id} className="rounded-lg bg-gray-800/60 px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {f.alert ? (
                      <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                    ) : (
                      <UserCheck className="w-3 h-3 text-green-400 shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-gray-100">{f.name}</span>
                    {f.alert && (
                      <span className="px-1 py-0.5 rounded text-[9px] bg-red-900 text-red-300 font-bold">
                        Jetzt zuweisen
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      'text-xs font-bold tabular-nums',
                      f.avg_idle_min > IDLE_ALERT ? 'text-red-400' : f.avg_idle_min > 8 ? 'text-amber-400' : 'text-green-400',
                    )}>
                      Ø {f.avg_idle_min} Min
                    </span>
                    <span className="text-[10px] text-gray-500">{f.effizienz_pct}% aktiv</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-black/20 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', barColor(f.avg_idle_min))}
                    style={{ width: `${barWidth(f.avg_idle_min)}%` }}
                  />
                </div>
                {f.idle_over_15_count > 0 && (
                  <div className="text-[10px] text-red-400 mt-0.5">
                    {f.idle_over_15_count}× Pause &gt;15 Min heute
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
