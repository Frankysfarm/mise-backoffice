'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Flame, TrendingUp } from 'lucide-react';

interface BestellungEntry {
  order_id: string;
  order_num: string;
  items_kurz: string;
  prep_start_ts: number | null;
  target_ready_ts: number;
  driver_eta_ts: number | null;
  status: string; // 'zubereitung' | 'fertig' | 'wartend'
}

interface ApiData {
  bestellungen: BestellungEntry[];
  on_time_rate_pct: number;
  ueberfallig_count: number;
  kochstart_empfehlung: { order_id: string; in_sekunden: number } | null;
}

const WARN_SECS = 120; // gelb unter 2 min
const CRIT_SECS = 0;   // rot ab 0 (überfällig)

const MOCK: ApiData = {
  bestellungen: [
    { order_id: 'o1', order_num: '#1042', items_kurz: 'Pizza Margherita, Salat',      prep_start_ts: Date.now() / 1000 - 480, target_ready_ts: Date.now() / 1000 + 60,  driver_eta_ts: Date.now() / 1000 + 90,  status: 'zubereitung' },
    { order_id: 'o2', order_num: '#1043', items_kurz: 'Döner × 2, Pommes',            prep_start_ts: Date.now() / 1000 - 300, target_ready_ts: Date.now() / 1000 + 210, driver_eta_ts: Date.now() / 1000 + 240, status: 'zubereitung' },
    { order_id: 'o3', order_num: '#1044', items_kurz: 'Burger Klassik',               prep_start_ts: Date.now() / 1000 - 90,  target_ready_ts: Date.now() / 1000 - 30,  driver_eta_ts: Date.now() / 1000 + 20,  status: 'zubereitung' },
    { order_id: 'o4', order_num: '#1045', items_kurz: 'Wraps × 3, Soße',             prep_start_ts: null,                    target_ready_ts: Date.now() / 1000 + 420, driver_eta_ts: Date.now() / 1000 + 450, status: 'wartend'     },
    { order_id: 'o5', order_num: '#1046', items_kurz: 'Pasta Arrabiata, Tiramisu',   prep_start_ts: Date.now() / 1000 - 600, target_ready_ts: Date.now() / 1000 - 120, driver_eta_ts: null,                    status: 'fertig'      },
  ],
  on_time_rate_pct: 82,
  ueberfallig_count: 2,
  kochstart_empfehlung: { order_id: 'o4', in_sekunden: 45 },
};

function fmtCd(secs: number): string {
  const abs = Math.abs(Math.round(secs));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${secs < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

function colorFor(remainSecs: number): { ring: string; bar: string; badge: string; label: string } {
  if (remainSecs < CRIT_SECS)  return { ring: 'text-red-600',   bar: 'bg-red-500',   badge: 'bg-red-100 text-red-700',   label: 'Überfällig' };
  if (remainSecs < WARN_SECS)  return { ring: 'text-amber-500', bar: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700', label: 'Dringend'  };
  return                               { ring: 'text-green-600', bar: 'bg-green-500', badge: 'bg-green-50 text-green-700', label: 'Im Plan'   };
}

export function KitchenPhase2816SmartTimingLiveCountdownCockpit({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [now, setNow] = useState(() => Date.now() / 1000);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    const load = () => {
      if (!locationId) { setData(MOCK); return; }
      fetch(`/api/delivery/admin/smart-timing-countdown?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then((d: ApiData | null) => setData(d ?? MOCK))
        .catch(() => setData(MOCK));
    };
    load();
    const iv = setInterval(load, 25_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  const active = data.bestellungen.filter(b => b.status !== 'fertig');
  const sorted = [...active].sort((a, b) => a.target_ready_ts - b.target_ready_ts);
  const hasAlert = data.ueberfallig_count > 0;

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-emerald-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-emerald-600" />
          <span className="font-semibold text-xs text-gray-800">Smart-Timing Live-Countdown</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${hasAlert ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
            On-Time {data.on_time_rate_pct}%
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {/* Kochstart-Empfehlung */}
          {data.kochstart_empfehlung && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Flame size={13} className="text-amber-500 flex-shrink-0" />
              <span className="text-[11px] text-amber-800 font-medium">
                Jetzt kochen starten für {data.bestellungen.find(b => b.order_id === data.kochstart_empfehlung?.order_id)?.order_num} — Fahrer in {Math.round((data.kochstart_empfehlung.in_sekunden) / 60)} Min.
              </span>
            </div>
          )}

          {/* Bestellungsliste mit Countdowns */}
          {sorted.map(b => {
            const remainSecs = b.target_ready_ts - now;
            const col = colorFor(remainSecs);
            const prepSecs = b.prep_start_ts ? now - b.prep_start_ts : 0;
            const totalSecs = b.target_ready_ts - (b.prep_start_ts ?? now);
            const progress = b.prep_start_ts
              ? Math.min(100, Math.max(0, (prepSecs / totalSecs) * 100))
              : 0;

            return (
              <div key={b.order_id} className={`rounded-lg border px-3 py-2 ${col.badge} border-current/20`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-gray-800">{b.order_num}</span>
                    <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${col.badge}`}>{col.label}</span>
                  </div>
                  <span className={`text-sm font-mono font-bold ${col.ring}`}>{fmtCd(remainSecs)}</span>
                </div>
                <div className="text-[10px] text-gray-500 truncate mb-1.5">{b.items_kurz}</div>
                <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${col.bar}`} style={{ width: `${progress}%` }} />
                </div>
                {b.driver_eta_ts && (
                  <div className="text-[10px] text-gray-400 mt-1">
                    Fahrer ETA: {fmtCd(b.driver_eta_ts - now)} Min.
                  </div>
                )}
              </div>
            );
          })}

          {/* On-Time-Rate */}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
            <TrendingUp size={11} className="text-gray-400" />
            <span className="text-[10px] text-gray-500">
              On-Time-Quote: <strong className={data.on_time_rate_pct >= 85 ? 'text-green-700' : data.on_time_rate_pct >= 70 ? 'text-amber-700' : 'text-red-700'}>{data.on_time_rate_pct}%</strong>
              {data.ueberfallig_count > 0 && (
                <span className="ml-2 text-red-600">— {data.ueberfallig_count} Bestellung{data.ueberfallig_count > 1 ? 'en' : ''} überfällig!</span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
