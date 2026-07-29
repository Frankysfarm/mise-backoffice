'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, Zap, AlertTriangle, CheckCircle2, Flame, ChefHat } from 'lucide-react';

interface OrderRow {
  order_id: string;
  display_id: string;
  items_summary: string;
  prep_started_at: string | null;
  target_ready_at: string | null;
  status: string;
  driver_eta_min: number | null;
  is_batch: boolean;
  batch_group_id: string | null;
}

interface ApiResponse {
  orders: OrderRow[];
  score: number;
  on_time_pct: number;
  avg_prep_min: number;
  overdue_count: number;
  queue_15min: number;
  rush_hour_alert: boolean;
  batch_alert: boolean;
}

type AmpelStufe = 'kritisch-dunkel' | 'kritisch' | 'hoch' | 'mittel' | 'niedrig' | 'ok' | 'fertig';

function getAmpel(secs: number, status: string): AmpelStufe {
  if (status === 'ready') return 'fertig';
  if (secs < 0) return 'kritisch-dunkel';
  if (secs < 60) return 'kritisch';
  if (secs < 180) return 'hoch';
  if (secs < 300) return 'mittel';
  if (secs < 480) return 'niedrig';
  return 'ok';
}

const AMPEL_STYLE: Record<AmpelStufe, { bg: string; text: string; border: string; label: string }> = {
  'kritisch-dunkel': { bg: 'bg-red-950', text: 'text-red-300', border: 'border-red-700', label: 'ÜBERFÄLLIG' },
  'kritisch':        { bg: 'bg-red-900', text: 'text-red-200', border: 'border-red-600', label: 'Kritisch' },
  'hoch':            { bg: 'bg-orange-900', text: 'text-orange-200', border: 'border-orange-600', label: 'Dringend' },
  'mittel':          { bg: 'bg-amber-900', text: 'text-amber-200', border: 'border-amber-600', label: 'Bald' },
  'niedrig':         { bg: 'bg-yellow-900', text: 'text-yellow-200', border: 'border-yellow-700', label: 'Normal' },
  'ok':              { bg: 'bg-emerald-900', text: 'text-emerald-200', border: 'border-emerald-700', label: 'Gut' },
  'fertig':          { bg: 'bg-indigo-900', text: 'text-indigo-300', border: 'border-indigo-700', label: 'Fertig' },
};

function fmtSec(s: number) {
  if (s < 0) return `-${String(Math.floor(Math.abs(s) / 60)).padStart(2, '0')}:${String(Math.abs(s) % 60).padStart(2, '0')}`;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function secsRemaining(targetAt: string | null): number {
  if (!targetAt) return 600;
  return Math.floor((new Date(targetAt).getTime() - Date.now()) / 1000);
}

const MOCK: ApiResponse = {
  score: 82,
  on_time_pct: 79,
  avg_prep_min: 14,
  overdue_count: 2,
  queue_15min: 5,
  rush_hour_alert: false,
  batch_alert: true,
  orders: [
    { order_id: 'a1', display_id: '#2401', items_summary: 'Burger + Pommes', prep_started_at: new Date(Date.now() - 12 * 60000).toISOString(), target_ready_at: new Date(Date.now() - 90000).toISOString(), status: 'cooking', driver_eta_min: 2, is_batch: true, batch_group_id: 'B1' },
    { order_id: 'a2', display_id: '#2402', items_summary: 'Pizza Margherita', prep_started_at: new Date(Date.now() - 8 * 60000).toISOString(), target_ready_at: new Date(Date.now() + 45000).toISOString(), status: 'cooking', driver_eta_min: 4, is_batch: true, batch_group_id: 'B1' },
    { order_id: 'a3', display_id: '#2403', items_summary: 'Wrap Chicken', prep_started_at: new Date(Date.now() - 5 * 60000).toISOString(), target_ready_at: new Date(Date.now() + 240000).toISOString(), status: 'cooking', driver_eta_min: null, is_batch: false, batch_group_id: null },
    { order_id: 'a4', display_id: '#2404', items_summary: 'Salat Bowl', prep_started_at: new Date(Date.now() - 3 * 60000).toISOString(), target_ready_at: new Date(Date.now() + 420000).toISOString(), status: 'cooking', driver_eta_min: 10, is_batch: false, batch_group_id: null },
    { order_id: 'a5', display_id: '#2405', items_summary: 'Pasta Bolognese', prep_started_at: null, target_ready_at: new Date(Date.now() + 700000).toISOString(), status: 'ready', driver_eta_min: 15, is_batch: false, batch_group_id: null },
  ],
};

export function KitchenPhase4720SmartTimingCountdownFarbkodierungV14({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const r = await fetch(`/api/delivery/admin/kitchen-smart-timing-v14?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
      else setData(MOCK);
    } catch { setData(MOCK); }
  }

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    pollRef.current = setInterval(load, 15000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [locationId]);

  if (!data) return <div className="rounded-2xl bg-indigo-950 p-4 text-indigo-400 text-sm animate-pulse">Lade Smart-Timing V14…</div>;

  const sorted = [...data.orders].sort((a, b) => secsRemaining(a.target_ready_at) - secsRemaining(b.target_ready_at));

  const scoreColor = data.score >= 80 ? 'text-emerald-400' : data.score >= 60 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="rounded-2xl bg-indigo-950 text-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-indigo-100">Smart-Timing V14</span>
          <span className="text-[10px] text-indigo-500">7-Stufen-Ampel</span>
        </div>
        <div className={`text-2xl font-black ${scoreColor}`}>{data.score}</div>
      </div>

      {/* Alerts */}
      {data.rush_hour_alert && (
        <div className="flex items-center gap-2 rounded-lg bg-orange-900/60 border border-orange-600 px-3 py-2 text-orange-300 text-xs">
          <Flame className="w-4 h-4 shrink-0" />
          Rush-Hour erkannt — erhöhte Bestelllast in den nächsten 15 Min
        </div>
      )}
      {data.batch_alert && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-900/60 border border-amber-600 px-3 py-2 text-amber-300 text-xs">
          <Zap className="w-4 h-4 shrink-0" />
          Batch-Gruppe aktiv — koordinierte Zubereitung empfohlen
        </div>
      )}
      {data.overdue_count > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-900/60 border border-red-600 px-3 py-2 text-red-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {data.overdue_count} Bestellung{data.overdue_count > 1 ? 'en' : ''} überfällig
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        {[
          { label: 'Pünktlich', value: `${data.on_time_pct}%`, color: data.on_time_pct >= 80 ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'Ø Prep', value: `${data.avg_prep_min} min`, color: 'text-indigo-200' },
          { label: 'Überfällig', value: `${data.overdue_count}`, color: data.overdue_count > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Queue 15\'', value: `${data.queue_15min}`, color: data.queue_15min > 8 ? 'text-orange-400' : 'text-indigo-200' },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-indigo-900/50 p-2">
            <p className="text-indigo-400 text-[10px]">{k.label}</p>
            <p className={`font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Ampel Legend */}
      <div className="flex flex-wrap gap-1">
        {(Object.keys(AMPEL_STYLE) as AmpelStufe[]).map(s => (
          <span key={s} className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${AMPEL_STYLE[s].bg} ${AMPEL_STYLE[s].text}`}>
            {AMPEL_STYLE[s].label}
          </span>
        ))}
      </div>

      {/* Countdown Cards */}
      <div className="space-y-2">
        {sorted.map(o => {
          const secs = secsRemaining(o.target_ready_at);
          const stufe = getAmpel(secs, o.status);
          const style = AMPEL_STYLE[stufe];
          return (
            <div key={o.order_id} className={`rounded-xl border p-3 ${style.bg} ${style.border}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {o.is_batch && <Zap className="w-3 h-3 text-amber-400" />}
                  {stufe === 'fertig' && <CheckCircle2 className="w-3 h-3 text-indigo-400" />}
                  <span className={`text-xs font-semibold ${style.text}`}>{o.display_id}</span>
                  {o.batch_group_id && (
                    <span className="text-[9px] bg-amber-800/60 text-amber-300 px-1.5 rounded-full">{o.batch_group_id}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {o.driver_eta_min !== null && (
                    <span className="text-[10px] text-indigo-400 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      Fahrer {o.driver_eta_min}′
                    </span>
                  )}
                  <span className={`font-mono text-base font-black ${stufe === 'kritisch-dunkel' || stufe === 'kritisch' ? 'text-red-300 animate-pulse' : style.text}`}>
                    {fmtSec(secs)}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-indigo-400 mt-1">{o.items_summary}</p>
              {/* Progress bar */}
              <div className="h-1 rounded-full bg-indigo-900/40 mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    stufe === 'ok' || stufe === 'niedrig' ? 'bg-emerald-500' :
                    stufe === 'mittel' ? 'bg-amber-400' :
                    stufe === 'hoch' ? 'bg-orange-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, 100 - (secs / 600) * 100))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
