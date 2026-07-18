'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

type AmpelWartezeit = 'gruen' | 'gelb' | 'rot';
type TrendWartezeit = 'steigend' | 'fallend' | 'stabil';

type FahrerWartezeitHeute = {
  fahrer_id: string;
  fahrer_name: string;
  avg_wartezeit_min: number;
  touren_anzahl: number;
  max_wartezeit_min: number;
  avg_wartezeit_vorwoche: number | null;
  trend: TrendWartezeit;
  trend_delta: number;
  ampel: AmpelWartezeit;
  alert: boolean;
  rang: number;
};

type ApiData = {
  fahrer: FahrerWartezeitHeute[];
  team_avg_wartezeit_min: number;
  alert_count: number;
};

function ampelEmoji(a: AmpelWartezeit): string {
  if (a === 'gruen') return '🟢';
  if (a === 'gelb') return '🟡';
  return '🔴';
}

function ampelRowBg(a: AmpelWartezeit): string {
  if (a === 'gruen') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (a === 'gelb') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function ampelText(a: AmpelWartezeit): string {
  if (a === 'gruen') return 'text-green-700 dark:text-green-300';
  if (a === 'gelb') return 'text-yellow-700 dark:text-yellow-300';
  return 'text-red-700 dark:text-red-300';
}

function trendIcon(t: TrendWartezeit): string {
  if (t === 'steigend') return '↑';
  if (t === 'fallend') return '↓';
  return '→';
}

function podium(rang: number): string {
  if (rang === 1) return '🥇';
  if (rang === 2) return '🥈';
  if (rang === 3) return '🥉';
  return '';
}

function dispatcherTipp(fahrer: FahrerWartezeitHeute[]): string {
  const lange = fahrer.filter((f) => f.alert);
  if (lange.length === 0) return '';
  const namen = lange.map((f) => f.fahrer_name).join(', ');
  return `${namen} warten >10 Min am Restaurant — bitte Küche informieren oder Abholzeitpunkt optimieren!`;
}

export function DispatchPhase2322WartezeitBoard({ locationId }: { locationId: string | null }) {
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

  const alertFahrer = useMemo(() => data?.fahrer.filter((f) => f.alert) ?? [], [data]);
  const hasAlert = alertFahrer.length > 0;
  const tipp = useMemo(() => (data ? dispatcherTipp(data.fahrer) : ''), [data]);

  if (!locationId || !data) return null;

  return (
    <div className="rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <span className="font-semibold text-cyan-800 dark:text-cyan-200 text-sm">
            Wartezeit-Board — Ø Wartezeit am Restaurant je Fahrer
          </span>
          {hasAlert && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {alertFahrer.length} Alert{alertFahrer.length !== 1 ? 's' : ''}
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
        <div className="mt-3 space-y-3">
          {/* Team KPI */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-cyan-100 dark:border-cyan-900 p-2.5 text-center">
              <div className="text-lg font-extrabold text-cyan-700 dark:text-cyan-300">
                {data.team_avg_wartezeit_min} Min
              </div>
              <div className="text-xs text-gray-400">Team-Ø Wartezeit</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-cyan-100 dark:border-cyan-900 p-2.5 text-center">
              <div className="text-lg font-extrabold text-gray-700 dark:text-gray-200">
                {data.fahrer.length}
              </div>
              <div className="text-xs text-gray-400">Fahrer</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-cyan-100 dark:border-cyan-900 p-2.5 text-center">
              <div className={`text-lg font-extrabold ${data.alert_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {data.alert_count}
              </div>
              <div className="text-xs text-gray-400">Alerts (&gt;10 Min)</div>
            </div>
          </div>

          {/* Alert Banner */}
          {hasAlert && tipp && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{tipp}</span>
            </div>
          )}

          {/* Fahrerliste */}
          <div className="space-y-1.5">
            {data.fahrer.map((f) => (
              <div
                key={f.fahrer_id}
                className={`rounded-lg border p-2.5 text-xs ${ampelRowBg(f.ampel)}`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span>{ampelEmoji(f.ampel)}</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-100">
                      {podium(f.rang)} {f.fahrer_name}
                    </span>
                    {f.alert && (
                      <span className="rounded-full bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-1.5 py-0.5 text-[10px] font-bold">
                        ⏱ Lange Wartezeit
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold tabular-nums ${ampelText(f.ampel)}`}>
                      Ø {f.avg_wartezeit_min} Min
                    </span>
                    <span className="text-gray-400">
                      {trendIcon(f.trend)}{f.trend_delta !== 0 ? ` ${f.trend_delta > 0 ? '+' : ''}${f.trend_delta}` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 mt-1 text-gray-500 dark:text-gray-400">
                  <span>{f.touren_anzahl} Touren</span>
                  <span>Max {f.max_wartezeit_min} Min</span>
                  {f.avg_wartezeit_vorwoche !== null && (
                    <span>VW: {f.avg_wartezeit_vorwoche} Min</span>
                  )}
                </div>
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
