'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, MapPin } from 'lucide-react';

type AmpelKm = 'gruen' | 'gelb' | 'rot';
type TrendKm = 'steigend' | 'fallend' | 'stabil';

type FahrerKmHeute = {
  fahrer_id: string;
  fahrer_name: string;
  km_gesamt: number;
  touren_anzahl: number;
  km_pro_tour: number;
  kosten_eur: number;
  km_vorwoche: number | null;
  trend: TrendKm;
  trend_delta: number;
  ampel: AmpelKm;
  alert: boolean;
  rang: number;
};

type ApiData = {
  fahrer: FahrerKmHeute[];
  team_avg_km: number;
  alert_count: number;
};

function ampelEmoji(a: AmpelKm): string {
  if (a === 'gruen') return '🟢';
  if (a === 'gelb') return '🟡';
  return '🔴';
}

function ampelRowBg(a: AmpelKm): string {
  if (a === 'gruen') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (a === 'gelb') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function ampelText(a: AmpelKm): string {
  if (a === 'gruen') return 'text-green-700 dark:text-green-300';
  if (a === 'gelb') return 'text-yellow-700 dark:text-yellow-300';
  return 'text-red-700 dark:text-red-300';
}

function trendIcon(t: TrendKm): string {
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

export function DispatchPhase2312KmBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-km-heute?location_id=${locationId}`);
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

  const alertFahrer = useMemo(() => data?.fahrer.filter((f) => f.alert) ?? [], [data]);
  const hasAlert = alertFahrer.length > 0;

  if (!locationId || !data) return null;

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
            KM-Board — Fahrer-Kilometerstand heute
          </span>
          {hasAlert && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {alertFahrer.length} &gt;150 km
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-blue-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-blue-500" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Team KPI */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900 p-3 text-center">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {data.team_avg_km} km
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Team-Ø heute</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900 p-3 text-center">
              <div className="text-2xl font-bold text-gray-700 dark:text-gray-200">
                {data.fahrer.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Fahrer aktiv</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-red-100 dark:border-red-900 p-3 text-center">
              <div
                className={`text-2xl font-bold ${hasAlert ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}
              >
                {data.alert_count}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Alerts &gt;150 km</div>
            </div>
          </div>

          {/* Alert Banner */}
          {hasAlert && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">Kilometerwarnung:</span>{' '}
                {alertFahrer.map((f) => f.fahrer_name).join(', ')} haben heute über 150 km
                gefahren. Bitte Schicht und Fahrzeugreife prüfen.
              </div>
            </div>
          )}

          {/* Fahrerliste */}
          <div className="space-y-1.5">
            {data.fahrer.map((f) => (
              <div
                key={f.fahrer_id}
                className={`rounded-lg border p-2.5 flex items-center gap-3 ${ampelRowBg(f.ampel)}`}
              >
                <span className="text-base w-5 shrink-0">{podium(f.rang)}</span>
                <span className={`text-sm font-medium flex-1 ${ampelText(f.ampel)}`}>
                  {ampelEmoji(f.ampel)} {f.fahrer_name}
                </span>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-bold ${ampelText(f.ampel)}`}>
                    {f.km_gesamt} km
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {f.touren_anzahl} Touren · {f.km_pro_tour} km/Tour
                  </div>
                </div>
                <div className="text-right shrink-0 min-w-[60px]">
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {trendIcon(f.trend)}{' '}
                    {f.trend_delta > 0 ? '+' : ''}{f.trend_delta} km
                  </div>
                  <div className="text-xs text-gray-400">{f.kosten_eur.toFixed(2)} €</div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
            Kosten: km × 0,30 € · Grün &lt;100 km · Gelb &lt;150 km · Rot ≥150 km · 30-Min-Update
          </p>
        </div>
      )}
    </div>
  );
}
