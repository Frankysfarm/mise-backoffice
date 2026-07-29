'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, Zap, AlertTriangle, CheckCircle2, Flame, ChefHat, Brain, Users } from 'lucide-react';

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
  complexity_score: number;
  ki_empfehlung: string | null;
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
  ki_gesamtempfehlung: string | null;
  driver_sync_count: number;
}

type AmpelStufe = 'super-kritisch' | 'kritisch-dunkel' | 'kritisch' | 'hoch' | 'mittel' | 'niedrig' | 'ok' | 'fertig';

function getAmpel(secs: number, status: string): AmpelStufe {
  if (status === 'ready') return 'fertig';
  if (secs < -120) return 'super-kritisch';
  if (secs < 0) return 'kritisch-dunkel';
  if (secs < 60) return 'kritisch';
  if (secs < 180) return 'hoch';
  if (secs < 300) return 'mittel';
  if (secs < 480) return 'niedrig';
  return 'ok';
}

const AMPEL_STYLE: Record<AmpelStufe, { bg: string; text: string; border: string; label: string }> = {
  'super-kritisch': { bg: 'bg-red-950', text: 'text-red-200', border: 'border-red-500', label: 'SOFORT' },
  'kritisch-dunkel': { bg: 'bg-red-900', text: 'text-red-300', border: 'border-red-700', label: 'ÜBERFÄLLIG' },
  'kritisch':        { bg: 'bg-rose-900', text: 'text-rose-200', border: 'border-rose-600', label: 'Kritisch' },
  'hoch':            { bg: 'bg-orange-900', text: 'text-orange-200', border: 'border-orange-600', label: 'Dringend' },
  'mittel':          { bg: 'bg-amber-900', text: 'text-amber-200', border: 'border-amber-600', label: 'Bald' },
  'niedrig':         { bg: 'bg-yellow-900', text: 'text-yellow-200', border: 'border-yellow-700', label: 'Normal' },
  'ok':              { bg: 'bg-emerald-900', text: 'text-emerald-200', border: 'border-emerald-700', label: 'Gut' },
  'fertig':          { bg: 'bg-indigo-900', text: 'text-indigo-300', border: 'border-indigo-700', label: 'Fertig' },
};

function fmtSec(s: number) {
  const abs = Math.abs(s);
  const sign = s < 0 ? '-' : '';
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function secsRemaining(targetAt: string | null): number {
  if (!targetAt) return 600;
  return Math.floor((new Date(targetAt).getTime() - Date.now()) / 1000);
}

const MOCK: ApiResponse = {
  score: 84,
  on_time_pct: 81,
  avg_prep_min: 13,
  overdue_count: 1,
  queue_15min: 6,
  rush_hour_alert: true,
  batch_alert: true,
  ki_gesamtempfehlung: 'Batch B1 jetzt starten — Fahrer trifft in 3 Min ein',
  driver_sync_count: 2,
  orders: [
    { order_id: 'a1', display_id: '#2501', items_summary: 'Burger + Pommes + Cola', prep_started_at: new Date(Date.now() - 15 * 60000).toISOString(), target_ready_at: new Date(Date.now() - 150000).toISOString(), status: 'cooking', driver_eta_min: 1, is_batch: true, batch_group_id: 'B1', complexity_score: 3, ki_empfehlung: 'Fahrer wartet — jetzt abgeben!' },
    { order_id: 'a2', display_id: '#2502', items_summary: 'Pizza Margherita + Tiramisu', prep_started_at: new Date(Date.now() - 9 * 60000).toISOString(), target_ready_at: new Date(Date.now() + 30000).toISOString(), status: 'cooking', driver_eta_min: 3, is_batch: true, batch_group_id: 'B1', complexity_score: 2, ki_empfehlung: null },
    { order_id: 'a3', display_id: '#2503', items_summary: 'Wrap Chicken + Salat', prep_started_at: new Date(Date.now() - 6 * 60000).toISOString(), target_ready_at: new Date(Date.now() + 250000).toISOString(), status: 'cooking', driver_eta_min: null, is_batch: false, batch_group_id: null, complexity_score: 1, ki_empfehlung: null },
    { order_id: 'a4', display_id: '#2504', items_summary: 'Pasta Bolognese', prep_started_at: new Date(Date.now() - 2 * 60000).toISOString(), target_ready_at: new Date(Date.now() + 480000).toISOString(), status: 'cooking', driver_eta_min: 12, is_batch: false, batch_group_id: null, complexity_score: 2, ki_empfehlung: null },
    { order_id: 'a5', display_id: '#2505', items_summary: 'Salat Bowl Vegan', prep_started_at: null, target_ready_at: new Date(Date.now() + 720000).toISOString(), status: 'ready', driver_eta_min: 18, is_batch: false, batch_group_id: null, complexity_score: 1, ki_empfehlung: null },
  ],
};

export function KitchenPhase4730SmartTimingCountdownFarbkodierungV15({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const r = await fetch(`/api/delivery/admin/kitchen-smart-timing-v15?location_id=${locationId}`);
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

  if (!data) return <div className="rounded-2xl bg-indigo-950 p-4 text-indigo-400 text-sm animate-pulse">Lade Smart-Timing V15…</div>;

  const sorted = [...data.orders].sort((a, b) => secsRemaining(a.target_ready_at) - secsRemaining(b.target_ready_at));
  const scoreColor = data.score >= 80 ? 'text-emerald-400' : data.score >= 60 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="rounded-2xl bg-indigo-950 text-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-indigo-100">Smart-Timing V15</span>
          <span className="text-[10px] text-indigo-500">8-Stufen-Ampel + KI</span>
        </div>
        <div className={`text-2xl font-black ${scoreColor}`}>{data.score}</div>
      </div>

      {/* KI-Empfehlung */}
      {data.ki_gesamtempfehlung && (
        <div className="flex items-center gap-2 rounded-lg bg-violet-900/60 border border-violet-600 px-3 py-2 text-violet-200 text-xs">
          <Brain className="w-4 h-4 shrink-0 text-violet-400" />
          <span><span className="font-semibold text-violet-300">KI:</span> {data.ki_gesamtempfehlung}</span>
        </div>
      )}

      {/* Alerts */}
      {data.rush_hour_alert && (
        <div className="flex items-center gap-2 rounded-lg bg-orange-900/60 border border-orange-600 px-3 py-2 text-orange-300 text-xs">
          <Flame className="w-4 h-4 shrink-0" />
          Rush-Hour — erhöhte Bestelllast in den nächsten 15 Min
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
      <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
        {[
          { label: 'Score', value: `${data.score}`, color: scoreColor },
          { label: 'Pünktlich', value: `${data.on_time_pct}%`, color: data.on_time_pct >= 80 ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'Ø Prep', value: `${data.avg_prep_min} min`, color: 'text-indigo-200' },
          { label: 'Überfällig', value: `${data.overdue_count}`, color: data.overdue_count > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Fahrer-Sync', value: `${data.driver_sync_count}`, color: data.driver_sync_count > 0 ? 'text-amber-400' : 'text-indigo-400' },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-indigo-900/50 p-2">
            <p className="text-indigo-400 text-[9px]">{k.label}</p>
            <p className={`font-bold text-sm ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Ampel Legend */}
      <div className="flex flex-wrap gap-1">
        {(Object.keys(AMPEL_STYLE) as AmpelStufe[]).map(s => (
          <span key={s} className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${AMPEL_STYLE[s].bg} ${AMPEL_STYLE[s].text}`}>
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
          const isSuperCritical = stufe === 'super-kritisch' || stufe === 'kritisch-dunkel';
          return (
            <div key={o.order_id} className={`rounded-xl border p-3 ${style.bg} ${style.border}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {o.is_batch && <Zap className="w-3 h-3 text-amber-400 shrink-0" />}
                  {stufe === 'fertig' && <CheckCircle2 className="w-3 h-3 text-indigo-400 shrink-0" />}
                  <span className={`text-xs font-semibold ${style.text}`}>{o.display_id}</span>
                  {o.batch_group_id && (
                    <span className="text-[9px] bg-amber-800/60 text-amber-300 px-1.5 rounded-full">{o.batch_group_id}</span>
                  )}
                  {'★'.repeat(Math.min(o.complexity_score, 3)) && (
                    <span className="text-[9px] text-amber-500">{'★'.repeat(o.complexity_score)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {o.driver_eta_min !== null && (
                    <span className="text-[10px] text-indigo-400 flex items-center gap-0.5">
                      <Users className="w-2.5 h-2.5" />
                      {o.driver_eta_min}′
                    </span>
                  )}
                  <span className={`font-mono text-base font-black ${isSuperCritical ? 'text-red-300 animate-pulse' : style.text}`}>
                    {fmtSec(secs)}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-indigo-400 mt-1">{o.items_summary}</p>
              {o.ki_empfehlung && (
                <p className="text-[10px] text-violet-300 mt-1 flex items-center gap-1">
                  <Brain className="w-2.5 h-2.5 shrink-0" />
                  {o.ki_empfehlung}
                </p>
              )}
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
