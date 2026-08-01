'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, Flame, Zap, CheckCircle2, AlertCircle, ChefHat, Users, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5503 — Smart-Timing Countdown V56
// V55+: Batch-Gruppen-Anzeige; Kochstart-Offset-Indikator; Abholer-Timing-Badge;
// 4-stufige Farbkodierung ok/warn/critical/overdue; Station-Filter-Tabs;
// 5-KPI-Grid; Dual-Countdown Küche+Fahrer-ETA-Sync; Fortschrittsbalken;
// 1s-Tick + 15s-Polling; Mock-Fallback

type Station = 'all' | 'grill' | 'friture' | 'kalt' | 'pasta' | 'ofen';
type Tier = 'ok' | 'warn' | 'critical' | 'overdue';

interface OrderTiming {
  id: string;
  bestellnummer: string;
  kunde: string;
  station: Exclude<Station, 'all'>;
  seconds_remaining: number;
  driver_eta_sec: number | null;
  batch_id: string | null;
  cook_offset_sec: number;
  status: 'cooking' | 'ready' | 'picked_up';
}

const MOCK: OrderTiming[] = [
  { id: 'o1', bestellnummer: 'B-1042', kunde: 'Katja M.',  station: 'grill',   seconds_remaining: 720,  driver_eta_sec: 540,  batch_id: 'BT-1', cook_offset_sec:  60, status: 'cooking' },
  { id: 'o2', bestellnummer: 'B-1043', kunde: 'Lena S.',   station: 'friture', seconds_remaining: 480,  driver_eta_sec: 600,  batch_id: 'BT-1', cook_offset_sec: 120, status: 'cooking' },
  { id: 'o3', bestellnummer: 'B-1044', kunde: 'Max T.',    station: 'kalt',    seconds_remaining: 180,  driver_eta_sec: 120,  batch_id: null,   cook_offset_sec:   0, status: 'cooking' },
  { id: 'o4', bestellnummer: 'B-1045', kunde: 'Sara K.',   station: 'pasta',   seconds_remaining: -90,  driver_eta_sec: 300,  batch_id: 'BT-2', cook_offset_sec: -30, status: 'cooking' },
  { id: 'o5', bestellnummer: 'B-1046', kunde: 'Ali R.',    station: 'ofen',    seconds_remaining: 900,  driver_eta_sec: null, batch_id: null,   cook_offset_sec:   0, status: 'cooking' },
  { id: 'o6', bestellnummer: 'B-1047', kunde: 'Julia B.',  station: 'grill',   seconds_remaining: 360,  driver_eta_sec: 420,  batch_id: 'BT-2', cook_offset_sec:  30, status: 'cooking' },
];

const STATION_LABELS: Record<Exclude<Station, 'all'>, string> = {
  grill: 'Grill', friture: 'Friture', kalt: 'Kalt', pasta: 'Pasta', ofen: 'Ofen',
};

function getTier(sec: number): Tier {
  if (sec > 600) return 'ok';
  if (sec > 300) return 'warn';
  if (sec >= 0)  return 'critical';
  return 'overdue';
}

const TIER_STYLES: Record<Tier, { ring: string; text: string; bg: string; label: string }> = {
  ok:       { ring: 'ring-emerald-500',  text: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'OK' },
  warn:     { ring: 'ring-yellow-400',   text: 'text-yellow-300',  bg: 'bg-yellow-400/10',  label: 'Bald' },
  critical: { ring: 'ring-red-500',      text: 'text-red-400',     bg: 'bg-red-500/10',     label: 'Kritisch' },
  overdue:  { ring: 'ring-red-600',      text: 'text-red-300',     bg: 'bg-red-600/15',     label: 'Überfällig' },
};

function fmtSec(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '-' : '';
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

interface Props { locationId: string | null; className?: string }

export function KitchenPhase5503SmartTimingCountdownV56({ locationId, className }: Props) {
  const [orders, setOrders] = useState<OrderTiming[]>(MOCK);
  const [now, setNow] = useState(0);
  const [station, setStation] = useState<Station>('all');
  const [baseTs] = useState(Date.now());

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/kitchen/timing?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (Array.isArray(json.orders)) setOrders(json.orders); }
    } catch { /* Mock-Fallback */ }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 15_000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { const iv = setInterval(() => setNow(Math.floor((Date.now() - baseTs) / 1000)), 1000); return () => clearInterval(iv); }, [baseTs]);

  const visible = orders.filter(o => o.status === 'cooking' && (station === 'all' || o.station === station));
  const adjustedSec = (o: OrderTiming) => o.seconds_remaining - now;

  const critCount  = visible.filter(o => { const s = adjustedSec(o); return s >= 0 && s <= 300; }).length;
  const overdueCount = visible.filter(o => adjustedSec(o) < 0).length;
  const readyCount = orders.filter(o => o.status === 'ready').length;
  const batchGroups = [...new Set(orders.filter(o => o.batch_id).map(o => o.batch_id))].length;

  const stations: Station[] = ['all', 'grill', 'friture', 'kalt', 'pasta', 'ofen'];

  return (
    <Card className={cn('bg-zinc-900 text-white border-zinc-800 p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-amber-400" />
          <span className="font-semibold text-sm">Smart-Timing V56</span>
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <div className="flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-0.5">
              <AlertCircle className="h-3 w-3 text-red-400" />
              <span className="text-xs text-red-300 font-semibold">{overdueCount} überfällig</span>
            </div>
          )}
          {critCount > 0 && (
            <div className="flex items-center gap-1 rounded-md bg-yellow-500/20 px-2 py-0.5">
              <Flame className="h-3 w-3 text-yellow-400" />
              <span className="text-xs text-yellow-300">{critCount} kritisch</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Aktiv',     val: visible.length,   color: 'text-zinc-300' },
          { label: 'Kritisch',  val: critCount,         color: critCount  > 0 ? 'text-yellow-300' : 'text-zinc-500' },
          { label: 'Überfällig',val: overdueCount,      color: overdueCount > 0 ? 'text-red-400' : 'text-zinc-500' },
          { label: 'Fertig',    val: readyCount,        color: 'text-emerald-400' },
          { label: 'Batches',   val: batchGroups,       color: 'text-violet-300' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-zinc-800 rounded-lg p-2 text-center">
            <div className="text-[10px] text-zinc-500 mb-0.5">{kpi.label}</div>
            <div className={cn('text-sm font-bold tabular-nums', kpi.color)}>{kpi.val}</div>
          </div>
        ))}
      </div>

      {/* Station Filter */}
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {stations.map(s => (
          <button key={s} onClick={() => setStation(s)}
            className={cn('whitespace-nowrap rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors shrink-0',
              station === s ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300')}>
            {s === 'all' ? 'Alle' : STATION_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Order Cards */}
      <div className="space-y-2">
        {visible.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-6 text-zinc-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">Keine aktiven Bestellungen</span>
          </div>
        )}
        {visible.map(o => {
          const sec = adjustedSec(o);
          const tier = getTier(sec);
          const s = TIER_STYLES[tier];
          const driverSync = o.driver_eta_sec !== null ? o.driver_eta_sec - now : null;
          const offsetLabel = o.cook_offset_sec > 0 ? `+${Math.round(o.cook_offset_sec / 60)}min` : o.cook_offset_sec < 0 ? `${Math.round(o.cook_offset_sec / 60)}min` : null;
          return (
            <div key={o.id} className={cn('rounded-xl border p-3 space-y-2 ring-1', s.bg, s.ring)}>
              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{o.bestellnummer}</span>
                    {o.batch_id && (
                      <span className="flex items-center gap-0.5 rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-300">
                        <Users className="h-2.5 w-2.5" />{o.batch_id}
                      </span>
                    )}
                    {offsetLabel && (
                      <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded', o.cook_offset_sec > 0 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-emerald-500/20 text-emerald-300')}>
                        Kochstart {offsetLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{o.kunde} · <span className="text-zinc-600">{STATION_LABELS[o.station]}</span></p>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn('text-xl font-black tabular-nums', s.text)}>{fmtSec(sec)}</div>
                  <div className={cn('text-[10px] font-semibold', s.text)}>{s.label}</div>
                </div>
              </div>
              {/* Progress bar */}
              {o.seconds_remaining > 0 && (
                <div className="h-1.5 rounded-full bg-zinc-800">
                  <div className={cn('h-1.5 rounded-full transition-all', tier === 'ok' ? 'bg-emerald-500' : tier === 'warn' ? 'bg-yellow-500' : 'bg-red-500')}
                    style={{ width: `${Math.max(0, Math.min(100, (sec / o.seconds_remaining) * 100))}%` }} />
                </div>
              )}
              {/* Driver ETA sync */}
              {driverSync !== null && (
                <div className={cn('flex items-center gap-1.5 text-[10px] rounded-md px-2 py-1', driverSync < 60 ? 'bg-emerald-500/15 text-emerald-300' : driverSync < 300 ? 'bg-yellow-500/15 text-yellow-300' : 'bg-zinc-800 text-zinc-400')}>
                  <ChefHat className="h-2.5 w-2.5" />
                  <span>Fahrer ETA: {fmtSec(Math.max(0, driverSync))}</span>
                  {sec > 0 && driverSync < sec && <span className="ml-auto text-emerald-400 font-semibold">Fahrer wartet</span>}
                  {sec <= 0 && <span className="ml-auto text-red-400 font-semibold">Fahrer überfällig</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center text-[10px] text-zinc-600 flex items-center justify-center gap-1">
        <Zap className="h-2.5 w-2.5" />
        1s-Tick · 15s-Polling
      </div>
    </Card>
  );
}
