'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Clock, CheckCircle2, RefreshCw, ChefHat, Zap } from 'lucide-react';

/**
 * Phase 2910 — Smart-Timing Farbkodierungs-Board Final
 *
 * Priorisiertes Kochboard: Alle aktiven Bestellungen nach Dringlichkeit sortiert.
 * Farbkodierung grün/gelb/rot/kritisch je nach verbleibender Prep-Zeit.
 * Sekundengenauer Countdown + Fortschrittsbalken + Kochstart-Empfehlung.
 * 1-Sek-Tick + 20-Sek-Polling.
 */

interface OrderEntry {
  id: string;
  bestellnummer?: string | null;
  prep_deadline_at?: string | null;
  prep_started_at?: string | null;
  prep_time_min?: number | null;
  status: string;
  artikel?: string | null;
  fahrer_eta_min?: number | null;
}

interface ApiData {
  orders: OrderEntry[];
  on_time_rate: number;
  kochstart_empfehlung: string | null;
  letzte_aktualisierung: string;
}

const NOW_MS = () => Date.now();

function makeDeadline(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}

const MOCK: ApiData = {
  orders: [
    { id: '1', bestellnummer: '#1001', prep_deadline_at: makeDeadline(2),  prep_time_min: 12, prep_started_at: new Date(Date.now() - 10 * 60_000).toISOString(), status: 'cooking', artikel: 'Pizza Margherita, Cola', fahrer_eta_min: 3  },
    { id: '2', bestellnummer: '#1002', prep_deadline_at: makeDeadline(6),  prep_time_min: 15, prep_started_at: new Date(Date.now() - 9  * 60_000).toISOString(), status: 'cooking', artikel: 'Pasta Bolognese', fahrer_eta_min: 8  },
    { id: '3', bestellnummer: '#1003', prep_deadline_at: makeDeadline(12), prep_time_min: 18, prep_started_at: null, status: 'new', artikel: 'Burger + Pommes', fahrer_eta_min: 15 },
    { id: '4', bestellnummer: '#1004', prep_deadline_at: makeDeadline(0),  prep_time_min: 10, prep_started_at: new Date(Date.now() - 12 * 60_000).toISOString(), status: 'cooking', artikel: 'Salat + Suppe', fahrer_eta_min: 1  },
  ],
  on_time_rate: 81,
  kochstart_empfehlung: '#1003 → jetzt starten (Fahrer kommt in 15 Min)',
  letzte_aktualisierung: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
};

function getRemainingSec(deadlineIso: string | null | undefined): number {
  if (!deadlineIso) return 9999;
  return Math.max(-999, Math.round((new Date(deadlineIso).getTime() - NOW_MS()) / 1000));
}

function fmtCountdown(sec: number): string {
  if (sec < -60) return `${Math.abs(Math.ceil(sec / 60))} Min überfällig`;
  if (sec < 0)   return `${Math.abs(sec)}s überfällig`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

function colorClass(sec: number): { bg: string; text: string; bar: string; dot: string } {
  if (sec < 0)   return { bg: 'bg-red-100 dark:bg-red-950/40 border-red-400',   text: 'text-red-700 dark:text-red-400',   bar: 'bg-red-500',   dot: 'bg-red-500 animate-pulse' };
  if (sec < 120) return { bg: 'bg-red-50 dark:bg-red-950/20 border-red-300',    text: 'text-red-600 dark:text-red-400',   bar: 'bg-red-400',   dot: 'bg-red-400 animate-pulse' };
  if (sec < 300) return { bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-300', text: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-400', dot: 'bg-amber-400' };
  return           { bg: 'bg-green-50 dark:bg-green-950/20 border-green-300',   text: 'text-green-700 dark:text-green-400', bar: 'bg-green-500', dot: 'bg-green-500' };
}

function progressPct(order: OrderEntry, remainSec: number): number {
  const total = (order.prep_time_min ?? 15) * 60;
  const elapsed = total - remainSec;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

const POLL_MS = 20_000;

export function KitchenPhase2910SmartTimingFarbkodierungsBoardFinal({ locationId }: { locationId?: string | null }) {
  const [data,  setData]  = useState<ApiData | null>(null);
  const [tick,  setTick]  = useState(0);
  const [load,  setLoad]  = useState(false);
  const timer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const poller = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = () => {
    if (!locationId) { setData(MOCK); return; }
    setLoad(true);
    fetch(`/api/delivery/kitchen/smart-timing?location_id=${locationId}`)
      .then(r => r.json())
      .then((d: ApiData) => setData(d))
      .catch(() => setData(MOCK))
      .finally(() => setLoad(false));
  };

  useEffect(() => {
    fetchData();
    timer.current  = setInterval(() => setTick(t => t + 1), 1000);
    poller.current = setInterval(fetchData, POLL_MS);
    return () => {
      if (timer.current)  clearInterval(timer.current);
      if (poller.current) clearInterval(poller.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-400">
      <RefreshCw size={18} className="animate-spin mx-auto mb-2" />Timing-Board wird geladen…
    </div>
  );

  const activeOrders = data.orders
    .filter(o => o.status !== 'fertig' && o.status !== 'abgeholt')
    .map(o => ({ ...o, remainSec: getRemainingSec(o.prep_deadline_at) }))
    .sort((a, b) => a.remainSec - b.remainSec);

  const kritisch = activeOrders.filter(o => o.remainSec < 120).length;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white">
        <div className="flex items-center gap-2">
          <ChefHat size={15} />
          <span className="font-semibold text-sm">Smart-Timing Board</span>
          {load && <RefreshCw size={11} className="animate-spin opacity-70" />}
          {kritisch > 0 && (
            <span className="text-xs bg-red-700 px-1.5 py-0.5 rounded-full animate-pulse">
              {kritisch} kritisch
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="opacity-80">On-Time: <strong>{data.on_time_rate}%</strong></span>
          <span className="opacity-60">{data.letzte_aktualisierung}</span>
        </div>
      </div>

      {/* Kochstart-Empfehlung */}
      {data.kochstart_empfehlung && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
          <Zap size={12} />
          <span><strong>Empfehlung:</strong> {data.kochstart_empfehlung}</span>
        </div>
      )}

      {/* Legende */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500">
        {[
          { dot: 'bg-green-500', label: '>5 Min' },
          { dot: 'bg-amber-400', label: '2–5 Min' },
          { dot: 'bg-red-400 animate-pulse', label: '<2 Min' },
          { dot: 'bg-red-500 animate-pulse', label: 'Überfällig' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${l.dot}`} />
            <span>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Bestellliste */}
      {activeOrders.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400">
          <CheckCircle2 size={24} className="text-green-400 mx-auto mb-2" />
          Keine aktiven Bestellungen
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {activeOrders.map(o => {
            const c   = colorClass(o.remainSec);
            const pct = progressPct(o, o.remainSec);
            return (
              <div key={o.id} className={`border-l-4 ${c.bg.split(' ')[0]} ${c.bg.split(' ').slice(1).join(' ')} border-l-current`}
                style={{ borderLeftColor: o.remainSec < 0 ? '#ef4444' : o.remainSec < 120 ? '#f87171' : o.remainSec < 300 ? '#fbbf24' : '#22c55e' }}>
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{o.bestellnummer ?? o.id}</span>
                      <span className="text-xs text-gray-400 capitalize">
                        {o.status === 'cooking' ? 'in Zubereitung' : o.status === 'new' ? 'neu' : o.status}
                      </span>
                      {o.fahrer_eta_min != null && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          Fahrer: {o.fahrer_eta_min} Min
                        </span>
                      )}
                    </div>
                    {o.artikel && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{o.artikel}</p>
                    )}
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${c.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Countdown */}
                  <div className={`text-right shrink-0 ${c.text}`}>
                    <span className="text-base font-bold font-mono tabular-nums">
                      {fmtCountdown(o.remainSec)}
                    </span>
                    <div className="text-xs text-gray-400 mt-0.5">{pct}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
