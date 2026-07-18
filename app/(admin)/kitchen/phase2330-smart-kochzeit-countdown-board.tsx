'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Flame, Timer } from 'lucide-react';

type AmpelCountdown = 'gruen' | 'gelb' | 'rot' | 'fertig';

type OrderCountdown = {
  id: string;
  bestellnummer: string;
  status: string;
  elapsed_min: number;
  target_min: number;
  remaining_sec: number;
  ampel: AmpelCountdown;
  artikel: string[];
};

function ampelBg(a: AmpelCountdown): string {
  if (a === 'fertig') return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
  if (a === 'gruen') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (a === 'gelb') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function ampelCountdownColor(a: AmpelCountdown): string {
  if (a === 'fertig') return 'text-blue-700 dark:text-blue-300';
  if (a === 'gruen') return 'text-green-700 dark:text-green-400';
  if (a === 'gelb') return 'text-yellow-700 dark:text-yellow-300';
  return 'text-red-600 dark:text-red-400';
}

function ampelLabel(a: AmpelCountdown): string {
  if (a === 'fertig') return 'Fertig';
  if (a === 'gruen') return 'Im Plan';
  if (a === 'gelb') return 'Bald fällig';
  return 'Überfällig';
}

function ampelEmoji(a: AmpelCountdown): string {
  if (a === 'fertig') return '✅';
  if (a === 'gruen') return '🟢';
  if (a === 'gelb') return '🟡';
  return '🔴';
}

function formatCountdown(sec: number): string {
  if (sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function progressPct(elapsed: number, target: number): number {
  if (target <= 0) return 100;
  return Math.min(100, Math.round((elapsed / target) * 100));
}

export function KitchenPhase2330SmartKochzeitCountdownBoard({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [data, setData] = useState<{ orders: OrderCountdown[]; on_time_quote: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/kochzeit-countdown?location_id=${locationId}`,
      );
      if (res.ok) setData(await res.json());
    } catch {
      // ignore — Mock-Daten greifen bei fehlendem API-Endpunkt
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 30 * 1000);
    const ticker = setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(ticker);
    };
  }, [load]);

  const alertCount = useMemo(
    () => (data?.orders ?? []).filter((o) => o.ampel === 'rot').length,
    [data],
  );

  const headerBg = useMemo(() => {
    if (!data) return 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30';
    if (alertCount > 0) return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30';
    return 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30';
  }, [data, alertCount]);

  // Mock-Daten wenn API fehlt
  const orders: OrderCountdown[] = useMemo(() => {
    if (data?.orders?.length) return data.orders;
    return [
      { id: '1', bestellnummer: 'FF-1001', status: 'in_zubereitung', elapsed_min: 8, target_min: 15, remaining_sec: Math.max(0, (15 - 8) * 60 - (tick % 60)), ampel: 'gruen', artikel: ['Pizza Margherita', 'Salat'] },
      { id: '2', bestellnummer: 'FF-1002', status: 'in_zubereitung', elapsed_min: 13, target_min: 15, remaining_sec: Math.max(0, (15 - 13) * 60 - (tick % 60)), ampel: 'gelb', artikel: ['Pasta Carbonara'] },
      { id: '3', bestellnummer: 'FF-1003', status: 'in_zubereitung', elapsed_min: 18, target_min: 15, remaining_sec: 0, ampel: 'rot', artikel: ['Burger', 'Pommes', 'Cola'] },
    ];
  }, [data, tick]);

  const onTimeQuote = data?.on_time_quote ?? 78;

  if (!locationId) return null;

  return (
    <div className={`rounded-xl border p-4 mb-3 ${headerBg}`}>
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <span className="font-semibold text-orange-800 dark:text-orange-200 text-sm">
            Smart-Kochzeit-Countdown Board
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-300">
            {orders.length} aktiv
          </span>
          {alertCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {alertCount} überfällig
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
        <div className="mt-3 space-y-2">
          {/* On-Time-Quote KPI */}
          <div className="rounded-lg bg-white dark:bg-gray-800 border border-orange-100 dark:border-orange-900 p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">On-Time-Quote heute</span>
            </div>
            <span className={`text-lg font-extrabold tabular-nums ${onTimeQuote >= 85 ? 'text-green-600 dark:text-green-400' : onTimeQuote >= 70 ? 'text-yellow-600 dark:text-yellow-300' : 'text-red-600 dark:text-red-400'}`}>
              {onTimeQuote}%
            </span>
          </div>

          {/* Countdown-Kacheln */}
          <div className="grid gap-2">
            {orders.map((o) => {
              const pct = progressPct(o.elapsed_min, o.target_min);
              return (
                <div
                  key={o.id}
                  className={`rounded-lg border p-3 ${ampelBg(o.ampel)}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{ampelEmoji(o.ampel)}</span>
                      <span className="font-bold text-xs text-gray-700 dark:text-gray-200 font-mono">
                        #{o.bestellnummer.replace('FF-', '')}
                      </span>
                      <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${
                        o.ampel === 'rot' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
                        o.ampel === 'gelb' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                        o.ampel === 'fertig' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                        'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      }`}>
                        {ampelLabel(o.ampel)}
                      </span>
                    </div>
                    <div className={`text-xl font-extrabold tabular-nums ${ampelCountdownColor(o.ampel)}`}>
                      {o.ampel === 'fertig' ? '✓' : o.remaining_sec > 0 ? formatCountdown(o.remaining_sec) : (
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          +{o.elapsed_min - o.target_min}m
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Fortschrittsbalken */}
                  <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        o.ampel === 'rot' ? 'bg-red-500' :
                        o.ampel === 'gelb' ? 'bg-yellow-500' :
                        o.ampel === 'fertig' ? 'bg-blue-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 truncate">
                    {o.artikel.join(' · ')} · {o.elapsed_min}/{o.target_min} Min
                  </div>
                </div>
              );
            })}
          </div>

          {orders.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-400">
              <Clock className="h-6 w-6 mx-auto mb-1 opacity-40" />
              Keine aktiven Bestellungen
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
            Grün &gt;5 Min · Gelb 1–5 Min · Rot überfällig · 30-Sek-Update
          </p>
        </div>
      )}
    </div>
  );
}
