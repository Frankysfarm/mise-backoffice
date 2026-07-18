'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';

type FahrerLieferfenster = {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  lieferungen_heute: number;
  im_fenster_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
};

type ApiData = {
  fahrer: FahrerLieferfenster[];
  team_quote: number;
};

function calcColor(quote: number): string {
  if (quote >= 95) return 'text-green-600 dark:text-green-400';
  if (quote >= 80) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function calcTipp(quote: number, trend: FahrerLieferfenster['trend']): string {
  if (quote >= 95 && trend === 'steigend') return 'Ausgezeichnet! Fast alle Lieferungen pünktlich im Fenster — weiter so!';
  if (quote >= 95) return 'Top-Performance! Du hältst das Lieferversprechen zuverlässig.';
  if (quote >= 80 && trend === 'fallend') return 'Quote sinkt — auf kürzere Routen und Küchen-Timing achten.';
  if (quote >= 80) return 'Gute Quote — noch etwas Luft nach oben bis zur Top-Marke.';
  return 'Quote unter 80% — Küchen-Abholzeit und Routenwahl prüfen.';
}

function trendLabel(t: FahrerLieferfenster['trend']): string {
  if (t === 'steigend') return '↑ Verbessert';
  if (t === 'fallend') return '↓ Gesunken';
  return '→ Stabil';
}

export function FahrerPhase2276MeinLieferfenster({
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
      const res = await fetch(`/api/delivery/admin/fahrer-lieferfenster?location_id=${locationId}`);
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
    <div className="rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-500" />
          <span className="font-semibold text-cyan-900 dark:text-cyan-200 text-sm">
            Mein Lieferfenster
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-cyan-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-cyan-400" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="text-center">
            <div className={`text-3xl font-bold ${color}`}>{ich.quote_pct.toFixed(1)}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {ich.im_fenster_heute} von {ich.lieferungen_heute} Lieferungen pünktlich heute
            </div>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${barWidth}%`,
                backgroundColor:
                  ich.quote_pct >= 95 ? '#22c55e' : ich.quote_pct >= 80 ? '#eab308' : '#ef4444',
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-cyan-100 dark:border-cyan-900 p-2">
              <div className="font-bold text-cyan-700 dark:text-cyan-300">{trendLabel(ich.trend)}</div>
              <div className="text-gray-500 dark:text-gray-400">Trend</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-cyan-100 dark:border-cyan-900 p-2">
              <div className="font-bold text-cyan-700 dark:text-cyan-300">
                {ich.trend_delta > 0 ? '+' : ''}{ich.trend_delta.toFixed(1)}%
              </div>
              <div className="text-gray-500 dark:text-gray-400">Δ Vorwoche</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-cyan-100 dark:border-cyan-900 p-2">
              <div className="font-bold text-cyan-700 dark:text-cyan-300">
                {data.team_quote.toFixed(1)}%
              </div>
              <div className="text-gray-500 dark:text-gray-400">Team-Ø</div>
            </div>
          </div>

          <p className="text-xs text-cyan-700 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-900/30 rounded px-2 py-1.5">
            {tipp}
          </p>
        </div>
      )}
    </div>
  );
}
