'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Flame, Timer, Zap } from 'lucide-react';

interface OrderEntry {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  status: string;
  created_at?: string;
  geschaetzte_zubereitung_min?: number | null;
}

interface TimingEntry {
  order_id: string;
  cook_start?: string | null;
  estimated_ready?: string | null;
  prep_min?: number | null;
  driver_eta_min?: number | null;
}

interface Props {
  orders?: OrderEntry[];
  timings?: TimingEntry[];
  locationId?: string | null;
}

const PREP_DEFAULT = 15;
const WARN_SEC = 180;
const CRIT_SEC = 0;

function colorClass(remaining: number): { bg: string; text: string; bar: string; ring: string } {
  if (remaining > WARN_SEC)  return { bg: 'bg-green-50 border-green-200',  text: 'text-green-700',  bar: 'bg-green-500',  ring: '#22c55e' };
  if (remaining > CRIT_SEC)  return { bg: 'bg-amber-50 border-amber-200',  text: 'text-amber-700',  bar: 'bg-amber-400',  ring: '#fbbf24' };
  return                            { bg: 'bg-red-50 border-red-200',      text: 'text-red-700',    bar: 'bg-red-500',    ring: '#ef4444' };
}

function fmt(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '-' : ''}${m}:${s.toString().padStart(2, '0')}`;
}

function CountdownRing({ pct, color, size = 48 }: { pct: number; color: string; size?: number }) {
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  );
}

export function KitchenPhase2900SmartTimingScoreCockpitUltimate({ orders = [], timings = [], locationId }: Props) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const now = Date.now();

  const active = orders.filter(o =>
    ['bestätigt', 'in_zubereitung', 'fertig'].includes(o.status)
  );

  const enriched = active.map(o => {
    const timing = timings.find(t => t.order_id === o.id);
    const prepMin = timing?.prep_min ?? o.geschaetzte_zubereitung_min ?? PREP_DEFAULT;
    const startMs = timing?.cook_start
      ? new Date(timing.cook_start).getTime()
      : o.created_at ? new Date(o.created_at).getTime() : now - 5 * 60_000;
    const targetMs = startMs + prepMin * 60_000;
    const remainingSec = Math.round((targetMs - now) / 1000);
    const totalSec = prepMin * 60;
    const elapsedSec = Math.max(0, totalSec - Math.max(0, remainingSec));
    const pct = totalSec > 0 ? Math.min(1, elapsedSec / totalSec) : 1;
    const driverEta = timing?.driver_eta_min ?? null;
    const driverDelta = driverEta !== null ? remainingSec - driverEta * 60 : null;
    return { ...o, remainingSec, pct, prepMin, driverEta, driverDelta };
  });

  const sorted = [...enriched].sort((a, b) => a.remainingSec - b.remainingSec);
  const overdue = enriched.filter(e => e.remainingSec < 0).length;
  const onTime = enriched.filter(e => e.remainingSec >= WARN_SEC).length;
  const onTimeRate = enriched.length > 0 ? Math.round((onTime / enriched.length) * 100) : 100;
  const hasAlert = overdue > 0;

  if (active.length === 0) return null;

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Timer size={14} className="text-indigo-500" />
          <span className="font-semibold text-xs text-gray-800">Smart-Timing Score-Cockpit</span>
          {hasAlert && (
            <span className="flex items-center gap-1 text-[10px] text-red-600 font-medium">
              <AlertTriangle size={10} />{overdue} überfällig
            </span>
          )}
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${onTimeRate >= 80 ? 'bg-green-100 text-green-700' : onTimeRate >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
            {onTimeRate}% pünktlich
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">{active.length} aktiv</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {hasAlert && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-2 flex items-center gap-2 text-xs text-red-700">
              <Flame size={12} />
              <span className="font-medium">{overdue} Bestellung{overdue > 1 ? 'en' : ''} überfällig — sofort handeln!</span>
            </div>
          )}

          {/* KPI Strip */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'Aktiv',     val: active.length,   icon: <Clock size={10} /> },
              { label: 'Überfällig', val: overdue,         icon: <AlertTriangle size={10} /> },
              { label: 'Pünktlich', val: `${onTimeRate}%`, icon: <Zap size={10} /> },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-1.5 text-center">
                <div className="flex items-center justify-center gap-0.5 text-gray-400 mb-0.5">{k.icon}<span className="text-[9px]">{k.label}</span></div>
                <div className="text-sm font-black text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          {/* Order Cards */}
          <div className="space-y-1.5">
            {sorted.map(entry => {
              const { bg, text, bar, ring } = colorClass(entry.remainingSec);
              const pctBar = Math.min(100, entry.pct * 100);
              return (
                <div key={entry.id} className={`rounded-lg border p-2 ${bg}`}>
                  <div className="flex items-start gap-2">
                    <div className="shrink-0">
                      <div className="relative">
                        <CountdownRing pct={1 - entry.pct} color={ring} size={40} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-[9px] font-black ${text}`}>{entry.remainingSec < 0 ? '!' : `${Math.max(0, Math.floor(entry.remainingSec / 60))}'`}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-bold text-gray-800 truncate">{entry.bestellnummer}</span>
                        <span className={`font-mono text-xs font-black ${text}`}>{fmt(entry.remainingSec)}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 truncate mb-1">{entry.kunde_name}</div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${bar}`} style={{ width: `${pctBar}%` }} />
                      </div>
                      {entry.driverDelta !== null && (
                        <div className="mt-0.5 text-[9px] text-gray-400">
                          Fahrer: {entry.driverEta} Min ETA · Δ {entry.driverDelta > 0 ? '+' : ''}{Math.round(entry.driverDelta / 60)} Min
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-3 text-[9px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> &gt;3 Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> 0–3 Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> Überfällig</span>
          </div>
        </div>
      )}
    </div>
  );
}
