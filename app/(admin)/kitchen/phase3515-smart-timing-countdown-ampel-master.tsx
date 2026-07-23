'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Clock, AlertTriangle, Zap } from 'lucide-react';

interface BestellungCountdown {
  order_id: string;
  bestellnummer: string;
  fahrer_eta_min: number | null;
  optimaler_kochstart_sec: number | null;
  prep_zeit_sec: number;
  ampel: 'gruen' | 'gelb' | 'orange' | 'rot';
  on_time: boolean;
}

interface ApiResponse {
  bestellungen: BestellungCountdown[];
  on_time_rate: number;
  aktive: number;
  fertig: number;
  kochstart_empfehlung: string | null;
}

const MOCK: ApiResponse = {
  on_time_rate: 83,
  aktive: 5,
  fertig: 3,
  kochstart_empfehlung: 'Bestellung #042 jetzt starten — Fahrer in 8 Min.',
  bestellungen: [
    { order_id: 'a1', bestellnummer: '#041', fahrer_eta_min: 12, optimaler_kochstart_sec: 240, prep_zeit_sec: 600, ampel: 'gruen', on_time: true },
    { order_id: 'a2', bestellnummer: '#042', fahrer_eta_min: 8, optimaler_kochstart_sec: 60, prep_zeit_sec: 480, ampel: 'gelb', on_time: true },
    { order_id: 'a3', bestellnummer: '#043', fahrer_eta_min: 3, optimaler_kochstart_sec: -60, prep_zeit_sec: 360, ampel: 'orange', on_time: false },
    { order_id: 'a4', bestellnummer: '#044', fahrer_eta_min: 1, optimaler_kochstart_sec: -180, prep_zeit_sec: 420, ampel: 'rot', on_time: false },
  ],
};

const AMPEL_RING: Record<string, string> = {
  gruen:  'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
  gelb:   'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
  orange: 'border-orange-400 bg-orange-50 dark:bg-orange-900/20',
  rot:    'border-red-500 bg-red-50 dark:bg-red-900/20',
};
const AMPEL_TEXT: Record<string, string> = {
  gruen:  'text-emerald-700 dark:text-emerald-300',
  gelb:   'text-yellow-700 dark:text-yellow-300',
  orange: 'text-orange-700 dark:text-orange-300',
  rot:    'text-red-700 dark:text-red-300',
};
const AMPEL_BAR: Record<string, string> = {
  gruen:  'bg-emerald-400',
  gelb:   'bg-yellow-400',
  orange: 'bg-orange-400',
  rot:    'bg-red-500',
};

function fmtSec(sec: number | null): string {
  if (sec === null) return '—';
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const prefix = sec < 0 ? '-' : '';
  return `${prefix}${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase3515SmartTimingCountdownAmpelMaster({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/kitchen-smart-timing?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const urgentCount = data.bestellungen.filter(b => b.ampel === 'rot' || b.ampel === 'orange').length;

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm mb-2">
      <button
        className="w-full flex items-center justify-between p-2.5 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-xs">
          <Clock className="w-3.5 h-3.5 text-blue-500" />
          Smart-Timing Countdown — On-Time: {data.on_time_rate}%
          {urgentCount > 0 && (
            <span className="px-1 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
              {urgentCount}⚠
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 space-y-2">
          {/* KPI-Strip */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-1.5">
              <div className="text-[10px] text-gray-400 uppercase">Aktiv</div>
              <div className="text-sm font-bold">{data.aktive}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-1.5">
              <div className="text-[10px] text-gray-400 uppercase">Fertig</div>
              <div className="text-sm font-bold text-emerald-600">{data.fertig}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-1.5">
              <div className="text-[10px] text-gray-400 uppercase">On-Time%</div>
              <div className={`text-sm font-bold ${data.on_time_rate >= 80 ? 'text-emerald-600' : data.on_time_rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {data.on_time_rate}%
              </div>
            </div>
          </div>

          {/* Kochstart-Empfehlung */}
          {data.kochstart_empfehlung && (
            <div className="flex items-center gap-1.5 text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded px-2 py-1">
              <Zap className="w-3 h-3 flex-shrink-0" />
              {data.kochstart_empfehlung}
            </div>
          )}

          {/* Bestellungen */}
          {data.bestellungen.map(b => {
            const secLeft = b.optimaler_kochstart_sec !== null ? b.optimaler_kochstart_sec - tick : null;
            const prepPct = b.prep_zeit_sec > 0 ? Math.min(100, Math.max(0, (1 - (b.optimaler_kochstart_sec ?? 0) / b.prep_zeit_sec) * 100)) : 50;
            return (
              <div key={b.order_id} className={`border-2 rounded-lg px-2 py-1.5 ${AMPEL_RING[b.ampel]}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs">{b.bestellnummer}</span>
                  <span className={`font-mono text-base font-bold tabular-nums ${AMPEL_TEXT[b.ampel]}`}>
                    {fmtSec(secLeft)}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Fahrer: {b.fahrer_eta_min !== null ? `${b.fahrer_eta_min} Min` : '—'}
                  </span>
                </div>
                <div className="mt-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${AMPEL_BAR[b.ampel]}`}
                    style={{ width: `${prepPct}%` }}
                  />
                </div>
              </div>
            );
          })}

          {/* Alert-Strip */}
          {urgentCount > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded px-2 py-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              {urgentCount} Bestellung(en) überfällig — sofort starten!
            </div>
          )}

          {/* Legende */}
          <div className="flex gap-2 text-[9px] text-gray-400 flex-wrap">
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Grün: &gt;5 Min</span>
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Gelb: 2–5 Min</span>
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Orange: 0–2 Min</span>
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Rot: Überfällig</span>
          </div>
        </div>
      )}
    </div>
  );
}
