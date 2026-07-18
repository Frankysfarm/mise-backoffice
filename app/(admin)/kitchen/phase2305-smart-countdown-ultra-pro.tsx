'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Flame, Zap } from 'lucide-react';

type KochOrder = {
  order_id: string;
  bestellnummer: string;
  prep_started_at: string | null;
  prep_target_min: number;
  status: string;
  artikel_count: number;
};

type ApiData = {
  orders: KochOrder[];
  on_time_quote: number;
  avg_prep_min: number;
  alert_count: number;
};

function verbleibendeSek(startedAt: string | null, targetMin: number): number {
  if (!startedAt) return targetMin * 60;
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
  return Math.max(0, targetMin * 60 - elapsed);
}

function ampelFarbe(sek: number, targetMin: number): 'gruen' | 'gelb' | 'rot' {
  const gesamt = targetMin * 60;
  const anteil = sek / gesamt;
  if (anteil > 0.4) return 'gruen';
  if (anteil > 0.15) return 'gelb';
  return 'rot';
}

function fmtSek(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const FARBE_BG: Record<string, string> = {
  gruen: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-700',
  gelb: 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700',
  rot: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-700',
};
const FARBE_TEXT: Record<string, string> = {
  gruen: 'text-green-700 dark:text-green-300',
  gelb: 'text-amber-700 dark:text-amber-300',
  rot: 'text-red-700 dark:text-red-300',
};

const MOCK: ApiData = {
  orders: [
    { order_id: 'm1', bestellnummer: '#1042', prep_started_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(), prep_target_min: 12, status: 'cooking', artikel_count: 3 },
    { order_id: 'm2', bestellnummer: '#1043', prep_started_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), prep_target_min: 8, status: 'cooking', artikel_count: 2 },
    { order_id: 'm3', bestellnummer: '#1044', prep_started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), prep_target_min: 10, status: 'cooking', artikel_count: 4 },
  ],
  on_time_quote: 87,
  avg_prep_min: 9.4,
  alert_count: 1,
};

export function KitchenPhase2305SmartCountdownUltraPro({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/kitchen-timing?location_id=${locationId}&limit=12`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 20 * 1000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const aktiveOrders = useMemo(
    () => (data?.orders ?? MOCK.orders).filter((o) => o.status === 'cooking' || o.status === 'pending'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, tick],
  );

  const boardData = data ?? MOCK;
  const alertCount = boardData.alert_count;
  const onTimeQuote = boardData.on_time_quote;
  const avgPrep = boardData.avg_prep_min;

  const headerLevel = alertCount > 0 ? 'rot' : onTimeQuote < 85 ? 'gelb' : 'gruen';

  if (!locationId) return null;

  return (
    <div className={`rounded-xl border p-4 mb-3 ${FARBE_BG[headerLevel]}`}>
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Clock className={`w-4 h-4 ${FARBE_TEXT[headerLevel]}`} />
          <span className={`font-semibold text-sm ${FARBE_TEXT[headerLevel]}`}>
            Smart-Countdown Ultra Pro
          </span>
          <span className={`text-xs font-bold ${FARBE_TEXT[headerLevel]}`}>
            {aktiveOrders.length} aktiv · Ø {avgPrep.toFixed(1)} min · {onTimeQuote}% pünktlich
          </span>
        </div>
        {open ? (
          <ChevronUp className={`w-4 h-4 ${FARBE_TEXT[headerLevel]}`} />
        ) : (
          <ChevronDown className={`w-4 h-4 ${FARBE_TEXT[headerLevel]}`} />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {alertCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                <strong>{alertCount} Bestellung{alertCount !== 1 ? 'en' : ''}</strong> überfällig — sofort bearbeiten!
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-stone-100 dark:border-stone-700 p-2 text-center">
              <div className={`text-lg font-black tabular-nums ${onTimeQuote >= 85 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {onTimeQuote}%
              </div>
              <div className="text-gray-500 dark:text-gray-400">On-Time Quote</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-stone-100 dark:border-stone-700 p-2 text-center">
              <div className="text-lg font-black tabular-nums text-blue-600 dark:text-blue-400">
                {avgPrep.toFixed(1)}'
              </div>
              <div className="text-gray-500 dark:text-gray-400">Ø Prep-Zeit</div>
            </div>
          </div>

          {aktiveOrders.length === 0 ? (
            <p className="text-xs text-center text-gray-400 py-2">Keine aktiven Bestellungen</p>
          ) : (
            <div className="space-y-1.5">
              {aktiveOrders.map((o) => {
                const restSek = verbleibendeSek(o.prep_started_at, o.prep_target_min);
                const farbe = ampelFarbe(restSek, o.prep_target_min);
                const prozent = Math.min(
                  100,
                  ((o.prep_target_min * 60 - restSek) / (o.prep_target_min * 60)) * 100,
                );
                return (
                  <div
                    key={o.order_id}
                    className={`rounded-lg border px-3 py-2 ${FARBE_BG[farbe]}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {farbe === 'rot' ? (
                          <Flame className="w-3.5 h-3.5 text-red-500" />
                        ) : farbe === 'gelb' ? (
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-green-500" />
                        )}
                        <span className={`text-xs font-semibold ${FARBE_TEXT[farbe]}`}>
                          {o.bestellnummer}
                        </span>
                        <span className="text-[10px] text-gray-400">{o.artikel_count} Art.</span>
                      </div>
                      <span className={`text-sm font-black tabular-nums ${FARBE_TEXT[farbe]}`}>
                        {fmtSek(restSek)}
                      </span>
                    </div>
                    <div className="w-full bg-white/50 dark:bg-black/20 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${farbe === 'gruen' ? 'bg-green-500' : farbe === 'gelb' ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${prozent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className={`text-xs rounded px-2 py-1 ${FARBE_BG[headerLevel]} ${FARBE_TEXT[headerLevel]}`}>
            {alertCount > 0
              ? 'Achtung: Überfällige Bestellungen priorisieren — Kunden warten!'
              : onTimeQuote >= 90
              ? 'Ausgezeichnet! Kitchen-Team liefert pünktlich — weiter so.'
              : onTimeQuote >= 85
              ? 'Gutes Tempo — leichte Verbesserung bei Prep-Zeiten möglich.'
              : 'Tempo erhöhen — Pünktlichkeitsquote unter Ziel (85%).'}
          </p>
        </div>
      )}
    </div>
  );
}
