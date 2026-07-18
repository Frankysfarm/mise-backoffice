'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Zap } from 'lucide-react';

type FahrerDurchsatz = {
  fahrer_id: string;
  fahrer_name: string;
  bph: number;
  bestellungen_heute: number;
  stunden_aktiv: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
};

type ApiData = {
  fahrer: FahrerDurchsatz[];
  team_avg_bph: number;
  alert_count: number;
};

function ampelLabel(a: 'gruen' | 'gelb' | 'rot'): string {
  if (a === 'gruen') return '🟢';
  if (a === 'gelb') return '🟡';
  return '🔴';
}

function rowBg(a: 'gruen' | 'gelb' | 'rot'): string {
  if (a === 'gruen') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (a === 'gelb') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function rowText(a: 'gruen' | 'gelb' | 'rot'): string {
  if (a === 'gruen') return 'text-green-700 dark:text-green-300';
  if (a === 'gelb') return 'text-yellow-700 dark:text-yellow-300';
  return 'text-red-700 dark:text-red-300';
}

function trendIcon(t: FahrerDurchsatz['trend']): string {
  if (t === 'steigend') return '↑';
  if (t === 'fallend') return '↓';
  return '→';
}

function podiumBadge(rang: number): string {
  if (rang === 1) return '🥇';
  if (rang === 2) return '🥈';
  if (rang === 3) return '🥉';
  return '';
}

export function DispatchPhase2292DurchsatzBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-durchsatz?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const alertFahrer = useMemo(() => data?.fahrer.filter((f) => f.ampel === 'rot') ?? [], [data]);
  const teamLevel = data
    ? data.team_avg_bph >= 4 ? 'gruen' : data.team_avg_bph >= 2 ? 'gelb' : 'rot'
    : 'gelb';
  const hasAlert = alertFahrer.length > 0;

  if (!locationId || !data) return null;

  return (
    <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-sky-500" />
          <span className="font-semibold text-sky-900 dark:text-sky-200 text-sm">
            Durchsatz-Ranking
          </span>
          <span className={`text-xs font-bold ml-1 ${rowText(teamLevel)}`}>
            {ampelLabel(teamLevel)} Team-Ø {data.team_avg_bph.toFixed(1)} B/h
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-sky-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-sky-400" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {hasAlert && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                <strong>{alertFahrer.length} Fahrer</strong> unter 2 B/h — Einsatzplan prüfen.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-sky-100 dark:border-sky-900 p-2 text-center">
              <div className="font-bold text-sky-700 dark:text-sky-300 text-base">
                {data.team_avg_bph.toFixed(1)} B/h
              </div>
              <div className="text-gray-500 dark:text-gray-400">Team-Ø Durchsatz</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-sky-100 dark:border-sky-900 p-2 text-center">
              <div
                className="font-bold text-base"
                style={{ color: hasAlert ? '#ef4444' : '#22c55e' }}
              >
                {data.alert_count}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Alerts (&lt;2 B/h)</div>
            </div>
          </div>

          <div className="space-y-1">
            {data.fahrer.map((f) => (
              <div
                key={f.fahrer_id}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${rowBg(f.ampel)}`}
              >
                <div className="flex items-center gap-1.5">
                  <span>{ampelLabel(f.ampel)}</span>
                  {podiumBadge(f.rang) && <span>{podiumBadge(f.rang)}</span>}
                  <span className="font-medium">{f.fahrer_name}</span>
                  <span className="text-gray-400 dark:text-gray-500">
                    ({f.bestellungen_heute}x / {f.stunden_aktiv.toFixed(1)}h)
                  </span>
                </div>
                <div className={`flex items-center gap-2 font-bold ${rowText(f.ampel)}`}>
                  <span>⚡ {f.bph.toFixed(1)} B/h</span>
                  <span className="text-gray-400 dark:text-gray-500 font-normal">
                    {trendIcon(f.trend)}{f.trend_delta > 0 ? '+' : ''}
                    {f.trend_delta.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {hasAlert && (
            <p className="text-xs text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/30 rounded px-2 py-1">
              Tipp: Fahrer mit roter Ampel auf günstigere Touren setzen oder Pausen prüfen.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
