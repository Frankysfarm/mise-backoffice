'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';

type FahrerDurchsatz = {
  fahrer_id: string;
  fahrer_name: string;
  bph: number;
  bestellungen_heute: number;
  stunden_aktiv: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
};

type ApiData = {
  fahrer: FahrerDurchsatz[];
  team_avg_bph: number;
};

function calcColor(bph: number): string {
  if (bph >= 4) return 'text-green-600 dark:text-green-400';
  if (bph >= 2) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function calcTipp(bph: number, trend: FahrerDurchsatz['trend']): string {
  if (bph >= 4 && trend === 'steigend') return 'Exzellent! Du lieferst schneller als je zuvor!';
  if (bph >= 4) return 'Top-Durchsatz! Du bist einer der effizientesten Fahrer.';
  if (bph >= 2 && trend === 'fallend') return 'Durchsatz sinkt — Routen optimieren oder Pausen kürzen.';
  if (bph >= 2) return 'Guter Durchsatz — noch etwas Luft nach oben.';
  return 'Durchsatz unter 2 B/h — mit Dispatcher sprechen für bessere Touren-Zuweisung.';
}

function trendLabel(t: FahrerDurchsatz['trend']): string {
  if (t === 'steigend') return '↑ Verbessert';
  if (t === 'fallend') return '↓ Gesunken';
  return '→ Stabil';
}

export function FahrerPhase2293MeinDurchsatz({
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
      const res = await fetch(
        `/api/delivery/admin/fahrer-durchsatz?location_id=${locationId}`
      );
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

  const color = calcColor(ich.bph);
  const tipp = calcTipp(ich.bph, ich.trend);
  const barWidth = Math.min(100, Math.max(0, (ich.bph / 6) * 100));

  return (
    <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-sky-500" />
          <span className="font-semibold text-sky-900 dark:text-sky-200 text-sm">
            Mein Durchsatz
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-sky-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-sky-400" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="text-center">
            <div className={`text-3xl font-bold ${color}`}>⚡ {ich.bph.toFixed(1)}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Bestellungen pro Stunde
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {ich.bestellungen_heute} Bestellungen in {ich.stunden_aktiv.toFixed(1)}h
            </div>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${barWidth}%`,
                backgroundColor:
                  ich.bph >= 4 ? '#22c55e' : ich.bph >= 2 ? '#eab308' : '#ef4444',
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-sky-100 dark:border-sky-900 p-2">
              <div className="font-bold text-sky-700 dark:text-sky-300">
                {trendLabel(ich.trend)}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Trend</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-sky-100 dark:border-sky-900 p-2">
              <div className="font-bold text-sky-700 dark:text-sky-300">
                {ich.trend_delta > 0 ? '+' : ''}
                {ich.trend_delta.toFixed(1)}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Δ Vorwoche</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-sky-100 dark:border-sky-900 p-2">
              <div className="font-bold text-sky-700 dark:text-sky-300">
                {data.team_avg_bph.toFixed(1)} B/h
              </div>
              <div className="text-gray-500 dark:text-gray-400">Team-Ø</div>
            </div>
          </div>

          <p className="text-xs text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/30 rounded px-2 py-1.5">
            {tipp}
          </p>
        </div>
      )}
    </div>
  );
}
