'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, Flame, Zap, CheckCircle2, AlertCircle, ChefHat } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5495 — Smart-Timing Countdown V55
// 4-stufige Farbkodierung ok/warn/critical/overdue; Station-Filter-Tabs; 5-KPI-Grid;
// Dual-Countdown Küche + Fahrer-ETA-Sync; Fortschrittsbalken; 1s-Tick + 15s-Polling; Mock-Fallback

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
  status: 'cooking' | 'ready' | 'picked_up';
}

const MOCK: OrderTiming[] = [
  { id: 'o1', bestellnummer: 'B-1042', kunde: 'Katja M.',  station: 'grill',   seconds_remaining: 720,  driver_eta_sec: 540,  batch_id: 'BT-1', status: 'cooking' },
  { id: 'o2', bestellnummer: 'B-1043', kunde: 'Lena S.',   station: 'friture', seconds_remaining: 480,  driver_eta_sec: 600,  batch_id: 'BT-1', status: 'cooking' },
  { id: 'o3', bestellnummer: 'B-1044', kunde: 'Max T.',    station: 'kalt',    seconds_remaining: 180,  driver_eta_sec: 120,  batch_id: null,   status: 'cooking' },
  { id: 'o4', bestellnummer: 'B-1045', kunde: 'Sara K.',   station: 'pasta',   seconds_remaining: -90,  driver_eta_sec: 300,  batch_id: 'BT-2', status: 'cooking' },
  { id: 'o5', bestellnummer: 'B-1046', kunde: 'Ali R.',    station: 'ofen',    seconds_remaining: 900,  driver_eta_sec: null, batch_id: null,   status: 'cooking' },
  { id: 'o6', bestellnummer: 'B-1047', kunde: 'Julia B.',  station: 'grill',   seconds_remaining: 360,  driver_eta_sec: 420,  batch_id: 'BT-2', status: 'cooking' },
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

export function KitchenPhase5495SmartTimingCountdownV55({ locationId, className }: Props) {
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
  const remaining = (o: OrderTiming) => o.seconds_remaining - now;

  const active   = visible.filter(o => remaining(o) > 0).length;
  const critical = visible.filter(o => remaining(o) >= 0 && remaining(o) <= 300).length;
  const overdue  = visible.filter(o => remaining(o) < 0).length;
  const ready    = orders.filter(o => o.status === 'ready').length;
  const score    = orders.length > 0 ? Math.max(0, Math.round(100 - (overdue / orders.length) * 100)) : 100;

  return (
    <Card className={cn('bg-zinc-900 text-white border-zinc-800 p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-indigo-400" />
          <span className="font-semibold text-sm">Smart-Timing Countdown V55</span>
        </div>
        <span className="text-xs text-zinc-500">{new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Aktiv',      val: active,   color: 'text-blue-300' },
          { label: 'Kritisch',   val: critical, color: 'text-yellow-300' },
          { label: 'Überfällig', val: overdue,  color: 'text-red-400' },
          { label: 'Fertig',     val: ready,    color: 'text-emerald-400' },
          { label: 'Score',      val: `${score}`, color: score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-zinc-800 rounded-lg p-2 text-center">
            <div className={cn('text-lg font-bold tabular-nums', kpi.color)}>{kpi.val}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Station Filter */}
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {(['all', 'grill', 'friture', 'kalt', 'pasta', 'ofen'] as Station[]).map(s => (
          <button key={s} onClick={() => setStation(s)}
            className={cn('px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
              station === s ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
            {s === 'all' ? 'Alle' : STATION_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Order Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visible.length === 0 && (
          <div className="col-span-2 py-6 text-center text-zinc-500 text-sm flex flex-col items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <span>Alle Bestellungen erledigt</span>
          </div>
        )}
        {visible.map(o => {
          const rem = remaining(o);
          const tier = getTier(rem);
          const ts = TIER_STYLES[tier];
          const maxSec = 900;
          const progress = Math.max(0, Math.min(100, (1 - rem / maxSec) * 100));
          const driverAlert = o.driver_eta_sec !== null && rem > 0 && o.driver_eta_sec < rem;

          return (
            <div key={o.id} className={cn('rounded-xl border p-3 space-y-2', ts.bg, `ring-1 ${ts.ring}`)}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-zinc-400">{o.bestellnummer}</span>
                  <p className="text-sm font-medium leading-tight">{o.kunde}</p>
                </div>
                <div className="text-right">
                  <span className={cn('text-xl font-bold tabular-nums', ts.text)}>{fmtSec(rem)}</span>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', tier === 'overdue' ? 'bg-red-600 text-white animate-pulse' : `${ts.bg} ${ts.text}`)}>
                      {ts.label}
                    </span>
                    <span className="text-[10px] text-zinc-500 bg-zinc-800 rounded px-1">{STATION_LABELS[o.station as Exclude<Station, 'all'>]}</span>
                  </div>
                </div>
              </div>

              <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', tier === 'ok' ? 'bg-emerald-500' : tier === 'warn' ? 'bg-yellow-400' : 'bg-red-500')}
                  style={{ width: `${progress}%` }} />
              </div>

              <div className="flex items-center gap-2 text-xs">
                {o.batch_id && <span className="text-zinc-500">Batch {o.batch_id}</span>}
                {driverAlert && (
                  <span className="flex items-center gap-1 text-blue-300">
                    <Zap className="h-3 w-3" />
                    Fahrer früher — {o.driver_eta_sec !== null ? fmtSec(o.driver_eta_sec) : ''}
                  </span>
                )}
                {o.driver_eta_sec !== null && !driverAlert && (
                  <span className="flex items-center gap-1 text-zinc-500">
                    <Zap className="h-3 w-3" />
                    Fahrer {fmtSec(o.driver_eta_sec)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overdue Alert */}
      {overdue > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-600/20 border border-red-600/40 px-3 py-2 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{overdue} Bestellung{overdue > 1 ? 'en' : ''} überfällig — sofort prüfen!</span>
        </div>
      )}

      {/* Priority Alert */}
      {critical > 2 && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-sm text-yellow-300">
          <Flame className="h-4 w-4 shrink-0" />
          <span>{critical} Bestellungen kritisch — Tempo erhöhen!</span>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-zinc-600">
        <span className="flex items-center gap-1"><ChefHat className="h-3 w-3" /> Küche Live</span>
        <span>15-Sek-Polling</span>
      </div>
    </Card>
  );
}
