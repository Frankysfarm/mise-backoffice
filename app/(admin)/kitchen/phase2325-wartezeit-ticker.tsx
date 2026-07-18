'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

type AmpelWartezeit = 'gruen' | 'gelb' | 'rot';

type FahrerWartezeitKompakt = {
  fahrer_id: string;
  fahrer_name: string;
  avg_wartezeit_min: number;
  ampel: AmpelWartezeit;
  alert: boolean;
};

type ApiData = {
  fahrer: FahrerWartezeitKompakt[];
  team_avg_wartezeit_min: number;
  alert_count: number;
};

function ampelEmoji(a: AmpelWartezeit): string {
  if (a === 'gruen') return '🟢';
  if (a === 'gelb') return '🟡';
  return '🔴';
}

function ampelTextColor(a: AmpelWartezeit): string {
  if (a === 'gruen') return 'text-green-700 dark:text-green-300';
  if (a === 'gelb') return 'text-yellow-600 dark:text-yellow-300';
  return 'text-red-600 dark:text-red-400';
}

export function KitchenPhase2325WartezeitTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`);
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

  const hasAlert = useMemo(() => (data?.alert_count ?? 0) > 0, [data]);
  const headerColor = useMemo(() => {
    if (!data) return 'border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30';
    if (data.alert_count > 0) return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30';
    return 'border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30';
  }, [data]);

  if (!locationId || !data) return null;

  return (
    <div className={`rounded-xl border p-4 mb-3 ${headerColor}`}>
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <span className="font-semibold text-cyan-800 dark:text-cyan-200 text-sm">
            Wartezeit-Ticker — Fahrer am Restaurant
          </span>
          {hasAlert && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {data.alert_count} Alert{data.alert_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-cyan-500 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-cyan-500 shrink-0" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {/* Team-Ø */}
          <div className="rounded-lg bg-white dark:bg-gray-800 border border-cyan-100 dark:border-cyan-900 p-2.5 text-center">
            <div className={`text-xl font-extrabold ${data.team_avg_wartezeit_min >= 10 ? 'text-red-600 dark:text-red-400' : data.team_avg_wartezeit_min >= 5 ? 'text-yellow-600 dark:text-yellow-300' : 'text-green-600 dark:text-green-400'}`}>
              {data.team_avg_wartezeit_min} Min
            </div>
            <div className="text-xs text-gray-400">Team-Ø Wartezeit</div>
          </div>

          {/* Alert Banner */}
          {hasAlert && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {data.alert_count} Fahrer warten &gt;10 Min — bitte Bestellungen priorisieren!
              </span>
            </div>
          )}

          {/* Fahrerliste kompakt */}
          <div className="space-y-1">
            {data.fahrer.map((f) => (
              <div
                key={f.fahrer_id}
                className="flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-1.5">
                  <span>{ampelEmoji(f.ampel)}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">{f.fahrer_name}</span>
                </div>
                <span className={`font-bold tabular-nums ${ampelTextColor(f.ampel)}`}>
                  {f.avg_wartezeit_min} Min
                  {f.alert && ' ⚠️'}
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
            Grün &lt;5 Min · Gelb 5–10 Min · Rot ≥10 Min · 15-Min-Update
          </p>
        </div>
      )}
    </div>
  );
}
