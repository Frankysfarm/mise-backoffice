'use client';

/**
 * Phase 2645 — Smart-Timing Echtzeit-Cockpit Final
 *
 * Integriertes Küchen-Cockpit mit:
 * - Farbkodierter Sekundengenauer Countdown je Bestellung (grün/gelb/rot)
 * - Fahrer-ETA-Bridge: Δ-Zeit zwischen Fertig & Fahrer-Ankunft
 * - On-Time-Rate-Gauge (0–100 %)
 * - Überfällig-Alert mit Pulsieren
 * - Batch-Kochstart-Empfehlung (start_now / wait / already_started)
 * - 1-Sek-Tick + 20-Sek-Polling
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, AlertTriangle, Flame, TrendingUp, Loader2, Zap } from 'lucide-react';

type Urgency = 'on_track' | 'due_soon' | 'overdue';
type StartRec = 'start_now' | 'wait' | 'already_started' | null;

interface OrderEntry {
  orderId: string;
  orderNum: string;
  zone: string | null;
  itemCount: number;
  remainSec: number;
  urgency: Urgency;
  driverEtaSec: number | null;
  deltaDriverSec: number | null;
  startRec: StartRec;
}

interface Summary {
  totalActive: number;
  overdueCount: number;
  dueSoonCount: number;
  onTimeRate: number;
  avgRemainSec: number | null;
}

interface ApiResponse {
  orders: OrderEntry[];
  summary: Summary;
  locationId: string;
}

const MOCK: ApiResponse = {
  locationId: 'mock',
  orders: [
    { orderId: 'o1', orderNum: '1042', zone: 'A', itemCount: 4, remainSec: -42, urgency: 'overdue',  driverEtaSec: 90,  deltaDriverSec: 132,  startRec: 'start_now' },
    { orderId: 'o2', orderNum: '1043', zone: 'B', itemCount: 2, remainSec: 78,  urgency: 'due_soon', driverEtaSec: 120, deltaDriverSec: 42,   startRec: 'already_started' },
    { orderId: 'o3', orderNum: '1044', zone: 'A', itemCount: 6, remainSec: 312, urgency: 'on_track', driverEtaSec: 480, deltaDriverSec: 168,  startRec: 'wait' },
    { orderId: 'o4', orderNum: '1045', zone: 'C', itemCount: 3, remainSec: 195, urgency: 'on_track', driverEtaSec: 300, deltaDriverSec: 105,  startRec: 'wait' },
    { orderId: 'o5', orderNum: '1046', zone: 'B', itemCount: 1, remainSec: 20,  urgency: 'due_soon', driverEtaSec: 60,  deltaDriverSec: 40,   startRec: 'already_started' },
  ],
  summary: { totalActive: 5, overdueCount: 1, dueSoonCount: 2, onTimeRate: 74, avgRemainSec: 113 },
};

function urgStyle(u: Urgency) {
  switch (u) {
    case 'overdue':  return { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700',    cd: 'text-red-600',    bar: 'bg-red-500',    dot: 'bg-red-500' };
    case 'due_soon': return { bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-700',  cd: 'text-amber-600',  bar: 'bg-amber-400',  dot: 'bg-amber-500' };
    default:         return { bg: 'bg-matcha-50', border: 'border-matcha-200', text: 'text-matcha-700', cd: 'text-matcha-700', bar: 'bg-matcha-500', dot: 'bg-matcha-500' };
  }
}

function recLabel(r: StartRec): { label: string; cls: string } {
  switch (r) {
    case 'start_now':        return { label: '▶ Jetzt starten',  cls: 'bg-red-600 text-white' };
    case 'already_started':  return { label: '🔥 Läuft',         cls: 'bg-amber-500 text-white' };
    case 'wait':             return { label: '⏳ Warten',         cls: 'bg-muted text-muted-foreground' };
    default:                 return { label: '–',                 cls: 'bg-muted text-muted-foreground' };
  }
}

function fmtSec(s: number): string {
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const ss = Math.floor(abs % 60);
  const sign = s < 0 ? '-' : '';
  return `${sign}${m}:${String(ss).padStart(2, '0')}`;
}

function onTimeColor(rate: number) {
  if (rate >= 85) return 'text-matcha-600';
  if (rate >= 65) return 'text-amber-600';
  return 'text-red-600';
}

function GaugeArc({ rate }: { rate: number }) {
  const r = 28;
  const cx = 36;
  const cy = 36;
  const circ = Math.PI * r;
  const pct = Math.max(0, Math.min(100, rate)) / 100;
  const dash = pct * circ;
  const color = rate >= 85 ? '#22c55e' : rate >= 65 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={72} height={44} viewBox="0 0 72 44">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#e5e7eb" strokeWidth={7} />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={13} fontWeight="900" fill={color}>{rate}%</text>
    </svg>
  );
}

export function KitchenPhase2645SmartTimingEchtzeitCockpitFinal({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [liveOrders, setLiveOrders] = useState<OrderEntry[]>(MOCK.orders);

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000);
    tickRef.current = t;
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setLiveOrders(prev => prev.map(o => ({ ...o, remainSec: o.remainSec - 1 })));
  }, [tick]);

  const fetchData = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/kitchen?locationId=${locationId}&view=smart_timing_cockpit`);
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData(json);
        setLiveOrders(json.orders);
      }
    } catch {
      // use mock
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 20_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [locationId]);

  const summary = data.summary;
  const sorted = [...liveOrders].sort((a, b) => a.remainSec - b.remainSec);
  const overdueCount = sorted.filter(o => o.remainSec < 0).length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition"
      >
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-black uppercase tracking-wider">
          Smart-Timing Cockpit Final
        </span>
        <span className="text-[10px] text-muted-foreground ml-1">Phase 2645</span>
        {overdueCount > 0 && (
          <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black text-white animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" />
            {overdueCount} überfällig
          </span>
        )}
        {loading && <Loader2 className="h-3 w-3 animate-spin ml-1 text-muted-foreground" />}
        <span className="ml-auto text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t divide-y">
          {/* KPI Header */}
          <div className="flex items-center gap-4 px-4 py-3 bg-muted/20 flex-wrap">
            <div className="flex flex-col items-center">
              <GaugeArc rate={summary.onTimeRate} />
              <span className="text-[10px] text-muted-foreground -mt-1">On-Time</span>
            </div>
            <div className="flex flex-wrap gap-4 flex-1 min-w-0">
              {[
                { label: 'Aktiv',      val: summary.totalActive,  cls: 'text-foreground' },
                { label: 'Überfällig', val: summary.overdueCount, cls: summary.overdueCount > 0 ? 'text-red-600 font-black' : 'text-foreground' },
                { label: 'Dringend',   val: summary.dueSoonCount, cls: summary.dueSoonCount > 0 ? 'text-amber-600 font-bold' : 'text-foreground' },
              ].map(k => (
                <div key={k.label} className="flex flex-col">
                  <span className={cn('text-xl font-black tabular-nums leading-none', k.cls)}>{k.val}</span>
                  <span className="text-[10px] text-muted-foreground">{k.label}</span>
                </div>
              ))}
              {summary.avgRemainSec !== null && (
                <div className="flex flex-col">
                  <span className={cn('text-xl font-black tabular-nums leading-none', onTimeColor(summary.onTimeRate))}>
                    {fmtSec(summary.avgRemainSec)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Ø Rest</span>
                </div>
              )}
            </div>
          </div>

          {/* Order list */}
          <div className="divide-y">
            {sorted.map(o => {
              const s = urgStyle(o.urgency);
              const rec = recLabel(o.startRec);
              const pct = Math.max(0, Math.min(100, 1 - o.remainSec / (o.remainSec + 600))) * 100;
              return (
                <div
                  key={o.orderId}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5',
                    o.urgency === 'overdue' && 'animate-pulse',
                  )}
                >
                  {/* Status dot */}
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', s.dot)} />

                  {/* Order info */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black">#{o.orderNum}</span>
                      {o.zone && (
                        <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', s.bg, s.text, s.border, 'border')}>
                          Zone {o.zone}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{o.itemCount} Artikel</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', s.bar)} style={{ width: `${Math.max(0, Math.min(100, 100 - (o.remainSec / 900) * 100))}%` }} />
                    </div>
                  </div>

                  {/* Countdown */}
                  <div className={cn('font-mono text-lg font-black tabular-nums shrink-0 ml-auto', s.cd)}>
                    {fmtSec(o.remainSec)}
                  </div>

                  {/* Driver ETA delta */}
                  {o.deltaDriverSec !== null && (
                    <div className="flex flex-col items-center shrink-0">
                      <span className={cn('text-[10px] font-bold tabular-nums', o.deltaDriverSec < 0 ? 'text-red-500' : 'text-matcha-600')}>
                        {o.deltaDriverSec >= 0 ? '+' : ''}{fmtSec(o.deltaDriverSec)}
                      </span>
                      <span className="text-[9px] text-muted-foreground">Δ Fahrer</span>
                    </div>
                  )}

                  {/* Start recommendation */}
                  <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold shrink-0', rec.cls)}>
                    {rec.label}
                  </span>
                </div>
              );
            })}
            {sorted.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Keine aktiven Bestellungen
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
