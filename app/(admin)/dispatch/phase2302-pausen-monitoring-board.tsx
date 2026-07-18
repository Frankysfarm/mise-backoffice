'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Coffee } from 'lucide-react';

type PausenAmpel = 'gruen' | 'gelb' | 'rot';

type FahrerPausenInfo = {
  fahrer_id: string;
  fahrer_name: string;
  letzte_pause_vor_min: number | null;
  pausen_anzahl: number;
  gesamtpausenzeit_min: number;
  ampel: PausenAmpel;
  alert: boolean;
};

type ApiData = {
  fahrer: FahrerPausenInfo[];
  alert_count: number;
  team_avg_pausen: number;
};

function ampelIcon(a: PausenAmpel): string {
  if (a === 'gruen') return '🟢';
  if (a === 'gelb') return '🟡';
  return '🔴';
}

function rowBg(a: PausenAmpel): string {
  if (a === 'gruen') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (a === 'gelb') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function rowText(a: PausenAmpel): string {
  if (a === 'gruen') return 'text-green-700 dark:text-green-300';
  if (a === 'gelb') return 'text-yellow-700 dark:text-yellow-300';
  return 'text-red-700 dark:text-red-300';
}

function formatMin(min: number | null): string {
  if (min === null) return 'Heute noch keine';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `vor ${m} Min`;
  return `vor ${h}h ${m}m`;
}

function dispatcherTipp(alertCount: number): string {
  if (alertCount === 0) return 'Alle Fahrer haben ausreichend pausiert — kein Handlungsbedarf.';
  if (alertCount === 1) return '1 Fahrer pausiert zu lange — kurze Rückmeldung empfohlen.';
  return `${alertCount} Fahrer ohne ausreichende Pause — Dispatcher sollte aktiv prüfen.`;
}

export function DispatchPhase2302PausenMonitoringBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-pausen?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const sorted = useMemo(
    () =>
      [...(data?.fahrer ?? [])].sort(
        (a, b) => (b.letzte_pause_vor_min ?? -1) - (a.letzte_pause_vor_min ?? -1),
      ),
    [data],
  );

  const alertFahrer = useMemo(() => sorted.filter((f) => f.alert), [sorted]);
  const hasAlert = alertFahrer.length > 0;

  if (!locationId || !data) return null;

  const teamLevel: PausenAmpel = data.alert_count === 0 ? 'gruen' : data.alert_count <= 1 ? 'gelb' : 'rot';

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Coffee className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-orange-900 dark:text-orange-200 text-sm">
            Pausen-Monitoring-Board
          </span>
          <span className={`text-xs font-bold ml-1 ${rowText(teamLevel)}`}>
            {ampelIcon(teamLevel)} {data.alert_count} Alerts
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-orange-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-orange-400" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {hasAlert && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                <strong>{alertFahrer.length} Fahrer</strong> ohne ausreichende Pause —{' '}
                {alertFahrer.map((f) => f.fahrer_name).join(', ')}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-orange-100 dark:border-orange-900 p-2 text-center">
              <div className={`font-bold text-base ${rowText(teamLevel)}`}>{data.alert_count}</div>
              <div className="text-gray-500 dark:text-gray-400">Fahrer &gt;4h ohne Pause</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-orange-100 dark:border-orange-900 p-2 text-center">
              <div className="font-bold text-base text-orange-700 dark:text-orange-300">
                {data.team_avg_pausen}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Ø Pausen je Fahrer</div>
            </div>
          </div>

          <div className="space-y-1">
            {sorted.map((f) => (
              <div
                key={f.fahrer_id}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${rowBg(f.ampel)}`}
              >
                <div className="flex items-center gap-1.5">
                  <span>{ampelIcon(f.ampel)}</span>
                  <span className="font-medium">{f.fahrer_name}</span>
                  <span className="text-gray-400 dark:text-gray-500">
                    ({f.pausen_anzahl} Pausen)
                  </span>
                </div>
                <div className={`font-medium ${rowText(f.ampel)}`}>
                  {formatMin(f.letzte_pause_vor_min)}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 rounded px-2 py-1">
            {dispatcherTipp(data.alert_count)}
          </p>
        </div>
      )}
    </div>
  );
}
