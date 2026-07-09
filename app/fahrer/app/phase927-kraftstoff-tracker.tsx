'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Fuel, Loader2, TrendingUp } from 'lucide-react';

/**
 * Phase 927 — Kraftstoff-Tracker (Fahrer-App)
 *
 * Tägliches km-Log + geschätzte Kraftstoffkosten je Schicht.
 * Nur sichtbar wenn isOnline=true. 10-Min-Polling.
 */

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface TagLog {
  datum: string;
  km: number;
  liter: number;
  kosten_eur: number;
  touren: number;
}

interface KraftstoffData {
  logs: TagLog[];
  gesamt_km: number;
  gesamt_kosten_eur: number;
  gesamt_touren: number;
  zeitraum_tage: number;
  km_pro_liter: number;
  liter_preis_eur: number;
}

const MOCK: KraftstoffData = {
  logs: [
    { datum: '2026-07-09', km: 87.4, liter: 7.3, kosten_eur: 12.75, touren: 9 },
    { datum: '2026-07-08', km: 72.1, liter: 6.0, kosten_eur: 10.52, touren: 7 },
    { datum: '2026-07-07', km: 91.5, liter: 7.6, kosten_eur: 13.31, touren: 10 },
  ],
  gesamt_km: 251.0,
  gesamt_kosten_eur: 36.58,
  gesamt_touren: 26,
  zeitraum_tage: 7,
  km_pro_liter: 12,
  liter_preis_eur: 1.75,
};

const POLL_MS = 10 * 60 * 1000;

function datumKurz(iso: string) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function FahrerPhase927KraftstoffTracker({ driverId, isOnline }: Props) {
  const [data, setData] = useState<KraftstoffData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!driverId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/driver/kraftstoff-log?driver_id=${driverId}&tage=7`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.logs) setData(json as KraftstoffData);
      else setData(MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!isOnline || !open) return null;

  const heute = data?.logs[0] ?? MOCK.logs[0];
  const gesamt = data ?? MOCK;

  const kpiRow = [
    { label: 'Heute km', value: `${heute.km} km`, color: 'text-blue-700 bg-blue-50' },
    { label: 'Heute Kosten', value: fmtEur(heute.kosten_eur), color: 'text-red-700 bg-red-50' },
    { label: '7-Tage km', value: `${gesamt.gesamt_km} km`, color: 'text-stone-700 bg-stone-50' },
    { label: '7-Tage Kosten', value: fmtEur(gesamt.gesamt_kosten_eur), color: 'text-amber-700 bg-amber-50' },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white/95 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 shrink-0">
            <Fuel className="h-4 w-4 text-blue-700" />
          </div>
          <div>
            <div className="text-sm font-bold text-char">Kraftstoff-Tracker</div>
            <div className="text-xs text-stone-400">
              Letzte {gesamt.zeitraum_tage} Tage · {gesamt.km_pro_liter} km/L · {fmtEur(gesamt.liter_preis_eur)}/L
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-3.5 w-3.5 text-stone-300 animate-spin" />}
          <button
            onClick={() => setOpen(false)}
            className="text-xs text-stone-400 hover:text-stone-700 transition-colors px-1"
          >
            ✕
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-2.5 p-4">
        {kpiRow.map((kpi) => (
          <div key={kpi.label} className={cn('rounded-xl p-3', kpi.color.split(' ')[1])}>
            <div className={cn('text-base font-black tabular-nums', kpi.color.split(' ')[0])}>
              {kpi.value}
            </div>
            <div className="text-[10px] font-semibold text-stone-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tages-Log */}
      {gesamt.logs.length > 1 && (
        <div className="border-t border-stone-100 divide-y divide-stone-50">
          {gesamt.logs.slice(0, 5).map((log) => (
            <div key={log.datum} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <div className="text-xs font-semibold text-char">{datumKurz(log.datum)}</div>
                <div className="text-[11px] text-stone-400">{log.touren} Touren</div>
              </div>
              <div className="flex items-center gap-3 text-xs tabular-nums">
                <span className="text-blue-700 font-semibold">{log.km} km</span>
                <span className="text-stone-400">{log.liter} L</span>
                <span className="text-red-600 font-bold">{fmtEur(log.kosten_eur)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-100 flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 text-stone-400" />
        <span className="text-xs text-stone-500">
          Ø {gesamt.gesamt_touren > 0
            ? Math.round((gesamt.gesamt_km / gesamt.gesamt_touren) * 10) / 10
            : 0} km/Tour · {fmtEur(gesamt.gesamt_kosten_eur / Math.max(1, gesamt.zeitraum_tage))}/Tag Ø
        </span>
      </div>
    </div>
  );
}
