'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Flame, Timer, Zap } from 'lucide-react';

interface OrderCountdown {
  order_id: string;
  bestellnummer: string;
  artikel: string;
  zubereitungs_ziel_sek: number;
  vergangene_sek: number;
  status: 'kochend' | 'bereit' | 'warten';
  fahrer_eta_min: number | null;
}

interface ApiData {
  countdowns: OrderCountdown[];
  on_time_pct: number;
  kritisch_count: number;
  hochlast: boolean;
  empfehlung: string | null;
}

const MOCK: ApiData = {
  on_time_pct: 74,
  kritisch_count: 2,
  hochlast: true,
  empfehlung: 'Pizza-Station: 2 Bestellungen überfällig — Priorität erhöhen!',
  countdowns: [
    { order_id: 'o1', bestellnummer: '#1042', artikel: 'Margherita + Fries', zubereitungs_ziel_sek: 900, vergangene_sek: 720, status: 'kochend', fahrer_eta_min: 4 },
    { order_id: 'o2', bestellnummer: '#1043', artikel: 'Burger Deluxe', zubereitungs_ziel_sek: 720, vergangene_sek: 800, status: 'kochend', fahrer_eta_min: 2 },
    { order_id: 'o3', bestellnummer: '#1044', artikel: 'Pasta Bolognese', zubereitungs_ziel_sek: 600, vergangene_sek: 210, status: 'kochend', fahrer_eta_min: 8 },
    { order_id: 'o4', bestellnummer: '#1045', artikel: 'Salat Caesar', zubereitungs_ziel_sek: 480, vergangene_sek: 480, status: 'bereit', fahrer_eta_min: 1 },
    { order_id: 'o5', bestellnummer: '#1046', artikel: 'Pizza Salami', zubereitungs_ziel_sek: 900, vergangene_sek: 960, status: 'kochend', fahrer_eta_min: null },
  ],
};

function farbkodierung(vergangen: number, ziel: number): {
  bg: string; border: string; text: string; label: string; pulse: boolean;
} {
  const pct = vergangen / ziel;
  if (pct < 0.7) return { bg: 'bg-green-900/40', border: 'border-green-500/60', text: 'text-green-300', label: 'Gut', pulse: false };
  if (pct < 0.9) return { bg: 'bg-amber-900/40', border: 'border-amber-500/60', text: 'text-amber-300', label: 'Warnung', pulse: false };
  if (pct < 1.0) return { bg: 'bg-orange-900/40', border: 'border-orange-500/60', text: 'text-orange-300', label: 'Dringend', pulse: true };
  return { bg: 'bg-red-900/40', border: 'border-red-500/60', text: 'text-red-300 animate-pulse', label: 'Überfällig', pulse: true };
}

function sekundenZuZeit(sek: number): string {
  const abs = Math.abs(sek);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const prefix = sek < 0 ? '-' : '';
  return `${prefix}${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase3320SmartCountdownFarbkodierungMaster({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/kitchen/active-orders?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load(); else setData(MOCK);
    const poll = setInterval(load, 15_000);
    timerRef.current = setInterval(() => setTick(t => t + 1), 1_000);
    return () => { clearInterval(poll); if (timerRef.current) clearInterval(timerRef.current); };
  }, [locationId]);

  const d = data ?? MOCK;

  return (
    <div className="rounded-xl border border-gray-700 shadow mb-4 overflow-hidden bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Timer className="h-4 w-4 text-purple-400 shrink-0" />
          <span className="text-sm font-bold text-white">Smart-Countdown Farbkodierung</span>
          {d.hochlast && (
            <span className="flex items-center gap-1 rounded-full bg-orange-700 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
              <Flame className="h-2.5 w-2.5" />Hochlast
            </span>
          )}
          {d.kritisch_count > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
              <AlertTriangle className="h-2.5 w-2.5" />{d.kritisch_count} kritisch
            </span>
          )}
          <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300">
            {d.on_time_pct}% On-Time
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-700 p-3 space-y-2">
          {d.empfehlung && (
            <div className="flex items-start gap-2 rounded-lg bg-yellow-950/30 border border-yellow-600/30 px-3 py-2">
              <Zap className="h-3.5 w-3.5 text-yellow-400 mt-0.5 shrink-0" />
              <span className="text-[11px] text-yellow-200">{d.empfehlung}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            {d.countdowns.map(order => {
              const verbleibend = order.zubereitungs_ziel_sek - order.vergangene_sek - tick;
              const farbe = farbkodierung(order.vergangene_sek + tick, order.zubereitungs_ziel_sek);
              const fortschritt = Math.min(100, ((order.vergangene_sek + tick) / order.zubereitungs_ziel_sek) * 100);

              return (
                <div
                  key={order.order_id}
                  className={`rounded-lg border ${farbe.border} ${farbe.bg} px-3 py-2 ${farbe.pulse ? 'animate-pulse' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{order.bestellnummer}</span>
                      <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-semibold ${farbe.text} bg-black/20`}>
                        {farbe.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.fahrer_eta_min !== null && (
                        <span className="text-[10px] text-gray-400">🚴 {order.fahrer_eta_min}min</span>
                      )}
                      <span className={`text-base font-black tabular-nums ${farbe.text}`}>
                        {sekundenZuZeit(verbleibend)}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 mb-1.5 truncate">{order.artikel}</div>
                  <div className="h-1 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        fortschritt >= 100 ? 'bg-red-500' : fortschritt >= 90 ? 'bg-orange-500' : fortschritt >= 70 ? 'bg-amber-400' : 'bg-green-500'
                      }`}
                      style={{ width: `${fortschritt}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[9px] text-gray-600 px-1 pt-1">
            <div className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /><span>1-Sek-Tick + 15-Sek-Polling</span></div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">●</span><span className="text-gray-500">Gut</span>
              <span className="text-amber-500">●</span><span className="text-gray-500">Warn</span>
              <span className="text-orange-500">●</span><span className="text-gray-500">Dringend</span>
              <span className="text-red-500">●</span><span className="text-gray-500">Überfällig</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
