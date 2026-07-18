'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';

type FahrerW = {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  touren_heute: number;
  touren_ueber8min: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
};

type ApiData = {
  fahrer: FahrerW[];
  team_avg_min: number;
  alert_count: number;
};

function ampelColor(a: FahrerW['ampel']): string {
  if (a === 'gruen') return 'text-green-600 dark:text-green-400';
  if (a === 'gelb') return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function progressColor(a: FahrerW['ampel']): string {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-400';
  return 'bg-red-500';
}

const COACHING: Record<FahrerW['ampel'], string> = {
  gruen: 'Super — du wartest kaum auf deine Bestellungen! Weiter so.',
  gelb: 'Gelegentlich längere Wartezeiten beim Abholen. Falls möglich: Küche früh informieren.',
  rot: 'Deine Abholwartezeit ist zu hoch. Sprich mit dem Dispatcher oder der Küche.',
};

export function FahrerPhase2266MeineAbholwartezeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!locationId || !isOnline) return;
    setLoading(true);
    fetch(`/api/delivery/admin/fahrer-abholwartezeit?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const myData = useMemo(
    () => (data?.fahrer ?? []).find(f => f.fahrer_id === driverId) ?? null,
    [data, driverId],
  );

  const teamAvg = data?.team_avg_min ?? 0;

  if (!isOnline || !locationId || (!loading && !data)) return null;

  const display = myData ?? (data?.fahrer?.[0] ?? null);
  if (!loading && !display) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Meine Abholwartezeit</span>
          {display && (
            <span className={`rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold ${ampelColor(display.ampel)}`}>
              Ø {display.avg_min} Min
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {loading && <p className="text-xs text-muted-foreground">Lade Wartezeit-Daten…</p>}

          {!loading && display && (
            <>
              {/* Main KPI */}
              <div className="text-center py-2">
                <div className={`text-4xl font-black tabular-nums ${ampelColor(display.ampel)}`}>
                  {display.avg_min} Min
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Ø Abholwartezeit heute</div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
                  <span>0 Min</span>
                  <span>Ziel: ≤4 Min</span>
                  <span>15 Min</span>
                </div>
                <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${progressColor(display.ampel)}`}
                    style={{ width: `${Math.min(100, (display.avg_min / 15) * 100)}%` }}
                  />
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border bg-muted/30 p-2 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Trend</div>
                  <div className={`text-sm font-black ${display.trend === 'steigend' ? 'text-red-500' : display.trend === 'fallend' ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {display.trend === 'steigend' ? '↑' : display.trend === 'fallend' ? '↓' : '→'}{' '}
                    {display.trend_delta > 0 ? '+' : ''}{display.trend_delta}
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-2 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Touren</div>
                  <div className="text-sm font-black tabular-nums text-foreground">{display.touren_heute}</div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-2 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Team-Ø</div>
                  <div className="text-sm font-black tabular-nums text-foreground">{teamAvg} Min</div>
                </div>
              </div>

              {/* Coaching */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2">
                <p className="text-xs text-blue-700 dark:text-blue-300">{COACHING[display.ampel]}</p>
              </div>

              <p className="text-[10px] text-muted-foreground">
                Ampel: 🟢 ≤4 Min · 🟡 ≤8 Min · 🔴 &gt;8 Min. Aktualisierung stündlich.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
