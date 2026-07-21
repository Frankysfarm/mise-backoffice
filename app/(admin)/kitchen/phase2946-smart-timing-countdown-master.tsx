'use client';
import { useEffect, useRef, useState } from 'react';
import { ChefHat, Clock, Zap, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Phase 2946 — Smart-Timing Countdown Master
 *
 * Sekundengenauer Countdown aller aktiven Bestellungen mit Farbkodierung.
 * Kochstart-Empfehlung basierend auf Fahrer-ETA.
 * Überfälligkeits-Alert + On-Time-Rate + Fortschrittsbalken.
 * 1-Sek-Tick + 15-Sek-Polling.
 */

interface OrderRow {
  id: string;
  bestellnummer?: string | null;
  status: string;
  prep_deadline_at?: string | null;
  prep_started_at?: string | null;
  prep_time_min?: number | null;
  fahrer_eta_min?: number | null;
  artikel?: string | null;
}

interface ApiData {
  orders: OrderRow[];
  on_time_rate: number;
  kochstart_empfehlung: string | null;
}

function makeDeadline(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}

const MOCK: ApiData = {
  orders: [
    { id: '1', bestellnummer: '#2001', status: 'cooking', prep_deadline_at: makeDeadline(1),  prep_time_min: 12, prep_started_at: new Date(Date.now() - 11 * 60_000).toISOString(), fahrer_eta_min: 2,  artikel: 'Pizza Margherita' },
    { id: '2', bestellnummer: '#2002', status: 'cooking', prep_deadline_at: makeDeadline(4),  prep_time_min: 15, prep_started_at: new Date(Date.now() - 11 * 60_000).toISOString(), fahrer_eta_min: 6,  artikel: 'Pasta + Salat' },
    { id: '3', bestellnummer: '#2003', status: 'new',     prep_deadline_at: makeDeadline(10), prep_time_min: 18, prep_started_at: null, fahrer_eta_min: 14, artikel: 'Burger Deluxe' },
    { id: '4', bestellnummer: '#2004', status: 'cooking', prep_deadline_at: makeDeadline(-1), prep_time_min: 10, prep_started_at: new Date(Date.now() - 11 * 60_000).toISOString(), fahrer_eta_min: 1,  artikel: 'Suppe + Brot' },
  ],
  on_time_rate: 84,
  kochstart_empfehlung: '#2003 → jetzt starten (Fahrer in 14 Min)',
};

function getRemainSec(iso: string | null | undefined): number {
  if (!iso) return 9999;
  return Math.max(-999, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
}

function fmtCountdown(sec: number): string {
  if (sec < -60) return `${Math.abs(Math.ceil(sec / 60))} Min überfällig`;
  if (sec < 0)   return `${Math.abs(sec)}s überfällig`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

function color(sec: number) {
  if (sec < 0)   return { bg: 'bg-red-100 dark:bg-red-950/40',   text: 'text-red-700 dark:text-red-400',   bar: 'bg-red-500',   dot: 'bg-red-500 animate-pulse',   border: 'border-red-400'   };
  if (sec < 120) return { bg: 'bg-red-50 dark:bg-red-950/20',    text: 'text-red-600 dark:text-red-400',   bar: 'bg-red-400',   dot: 'bg-red-400 animate-pulse',   border: 'border-red-300'   };
  if (sec < 300) return { bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-400', dot: 'bg-amber-400',               border: 'border-amber-300' };
  return           { bg: 'bg-green-50 dark:bg-green-950/20',  text: 'text-green-700 dark:text-green-400', bar: 'bg-green-500', dot: 'bg-green-500',               border: 'border-green-300' };
}

function pct(order: OrderRow, sec: number): number {
  const total = (order.prep_time_min ?? 15) * 60;
  return Math.min(100, Math.max(0, Math.round(((total - sec) / total) * 100)));
}

const POLL = 15_000;

export function KitchenPhase2946SmartTimingCountdownMaster({ locationId }: { locationId?: string | null }) {
  const [data, setData]   = useState<ApiData | null>(null);
  const [, setTick]       = useState(0);
  const [loading, setLoading] = useState(false);
  const tickRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    fetch(`/api/delivery/kitchen/smart-timing?location_id=${locationId}`)
      .then(r => r.json())
      .then((d: ApiData) => setData(d))
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000);
    pollRef.current = setInterval(load, POLL);
    return () => {
      if (tickRef.current)  clearInterval(tickRef.current);
      if (pollRef.current)  clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-400">
      <RefreshCw size={16} className="animate-spin mx-auto mb-2" />Countdown-Board wird geladen…
    </div>
  );

  const active = data.orders
    .filter(o => !['fertig', 'abgeholt'].includes(o.status))
    .map(o => ({ ...o, sec: getRemainSec(o.prep_deadline_at) }))
    .sort((a, b) => a.sec - b.sec);

  const kritisch = active.filter(o => o.sec < 120).length;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-900 text-white">
        <div className="flex items-center gap-2">
          <ChefHat size={15} />
          <span className="font-semibold text-sm">Countdown Master</span>
          {loading && <RefreshCw size={11} className="animate-spin opacity-60" />}
          {kritisch > 0 && (
            <span className="text-xs bg-red-600 px-1.5 py-0.5 rounded-full animate-pulse">
              {kritisch} kritisch
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="opacity-70">On-Time</span>
          <span className={`font-bold ${data.on_time_rate >= 85 ? 'text-green-400' : data.on_time_rate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
            {data.on_time_rate}%
          </span>
        </div>
      </div>

      {data.kochstart_empfehlung && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
          <Zap size={12} />
          <span><strong>Kochstart:</strong> {data.kochstart_empfehlung}</span>
        </div>
      )}

      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400">
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

      {active.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400">
          <CheckCircle2 size={22} className="text-green-400 mx-auto mb-2" />
          Keine aktiven Bestellungen
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {active.map(o => {
            const c    = color(o.sec);
            const prog = pct(o, o.sec);
            return (
              <div key={o.id} className={`${c.bg} border-l-4 ${c.border}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{o.bestellnummer ?? o.id}</span>
                      <span className="text-xs text-gray-400 capitalize">
                        {o.status === 'cooking' ? 'in Zubereitung' : o.status === 'new' ? 'neu' : o.status}
                      </span>
                      {o.fahrer_eta_min != null && (
                        <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                          <Clock size={10} />Fahrer: {o.fahrer_eta_min} Min
                        </span>
                      )}
                    </div>
                    {o.artikel && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{o.artikel}</p>}
                    <div className="mt-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${c.bar}`} style={{ width: `${prog}%` }} />
                    </div>
                  </div>
                  <div className={`text-right shrink-0 ${c.text}`}>
                    <div className="text-base font-bold font-mono tabular-nums">{fmtCountdown(o.sec)}</div>
                    <div className="text-xs text-gray-400">{prog}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {kritisch > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/20 border-t border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle size={12} />
          <span>{kritisch} Bestellung{kritisch !== 1 ? 'en' : ''} in kritischer Phase — sofort handeln!</span>
        </div>
      )}
    </div>
  );
}
