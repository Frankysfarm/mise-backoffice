'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Flame, Zap } from 'lucide-react';

interface Bestellung {
  order_id: string;
  order_number: string;
  customer_name: string;
  ampel: 'gruen' | 'gelb' | 'rot' | 'kritisch';
  seconds_remaining: number;
  kochstart_jetzt: boolean;
  prep_pct: number;
  kategorie: string;
  fahrer_eta_min: number | null;
}

interface ApiData {
  bestellungen: Bestellung[];
  on_time_rate: number;
  kochstart_count: number;
  kritisch_count: number;
}

const MOCK: ApiData = {
  on_time_rate: 81,
  kochstart_count: 2,
  kritisch_count: 1,
  bestellungen: [
    { order_id: 'a1', order_number: '#4001', customer_name: 'Tom H.', ampel: 'gruen', seconds_remaining: 840, kochstart_jetzt: false, prep_pct: 15, kategorie: 'Pizza', fahrer_eta_min: 22 },
    { order_id: 'a2', order_number: '#4002', customer_name: 'Lea S.', ampel: 'gelb', seconds_remaining: 300, kochstart_jetzt: true, prep_pct: 55, kategorie: 'Burger', fahrer_eta_min: 8 },
    { order_id: 'a3', order_number: '#4003', customer_name: 'Kai B.', ampel: 'rot', seconds_remaining: 90, kochstart_jetzt: true, prep_pct: 80, kategorie: 'Pasta', fahrer_eta_min: 4 },
    { order_id: 'a4', order_number: '#4004', customer_name: 'Mia F.', ampel: 'kritisch', seconds_remaining: -120, kochstart_jetzt: false, prep_pct: 100, kategorie: 'Salat', fahrer_eta_min: 1 },
  ],
};

const AMP = {
  gruen:    { card: 'bg-green-950/20 border-green-600/30', bar: 'bg-green-500', time: 'text-green-400', badge: 'bg-green-700' },
  gelb:     { card: 'bg-amber-950/25 border-amber-500/40', bar: 'bg-amber-400', time: 'text-amber-400', badge: 'bg-amber-600' },
  rot:      { card: 'bg-orange-950/30 border-orange-500/50', bar: 'bg-orange-500', time: 'text-orange-400', badge: 'bg-orange-700' },
  kritisch: { card: 'bg-red-950/40 border-red-500/60', bar: 'bg-red-500', time: 'text-red-400 animate-pulse', badge: 'bg-red-700' },
};

function fmtSek(sek: number) {
  if (sek < 0) return `+${Math.abs(Math.floor(sek / 60))}m überfällig`;
  return `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}`;
}

export function KitchenPhase3259SmartKochstartCountdownUltra({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/kitchen/queue?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load(); else setData(MOCK);
    const p = setInterval(load, 15_000);
    return () => clearInterval(p);
  }, [locationId]);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const d = data ?? MOCK;
  const sorted = [...d.bestellungen].sort((a, b) => a.seconds_remaining - b.seconds_remaining);

  return (
    <div className="rounded-xl border border-gray-700 shadow mb-4 overflow-hidden bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400 shrink-0" />
          <span className="text-sm font-bold text-white">Smart-Kochstart Countdown Ultra</span>
          {d.kritisch_count > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
              <AlertTriangle className="h-2.5 w-2.5" />{d.kritisch_count} kritisch
            </span>
          )}
          {d.kochstart_count > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">
              <Zap className="h-2.5 w-2.5" />{d.kochstart_count} jetzt kochen
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 tabular-nums">On-Time <span className={d.on_time_rate >= 80 ? 'text-green-400 font-bold' : 'text-amber-400 font-bold'}>{d.on_time_rate}%</span></span>
          {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-700 p-3 space-y-2">
          {sorted.map(b => {
            const s = AMP[b.ampel];
            return (
              <div key={b.order_id} className={`rounded-lg border p-2.5 ${s.card}`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${s.badge}`}>{b.order_number}</span>
                    <span className="text-xs font-semibold text-white truncate">{b.customer_name}</span>
                    <span className="text-[9px] text-gray-500">{b.kategorie}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {b.kochstart_jetzt && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-amber-300 bg-amber-900/50 rounded px-1.5 py-0.5 animate-pulse">
                        <Flame className="h-2.5 w-2.5" />Jetzt!
                      </span>
                    )}
                    {b.fahrer_eta_min !== null && (
                      <span className="flex items-center gap-1 text-[9px] text-blue-400">
                        <Clock className="h-2.5 w-2.5" />{b.fahrer_eta_min}m
                      </span>
                    )}
                    <span className={`font-mono text-sm font-black tabular-nums ${s.time}`}>
                      {fmtSek(b.seconds_remaining)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${s.bar}`} style={{ width: `${b.prep_pct}%` }} />
                  </div>
                  <span className="text-[9px] text-gray-500 tabular-nums w-7 text-right">{b.prep_pct}%</span>
                </div>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <p className="py-3 text-center text-sm text-gray-500">Keine aktiven Bestellungen</p>
          )}
          <div className="flex items-center gap-3 rounded-lg bg-gray-800/50 border border-gray-700 px-3 py-2 mt-1">
            <Zap className="h-3 w-3 text-amber-400 shrink-0" />
            <span className="text-[10px] text-gray-400 flex-1">Farbkodierung: </span>
            {(['gruen','gelb','rot','kritisch'] as const).map(a => (
              <span key={a} className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${AMP[a].badge}`}>{a}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
