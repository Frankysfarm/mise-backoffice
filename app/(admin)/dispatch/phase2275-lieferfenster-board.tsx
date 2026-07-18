'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

type FahrerLieferfenster = {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  lieferungen_heute: number;
  im_fenster_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
};

type ApiData = {
  fahrer: FahrerLieferfenster[];
  team_quote: number;
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

function trendIcon(t: FahrerLieferfenster['trend'], delta: number): string {
  if (t === 'steigend') return `↑ +${delta.toFixed(1)}%`;
  if (t === 'fallend') return `↓ ${delta.toFixed(1)}%`;
  return '→ stabil';
}

function podiumBadge(rang: number): string {
  if (rang === 1) return '🥇';
  if (rang === 2) return '🥈';
  if (rang === 3) return '🥉';
  return '';
}

export function DispatchPhase2275LieferfensterBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-lieferfenster?location_id=${locationId}`);
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
    ? data.team_quote >= 95 ? 'gruen' : data.team_quote >= 80 ? 'gelb' : 'rot'
    : 'gelb';
  const hasAlert = alertFahrer.length > 0;

  if (!locationId || !data) return null;

  return (
    <div className="rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-500" />
          <span className="font-semibold text-cyan-900 dark:text-cyan-200 text-sm">
            Lieferfenster-Board
          </span>
          <span className={`text-xs font-bold ml-1 ${rowText(teamLevel)}`}>
            {ampelLabel(teamLevel)} Team-Ø {data.team_quote.toFixed(1)}%
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-cyan-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-cyan-400" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {hasAlert && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                <strong>{alertFahrer.length} Fahrer</strong> unter 80% Lieferfenster — Dispatcher-Gespräch empfohlen.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-cyan-100 dark:border-cyan-900 p-2 text-center">
              <div className={`font-bold text-base ${rowText(teamLevel)}`}>
                {data.team_quote.toFixed(1)}%
              </div>
              <div className="text-gray-500 dark:text-gray-400">Team-Ø Fenster-Quote</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-cyan-100 dark:border-cyan-900 p-2 text-center">
              <div className="font-bold text-base" style={{ color: hasAlert ? '#ef4444' : '#22c55e' }}>
                {data.alert_count}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Alerts (&lt;80%)</div>
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
                    ({f.im_fenster_heute}/{f.lieferungen_heute})
                  </span>
                </div>
                <div className={`flex items-center gap-2 font-bold ${rowText(f.ampel)}`}>
                  <span>{f.quote_pct.toFixed(1)}%</span>
                  <span className="text-gray-400 dark:text-gray-500 font-normal text-xs">
                    {trendIcon(f.trend, f.trend_delta)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {hasAlert && (
            <p className="text-xs text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/30 rounded px-2 py-1">
              Tipp: Fahrer mit roter Ampel auf optimale Routenplanung und Küchen-Timing ansprechen.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
