'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Play, Star } from 'lucide-react';

interface OrderRow {
  order_id: string;
  bestellnummer: string;
  kunde_name: string;
  prep_start_at: string | null;
  prep_soll_min: number;
  eta_fahrer: string | null;
  status: string;
}

interface ApiData {
  orders: OrderRow[];
  on_time_rate: number;
}

const MOCK: ApiData = {
  orders: [
    { order_id: 'o1', bestellnummer: '#1042', kunde_name: 'Müller',  prep_start_at: new Date(Date.now() - 8 * 60000).toISOString(),  prep_soll_min: 15, eta_fahrer: new Date(Date.now() + 7 * 60000).toISOString(),  status: 'in_zubereitung' },
    { order_id: 'o2', bestellnummer: '#1043', kunde_name: 'Schmidt', prep_start_at: new Date(Date.now() - 14 * 60000).toISOString(), prep_soll_min: 12, eta_fahrer: new Date(Date.now() + 2 * 60000).toISOString(),  status: 'in_zubereitung' },
    { order_id: 'o3', bestellnummer: '#1044', kunde_name: 'Weber',   prep_start_at: new Date(Date.now() - 18 * 60000).toISOString(), prep_soll_min: 15, eta_fahrer: new Date(Date.now() - 1 * 60000).toISOString(),  status: 'in_zubereitung' },
    { order_id: 'o4', bestellnummer: '#1045', kunde_name: 'Becker',  prep_start_at: null,                                             prep_soll_min: 12, eta_fahrer: new Date(Date.now() + 18 * 60000).toISOString(), status: 'bestätigt' },
  ],
  on_time_rate: 84,
};

function calcCountdown(row: OrderRow, now: number) {
  if (!row.prep_start_at) {
    // Kochstart noch nicht gestartet
    return { verbleibenSek: null, pct: 0, ampel: 'gray' as const, kochstartNow: true };
  }
  const startMs  = new Date(row.prep_start_at).getTime();
  const sollMs   = row.prep_soll_min * 60 * 1000;
  const elapsed  = now - startMs;
  const remaining = sollMs - elapsed;
  const pct      = Math.min(100, Math.max(0, (elapsed / sollMs) * 100));
  const remSek   = Math.round(remaining / 1000);
  const ampel    = remSek > 180 ? 'gruen' : remSek > 0 ? 'gelb' : 'rot';
  return { verbleibenSek: remSek, pct, ampel, kochstartNow: false };
}

function formatSek(sek: number) {
  const abs = Math.abs(sek);
  const m   = Math.floor(abs / 60);
  const s   = abs % 60;
  const sign = sek < 0 ? '-' : '';
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

const AMPEL_STYLE = {
  gruen: { bar: 'bg-green-500',  badge: 'bg-green-100 text-green-800', border: 'border-green-200' },
  gelb:  { bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-800', border: 'border-amber-200' },
  rot:   { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',     border: 'border-red-300'   },
  gray:  { bar: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-600',   border: 'border-gray-200'  },
};

export function KitchenPhase2890SmartTimingCountdownLiveKommando({ locationId }: { locationId?: string | null }) {
  const [data,    setData]    = useState<ApiData | null>(null);
  const [now,     setNow]     = useState(Date.now());
  const [open,    setOpen]    = useState(true);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = () => {
      if (!locationId) { setData(MOCK); return; }
      fetch(`/api/delivery/kitchen/smart-timing-countdown?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    };
    load();
    const poll = setInterval(load, 20 * 1000);
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); if (tickRef.current) clearInterval(tickRef.current); };
  }, [locationId]);

  if (!data) return null;

  const rows = data.orders.map(o => ({ ...o, ...calcCountdown(o, now) }));
  const kritisch = rows.filter(r => r.verbleibenSek !== null && r.verbleibenSek < 0).length;
  const hasAlert = kritisch > 0;

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-blue-600" />
          <span className="text-xs font-bold text-gray-800">Smart-Timing · Countdown Live</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className="text-[10px] text-gray-500">On-Time {data.on_time_rate}%</span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {hasAlert && (
            <div className="rounded-lg border border-red-300 bg-red-100 px-2 py-1 text-[10px] text-red-700">
              <AlertTriangle size={10} className="mr-1 inline" />
              {kritisch} Bestellung{kritisch !== 1 ? 'en' : ''} überfällig!
            </div>
          )}

          {rows.map(row => {
            const st = AMPEL_STYLE[row.ampel as keyof typeof AMPEL_STYLE];
            return (
              <div key={row.order_id} className={`rounded-lg border ${st.border} p-2 bg-white`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-800">
                    {row.bestellnummer} · {row.kunde_name}
                  </span>
                  {row.kochstartNow ? (
                    <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                      <Play size={8} /> Jetzt starten!
                    </span>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${st.badge}`}>
                      {row.verbleibenSek !== null ? formatSek(row.verbleibenSek) : '—'}
                    </span>
                  )}
                </div>
                {!row.kochstartNow && (
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full ${st.bar} transition-all`} style={{ width: `${row.pct}%` }} />
                  </div>
                )}
                {row.eta_fahrer && (
                  <div className="mt-0.5 text-[9px] text-gray-400">
                    Fahrer-ETA: {new Date(row.eta_fahrer).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex items-center gap-1 text-[9px] text-gray-400">
            <span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> &gt;3 Min
            <span className="ml-1 h-2 w-2 rounded-full bg-amber-400 inline-block" /> 0–3 Min
            <span className="ml-1 h-2 w-2 rounded-full bg-red-500 inline-block" /> Überfällig
            <Star size={8} className="ml-auto text-gray-300" />
          </div>
        </div>
      )}
    </div>
  );
}
