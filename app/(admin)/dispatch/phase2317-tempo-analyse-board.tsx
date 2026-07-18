'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Gauge } from 'lucide-react';

type AmpelTempo = 'gruen' | 'gelb' | 'rot';
type TrendTempo = 'steigend' | 'fallend' | 'stabil';
type AlertTyp = 'tempoverdacht' | 'stau' | null;

type FahrerTempoHeute = {
  fahrer_id: string;
  fahrer_name: string;
  avg_kmh: number;
  touren_anzahl: number;
  fahrzeit_min: number;
  km_gesamt: number;
  avg_kmh_vorwoche: number | null;
  trend: TrendTempo;
  trend_delta: number;
  ampel: AmpelTempo;
  alert_typ: AlertTyp;
  alert: boolean;
  rang: number;
};

type ApiData = {
  fahrer: FahrerTempoHeute[];
  team_avg_kmh: number;
  alert_count: number;
};

function ampelEmoji(a: AmpelTempo): string {
  if (a === 'gruen') return '🟢';
  if (a === 'gelb') return '🟡';
  return '🔴';
}

function ampelRowBg(a: AmpelTempo): string {
  if (a === 'gruen') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (a === 'gelb') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function ampelText(a: AmpelTempo): string {
  if (a === 'gruen') return 'text-green-700 dark:text-green-300';
  if (a === 'gelb') return 'text-yellow-700 dark:text-yellow-300';
  return 'text-red-700 dark:text-red-300';
}

function trendIcon(t: TrendTempo): string {
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

function alertLabel(typ: AlertTyp): string {
  if (typ === 'tempoverdacht') return '⚡ Tempoverdacht';
  if (typ === 'stau') return '🚦 Stau-Indikator';
  return '';
}

function dispatcherTipp(fahrer: FahrerTempoHeute[]): string {
  const schnell = fahrer.filter((f) => f.alert_typ === 'tempoverdacht');
  const stau = fahrer.filter((f) => f.alert_typ === 'stau');
  if (schnell.length > 0 && stau.length > 0) {
    return `${schnell.map((f) => f.fahrer_name).join(', ')} fahren zu schnell — Sicherheit prüfen! ${stau.map((f) => f.fahrer_name).join(', ')} im Stau — Tour neu planen?`;
  }
  if (schnell.length > 0) {
    return `${schnell.map((f) => f.fahrer_name).join(', ')} fahren über 60 km/h — bitte Fahrersicherheit prüfen!`;
  }
  if (stau.length > 0) {
    return `${stau.map((f) => f.fahrer_name).join(', ')} sehr langsam (<5 km/h) — alternative Route prüfen?`;
  }
  return '';
}

export function DispatchPhase2317TempoAnalyseBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-tempo-analyse?location_id=${locationId}`);
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
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <span className="font-semibold text-orange-800 dark:text-orange-200 text-sm">
            Tempo-Analyse — Ø km/h je Fahrer heute
          </span>
          {hasAlert && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {alertFahrer.length} Alert{alertFahrer.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-orange-500 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-orange-500 shrink-0" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Team KPI */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-orange-100 dark:border-orange-900 p-2.5 text-center">
              <div className="text-lg font-extrabold text-orange-700 dark:text-orange-300">
                {data.team_avg_kmh}
              </div>
              <div className="text-xs text-gray-400">Team-Ø km/h</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-orange-100 dark:border-orange-900 p-2.5 text-center">
              <div className="text-lg font-extrabold text-gray-700 dark:text-gray-200">
                {data.fahrer.length}
              </div>
              <div className="text-xs text-gray-400">Fahrer aktiv</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-orange-100 dark:border-orange-900 p-2.5 text-center">
              <div className={`text-lg font-extrabold ${data.alert_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {data.alert_count}
              </div>
              <div className="text-xs text-gray-400">Alerts</div>
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
                    {f.alert_typ && (
                      <span className="rounded-full bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-1.5 py-0.5 text-[10px] font-bold">
                        {alertLabel(f.alert_typ)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold tabular-nums ${ampelText(f.ampel)}`}>
                      {f.avg_kmh} km/h
                    </span>
                    <span className="text-gray-400">
                      {trendIcon(f.trend)}{f.trend_delta !== 0 ? ` ${f.trend_delta > 0 ? '+' : ''}${f.trend_delta}` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 mt-1 text-gray-500 dark:text-gray-400">
                  <span>{f.touren_anzahl} Touren</span>
                  <span>{f.km_gesamt} km</span>
                  <span>{f.fahrzeit_min} Min Fahrzeit</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
            Grün 5–50 km/h · Gelb 50–60 · Rot &gt;60 oder &lt;5 · 15-Min-Update
          </p>
        </div>
      )}
    </div>
  );
}
