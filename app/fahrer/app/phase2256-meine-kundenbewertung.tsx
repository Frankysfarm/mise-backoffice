'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Star } from 'lucide-react';

type FahrerBewertung = {
  fahrer_id: string;
  fahrer_name: string;
  bewertung_avg: number;
  bewertungen_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
};

type ApiData = {
  fahrer: FahrerBewertung[];
  team_durchschnitt: number;
};

function calcColor(avg: number): string {
  if (avg >= 4.5) return 'text-green-600 dark:text-green-400';
  if (avg >= 4.0) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function calcTipp(avg: number, trend: FahrerBewertung['trend']): string {
  if (avg >= 4.5 && trend === 'steigend') return 'Exzellent! Kunden lieben deinen Service — weiter so!';
  if (avg >= 4.5) return 'Top-Bewertung! Du bist einer der besten Fahrer.';
  if (avg >= 4.0 && trend === 'fallend') return 'Bewertung sinkt — auf Freundlichkeit und Pünktlichkeit achten.';
  if (avg >= 4.0) return 'Gute Bewertung — noch etwas Luft nach oben.';
  return 'Bewertung unter 4.0 — Kunden auf freundliche Art ansprechen und Verbesserungen zeigen.';
}

function trendLabel(t: FahrerBewertung['trend']): string {
  if (t === 'steigend') return '↑ Verbessert';
  if (t === 'fallend') return '↓ Gesunken';
  return '→ Stabil';
}

function starGauge(avg: number): string {
  const filled = Math.round(avg);
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

export function FahrerPhase2256MeineKundenbewertung({
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
      const res = await fetch(`/api/delivery/admin/fahrer-kundenbewertung?location_id=${locationId}`);
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

  const color = calcColor(ich.bewertung_avg);
  const tipp = calcTipp(ich.bewertung_avg, ich.trend);
  const barWidth = Math.min(100, Math.max(0, ((ich.bewertung_avg - 1) / 4) * 100));

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
            Meine Kundenbewertung
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="text-center">
            <div className={`text-3xl font-bold ${color}`}>⭐ {ich.bewertung_avg.toFixed(1)}</div>
            <div className="text-lg tracking-widest text-amber-500 mt-0.5">{starGauge(ich.bewertung_avg)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              aus {ich.bewertungen_heute} Bewertungen heute
            </div>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${barWidth}%`,
                backgroundColor:
                  ich.bewertung_avg >= 4.5 ? '#22c55e' : ich.bewertung_avg >= 4.0 ? '#eab308' : '#ef4444',
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900 p-2">
              <div className="font-bold text-amber-700 dark:text-amber-300">{trendLabel(ich.trend)}</div>
              <div className="text-gray-500 dark:text-gray-400">Trend</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900 p-2">
              <div className="font-bold text-amber-700 dark:text-amber-300">
                {ich.trend_delta > 0 ? '+' : ''}{ich.trend_delta.toFixed(1)}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Δ Vorwoche</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900 p-2">
              <div className="font-bold text-amber-700 dark:text-amber-300">⭐ {data.team_durchschnitt.toFixed(1)}</div>
              <div className="text-gray-500 dark:text-gray-400">Team-Ø</div>
            </div>
          </div>

          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 rounded px-2 py-1.5">
            {tipp}
          </p>
        </div>
      )}
    </div>
  );
}
