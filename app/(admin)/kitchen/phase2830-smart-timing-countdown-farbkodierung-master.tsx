'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Flame, Zap } from 'lucide-react';

interface Bestellung {
  order_id: string;
  order_num: string;
  items_kurz: string;
  prep_start_ts: number | null;
  target_ready_ts: number;
  driver_eta_ts: number | null;
  status: string;
  priority_score: number;
}

interface ApiData {
  bestellungen: Bestellung[];
  on_time_rate_pct: number;
  ueberfallig_count: number;
  kochstart_empfehlung: { order_id: string; in_sekunden: number } | null;
  batch_alert: boolean;
  sla_balance_pct: number;
}

const WARN_SECS = 120;
const CRIT_SECS = 0;

const MOCK: ApiData = {
  bestellungen: [
    { order_id: 'o1', order_num: '#1051', items_kurz: 'Pizza Diavola × 2', prep_start_ts: Date.now() / 1000 - 540, target_ready_ts: Date.now() / 1000 + 45, driver_eta_ts: Date.now() / 1000 + 80, status: 'zubereitung', priority_score: 95 },
    { order_id: 'o2', order_num: '#1052', items_kurz: 'Döner, Pommes, Cola', prep_start_ts: Date.now() / 1000 - 360, target_ready_ts: Date.now() / 1000 + 180, driver_eta_ts: Date.now() / 1000 + 200, status: 'zubereitung', priority_score: 72 },
    { order_id: 'o3', order_num: '#1053', items_kurz: 'Burger Klassik, Salat', prep_start_ts: Date.now() / 1000 - 120, target_ready_ts: Date.now() / 1000 - 30, driver_eta_ts: Date.now() / 1000 + 10, status: 'zubereitung', priority_score: 100 },
    { order_id: 'o4', order_num: '#1054', items_kurz: 'Wrap × 3, Soße', prep_start_ts: null, target_ready_ts: Date.now() / 1000 + 420, driver_eta_ts: Date.now() / 1000 + 450, status: 'wartend', priority_score: 45 },
  ],
  on_time_rate_pct: 79,
  ueberfallig_count: 1,
  kochstart_empfehlung: { order_id: 'o4', in_sekunden: 30 },
  batch_alert: false,
  sla_balance_pct: 84,
};

function fmtCd(secs: number): string {
  const abs = Math.abs(Math.round(secs));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${secs < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

function colorFor(remainSecs: number) {
  if (remainSecs < CRIT_SECS) return { ring: 'text-red-600', bar: 'bg-red-500', badge: 'bg-red-100 text-red-700', border: 'border-red-300', label: 'Überfällig' };
  if (remainSecs < WARN_SECS) return { ring: 'text-amber-500', bar: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700', border: 'border-amber-300', label: 'Dringend' };
  return { ring: 'text-green-600', bar: 'bg-green-500', badge: 'bg-green-50 text-green-700', border: 'border-green-200', label: 'Im Plan' };
}

export function KitchenPhase2830SmartTimingCountdownFarbkodierungMaster({ locationId }: { locationId?: string | null }) {
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
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  const active = data.bestellungen
    .filter(b => b.status !== 'fertig')
    .sort((a, b) => a.target_ready_ts - b.target_ready_ts);

  const hasAlert = data.ueberfallig_count > 0;
  const onTimeColor = data.on_time_rate_pct >= 90 ? 'text-green-600' : data.on_time_rate_pct >= 75 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50/60' : 'border-emerald-200 bg-white'}`}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <Clock size={14} className="text-emerald-600 shrink-0" />
          <span className="font-semibold text-xs text-gray-800">Smart-Timing Master</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-gray-100 ${onTimeColor}`}>
            On-Time {data.on_time_rate_pct}%
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">
            SLA {data.sla_balance_pct}%
          </span>
          {data.batch_alert && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-orange-100 text-orange-700 flex items-center gap-1">
              <Flame size={9} /> Batch
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {/* Kochstart-Empfehlung */}
          {data.kochstart_empfehlung && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
              <Zap size={12} className="text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-emerald-700">
                Jetzt starten: Bestellung {data.bestellungen.find(b => b.order_id === data.kochstart_empfehlung?.order_id)?.order_num ?? '—'} in {Math.ceil((data.kochstart_empfehlung.in_sekunden) / 60)} Min
              </span>
            </div>
          )}

          {/* Bestellliste mit Countdown-Farbkodierung */}
          {active.map(b => {
            const remain = b.target_ready_ts - now;
            const col = colorFor(remain);
            const driverDelta = b.driver_eta_ts ? b.driver_eta_ts - b.target_ready_ts : null;
            const totalDur = b.prep_start_ts ? b.target_ready_ts - b.prep_start_ts : 600;
            const elapsed = b.prep_start_ts ? now - b.prep_start_ts : 0;
            const pct = Math.min(100, Math.max(0, (elapsed / totalDur) * 100));

            return (
              <div key={b.order_id} className={`rounded-lg border p-2.5 ${col.border} bg-white`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-gray-800 shrink-0">{b.order_num}</span>
                    <span className="text-[10px] text-gray-500 truncate">{b.items_kurz}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-xs font-bold tabular-nums ${col.ring}`}>{fmtCd(remain)}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${col.badge}`}>{col.label}</span>
                  </div>
                </div>

                {/* Fortschrittsbalken */}
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-1">
                  <div className={`h-full rounded-full transition-all duration-500 ${col.bar}`} style={{ width: `${pct}%` }} />
                </div>

                {/* Fahrer-ETA */}
                {driverDelta !== null && (
                  <div className="text-[9px] text-gray-400 flex items-center gap-1">
                    <span>Fahrer Δ</span>
                    <span className={`font-semibold ${driverDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {driverDelta > 0 ? `+${Math.round(driverDelta / 60)} Min` : `${Math.round(driverDelta / 60)} Min`}
                    </span>
                    {b.status === 'wartend' && <span className="italic text-gray-300">— wartend</span>}
                  </div>
                )}
              </div>
            );
          })}

          {active.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">Keine aktiven Bestellungen</p>
          )}
        </div>
      )}
    </div>
  );
}
