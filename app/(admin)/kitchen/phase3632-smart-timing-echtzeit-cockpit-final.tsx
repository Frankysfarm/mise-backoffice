'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, AlertTriangle, CheckCircle, Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface OrderCountdown {
  order_id: string;
  bestellnummer: string;
  sek_verbleibend: number;
  prep_ziel_sek: number;
  status: string;
  ampel: 'gruen' | 'gelb' | 'orange' | 'rot';
  ueberfaellig: boolean;
}

interface ApiResponse {
  orders: OrderCountdown[];
  on_time_rate: number;
  kochstart_score: number;
  ueberfaellig_count: number;
}

const MOCK: ApiResponse = {
  orders: [
    { order_id: '1', bestellnummer: '#001', sek_verbleibend: 420, prep_ziel_sek: 600, status: 'in_zubereitung', ampel: 'gruen', ueberfaellig: false },
    { order_id: '2', bestellnummer: '#002', sek_verbleibend: 90, prep_ziel_sek: 600, status: 'in_zubereitung', ampel: 'orange', ueberfaellig: false },
    { order_id: '3', bestellnummer: '#003', sek_verbleibend: -60, prep_ziel_sek: 600, status: 'in_zubereitung', ampel: 'rot', ueberfaellig: true },
  ],
  on_time_rate: 78,
  kochstart_score: 82,
  ueberfaellig_count: 1,
};

const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 border-emerald-200',
  gelb: 'bg-yellow-50 border-yellow-200',
  orange: 'bg-orange-50 border-orange-200',
  rot: 'bg-red-50 border-red-200',
};

const AMPEL_TEXT: Record<string, string> = {
  gruen: 'text-emerald-700',
  gelb: 'text-yellow-700',
  orange: 'text-orange-700',
  rot: 'text-red-700',
};

function fmtSek(sek: number) {
  const abs = Math.abs(sek);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sek < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase3632SmartTimingEchtzeitCockpitFinal({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/kitchen-timing-cockpit?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); if (d?.orders) setData(d); }
    } catch {}
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  const orders = data.orders.map(o => ({ ...o, sek_verbleibend: o.sek_verbleibend - tick }));

  return (
    <div className="border rounded-xl bg-white shadow-sm mb-3">
      <button className="w-full flex items-center justify-between p-3 text-left" onClick={() => setOpen(o => !o)}>
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Clock className="w-4 h-4 text-violet-600" />
          Smart-Timing Echtzeit Cockpit
          {data.ueberfaellig_count > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-bold">{data.ueberfaellig_count} ⚠</span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg p-2 bg-violet-50 border border-violet-200">
              <div className={`text-2xl font-black ${data.kochstart_score >= 85 ? 'text-emerald-600' : data.kochstart_score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                {data.kochstart_score}
              </div>
              <div className="text-gray-500">Kochstart-Score</div>
            </div>
            <div className="rounded-lg p-2 bg-blue-50 border border-blue-200">
              <div className={`text-2xl font-black ${data.on_time_rate >= 90 ? 'text-emerald-600' : data.on_time_rate >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                {data.on_time_rate}%
              </div>
              <div className="text-gray-500">On-Time-Rate</div>
            </div>
            <div className="rounded-lg p-2 bg-red-50 border border-red-200">
              <div className={`text-2xl font-black ${data.ueberfaellig_count === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {data.ueberfaellig_count}
              </div>
              <div className="text-gray-500">Überfällig</div>
            </div>
          </div>

          {data.ueberfaellig_count > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{data.ueberfaellig_count} Bestellung(en) überfällig — sofort fertigstellen!</span>
            </div>
          )}

          <div className="space-y-2">
            {orders.map(o => {
              const fortschritt = Math.max(0, Math.min(100, ((o.prep_ziel_sek - o.sek_verbleibend) / o.prep_ziel_sek) * 100));
              return (
                <div key={o.order_id} className={`rounded-lg border p-2 ${AMPEL_BG[o.ampel]}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-700">{o.bestellnummer}</span>
                    <span className={`text-sm font-black tabular-nums ${AMPEL_TEXT[o.ampel]}`}>
                      {o.ueberfaellig ? '⚠ ' : ''}{fmtSek(o.sek_verbleibend)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${o.ampel === 'gruen' ? 'bg-emerald-500' : o.ampel === 'gelb' ? 'bg-yellow-400' : o.ampel === 'orange' ? 'bg-orange-500' : 'bg-red-500'}`}
                      style={{ width: `${fortschritt}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {orders.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 py-2">
                <CheckCircle className="w-4 h-4" />
                Keine aktiven Bestellungen in Zubereitung
              </div>
            )}
          </div>

          <div className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
            <Zap className="w-3 h-3" />
            Echtzeit-Countdown · 15-Sek-Polling · 4-stufige Farbkodierung
          </div>
        </div>
      )}
    </div>
  );
}
