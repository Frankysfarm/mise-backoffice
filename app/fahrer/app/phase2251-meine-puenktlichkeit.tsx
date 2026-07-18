'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';

type FahrerPuenktlichkeit = {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  gesamt_stopps: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
};

type ApiData = {
  fahrer: FahrerPuenktlichkeit[];
  team_durchschnitt: number;
};

function calcColor(pct: number): string {
  if (pct >= 95) return 'text-green-600 dark:text-green-400';
  if (pct >= 85) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function calcTipp(pct: number, trend: FahrerPuenktlichkeit['trend']): string {
  if (pct >= 95 && trend === 'steigend') return 'Exzellent! Top-Pünktlichkeit — weiter so!';
  if (pct >= 95) return 'Sehr pünktlich — du übertriffst das Team-Ziel!';
  if (pct >= 85 && trend === 'fallend') return 'Pünktlichkeit sinkt — früher losfahren helfen!';
  if (pct >= 85) return 'Gute Pünktlichkeit — noch etwas Spielraum nach oben.';
  return 'Pünktlichkeit verbesserungswürdig — Route früher starten.';
}

function trendLabel(t: FahrerPuenktlichkeit['trend']): string {
  if (t === 'steigend') return '↑ Verbessert';
  if (t === 'fallend') return '↓ Gesunken';
  return '→ Stabil';
}

export function FahrerPhase2251MeinePuenktlichkeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId || !driverId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId, driverId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !driverId || !locationId || !data) return null;

  const ich = data.fahrer.find((f) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!ich) return null;

  const color = calcColor(ich.quote_pct);
  const tipp = calcTipp(ich.quote_pct, ich.trend);
  const barWidth = Math.min(100, Math.max(0, ich.quote_pct));

  return (
    <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-500" />
          <span className="font-semibold text-purple-900 dark:text-purple-200 text-sm">
            Meine Pünktlichkeit
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-purple-400" /> : <ChevronDown className="w-4 h-4 text-purple-400" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="text-center">
            <div className={`text-3xl font-bold ${color}`}>{ich.quote_pct.toFixed(1)}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pünktlichkeitsquote heute</div>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${barWidth}%`,
                backgroundColor: ich.quote_pct >= 95 ? '#22c55e' : ich.quote_pct >= 85 ? '#eab308' : '#ef4444',
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-purple-100 dark:border-purple-900 p-2">
              <div className="font-bold text-purple-700 dark:text-purple-300">{trendLabel(ich.trend)}</div>
              <div className="text-gray-500 dark:text-gray-400">Trend</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-purple-100 dark:border-purple-900 p-2">
              <div className="font-bold text-purple-700 dark:text-purple-300">
                {ich.trend_delta > 0 ? '+' : ''}{ich.trend_delta}pp
              </div>
              <div className="text-gray-500 dark:text-gray-400">Δ Vorwoche</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-purple-100 dark:border-purple-900 p-2">
              <div className="font-bold text-purple-700 dark:text-purple-300">{data.team_durchschnitt.toFixed(1)}%</div>
              <div className="text-gray-500 dark:text-gray-400">Team-Ø</div>
            </div>
          </div>

          <p className="text-xs text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 rounded px-2 py-1.5">
            {tipp}
          </p>
        </div>
      )}
    </div>
  );
}
