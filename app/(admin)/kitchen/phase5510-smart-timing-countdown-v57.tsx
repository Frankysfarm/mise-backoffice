'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, Flame, Zap, CheckCircle2, AlertCircle, ChefHat, Thermometer, Package, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5510 — Smart-Timing Countdown V57
// V56+: Kategorie-Filter Vorspeisen/Hauptgang/Nachtisch/Getränke;
// Warmhalte-Indikator je Bestellung (Puffer nach Fertigstellung);
// Batch-Score-Ring; 6-KPI-Grid Score/Aktiv/Kritisch/Fertig/Warm/Velocity;
// Kochstart-Offset-Badge; Dual-Countdown Küche+Fahrer-ETA-Sync;
// Fortschrittsbalken; 1s-Tick + 15s-Polling; Mock-Fallback

type Kategorie = 'all' | 'vorspeise' | 'hauptgang' | 'nachtisch' | 'getraenk';
type Station = 'grill' | 'friture' | 'kalt' | 'pasta' | 'ofen';
type Tier = 'ok' | 'warn' | 'critical' | 'overdue';

interface OrderTiming {
  id: string;
  bestellnummer: string;
  kunde: string;
  station: Station;
  kategorie: Kategorie;
  seconds_remaining: number;
  driver_eta_sec: number | null;
  warmhalte_sec: number;
  batch_id: string | null;
  batch_score: number | null;
  cook_offset_sec: number;
  status: 'cooking' | 'ready' | 'picked_up';
}

const MOCK: OrderTiming[] = [
  { id: 'o1', bestellnummer: 'B-1051', kunde: 'Katja M.',  station: 'grill',   kategorie: 'hauptgang',  seconds_remaining: 740,  driver_eta_sec: 560,  warmhalte_sec: 0,   batch_id: 'BT-1', batch_score: 88, cook_offset_sec:  60, status: 'cooking' },
  { id: 'o2', bestellnummer: 'B-1052', kunde: 'Lena S.',   station: 'friture', kategorie: 'vorspeise',  seconds_remaining: 460,  driver_eta_sec: 620,  warmhalte_sec: 0,   batch_id: 'BT-1', batch_score: 88, cook_offset_sec: 120, status: 'cooking' },
  { id: 'o3', bestellnummer: 'B-1053', kunde: 'Max T.',    station: 'kalt',    kategorie: 'getraenk',   seconds_remaining: 190,  driver_eta_sec: 130,  warmhalte_sec: 0,   batch_id: null,   batch_score: null, cook_offset_sec: 0, status: 'cooking' },
  { id: 'o4', bestellnummer: 'B-1054', kunde: 'Sara K.',   station: 'pasta',   kategorie: 'hauptgang',  seconds_remaining: -80,  driver_eta_sec: 310,  warmhalte_sec: 80,  batch_id: 'BT-2', batch_score: 72, cook_offset_sec: -30, status: 'ready'   },
  { id: 'o5', bestellnummer: 'B-1055', kunde: 'Ali R.',    station: 'ofen',    kategorie: 'hauptgang',  seconds_remaining: 920,  driver_eta_sec: null, warmhalte_sec: 0,   batch_id: null,   batch_score: null, cook_offset_sec: 0, status: 'cooking' },
  { id: 'o6', bestellnummer: 'B-1056', kunde: 'Julia B.',  station: 'kalt',    kategorie: 'nachtisch',  seconds_remaining: 350,  driver_eta_sec: 430,  warmhalte_sec: 0,   batch_id: 'BT-2', batch_score: 72, cook_offset_sec: 30, status: 'cooking' },
  { id: 'o7', bestellnummer: 'B-1057', kunde: 'Finn D.',   station: 'grill',   kategorie: 'hauptgang',  seconds_remaining: 600,  driver_eta_sec: 580,  warmhalte_sec: 0,   batch_id: 'BT-3', batch_score: 91, cook_offset_sec:  0,  status: 'cooking' },
];

const KATEGORIE_LABELS: Record<Exclude<Kategorie, 'all'>, string> = {
  vorspeise: 'Vorspeise', hauptgang: 'Hauptgang', nachtisch: 'Nachtisch', getraenk: 'Getränke',
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

function BatchScoreRing({ score }: { score: number }) {
  const r = 14; const circ = 2 * Math.PI * r;
  const color = score >= 85 ? '#22c55e' : score >= 70 ? '#eab308' : '#ef4444';
  return (
    <svg width="36" height="36" className="shrink-0">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#27272a" strokeWidth="3" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
        strokeLinecap="round" transform="rotate(-90 18 18)" />
      <text x="18" y="18" textAnchor="middle" dominantBaseline="central"
        fontSize="7" fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

interface Props { locationId: string | null; className?: string }

export function KitchenPhase5510SmartTimingCountdownV57({ locationId, className }: Props) {
  const [orders, setOrders] = useState<OrderTiming[]>(MOCK);
  const [now, setNow] = useState(0);
  const [kategorie, setKategorie] = useState<Kategorie>('all');
  const [baseTs] = useState(Date.now());

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/kitchen/timing?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.orders)) setOrders(json.orders);
      }
    } catch { /* Mock-Fallback */ }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 15_000); return () => clearInterval(iv); }, [load]);
  useEffect(() => {
    const iv = setInterval(() => setNow(Math.floor((Date.now() - baseTs) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [baseTs]);

  const adjSec = (o: OrderTiming) => o.seconds_remaining - now;
  const warmSec = (o: OrderTiming) => o.status === 'ready' ? o.warmhalte_sec + now : 0;

  const visible = orders.filter(o =>
    (o.status === 'cooking' || o.status === 'ready') &&
    (kategorie === 'all' || o.kategorie === kategorie)
  );

  const cooking   = visible.filter(o => o.status === 'cooking');
  const ready     = visible.filter(o => o.status === 'ready');
  const critCount = cooking.filter(o => { const s = adjSec(o); return s >= 0 && s <= 300; }).length;
  const overdue   = cooking.filter(o => adjSec(o) < 0).length;
  const warmCount = ready.filter(o => warmSec(o) > 180).length;
  const velocity  = Math.round((orders.filter(o => o.status === 'picked_up').length / Math.max(1, (Date.now() - baseTs) / 3600_000)) * 10) / 10;

  const avgScore = (() => {
    const scores = orders.filter(o => o.batch_score !== null).map(o => o.batch_score as number);
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  })();

  const kats: Kategorie[] = ['all', 'vorspeise', 'hauptgang', 'nachtisch', 'getraenk'];

  return (
    <Card className={cn('bg-zinc-900 text-white border-zinc-800 p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-amber-400" />
          <span className="font-semibold text-sm">Smart-Timing V57</span>
        </div>
        <div className="flex items-center gap-1.5">
          {overdue > 0 && (
            <span className="flex items-center gap-1 text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
              <AlertCircle className="h-3 w-3" />{overdue} überfällig
            </span>
          )}
          <span className="text-xs text-zinc-500">V57</span>
        </div>
      </div>

      {/* 6-KPI-Grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[
          { label: 'Score',    value: avgScore,             unit: '',   icon: <TrendingUp className="h-3 w-3 text-violet-400" />,  color: 'text-violet-300' },
          { label: 'Aktiv',    value: cooking.length,       unit: '',   icon: <Flame className="h-3 w-3 text-orange-400" />,       color: 'text-orange-300' },
          { label: 'Kritisch', value: critCount,            unit: '',   icon: <AlertCircle className="h-3 w-3 text-red-400" />,    color: 'text-red-300' },
          { label: 'Fertig',   value: ready.length,         unit: '',   icon: <CheckCircle2 className="h-3 w-3 text-emerald-400" />, color: 'text-emerald-300' },
          { label: 'Warm',     value: warmCount,            unit: '',   icon: <Thermometer className="h-3 w-3 text-amber-400" />,  color: warmCount > 0 ? 'text-amber-300' : 'text-zinc-400' },
          { label: 'Vel./h',   value: velocity,             unit: '',   icon: <Zap className="h-3 w-3 text-sky-400" />,            color: 'text-sky-300' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-zinc-800 rounded-lg p-2 text-center">
            <div className="flex justify-center mb-1">{kpi.icon}</div>
            <div className={cn('text-lg font-bold leading-none', kpi.color)}>{kpi.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Kategorie-Filter */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {kats.map(k => (
          <button key={k} onClick={() => setKategorie(k)}
            className={cn('shrink-0 text-xs px-3 py-1 rounded-full transition-colors',
              kategorie === k ? 'bg-amber-500 text-black font-semibold' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
            {k === 'all' ? 'Alle' : KATEGORIE_LABELS[k as Exclude<Kategorie, 'all'>]}
          </button>
        ))}
      </div>

      {/* Countdown Wall */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {visible.length === 0 && (
          <p className="col-span-2 text-center text-zinc-500 text-sm py-4">Keine Bestellungen</p>
        )}
        {visible.sort((a, b) => {
          if (a.status === 'ready' && b.status !== 'ready') return -1;
          if (a.status !== 'ready' && b.status === 'ready') return 1;
          return adjSec(a) - adjSec(b);
        }).map(o => {
          const sec = o.status === 'cooking' ? adjSec(o) : -warmSec(o);
          const tier = o.status === 'ready' ? 'ok' : getTier(sec);
          const ts = TIER_STYLES[tier];
          const driverDelta = o.driver_eta_sec !== null ? o.driver_eta_sec - sec : null;
          const warmOver = o.status === 'ready' && warmSec(o) > 180;

          return (
            <div key={o.id}
              className={cn('rounded-lg p-3 ring-1 space-y-2', ts.bg, ts.ring)}>
              <div className="flex items-center justify-between">
                <div>
                  <span className={cn('font-mono text-xs font-semibold', ts.text)}>{o.bestellnummer}</span>
                  <span className="ml-2 text-xs text-zinc-400">{o.kunde}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {o.batch_score !== null && <BatchScoreRing score={o.batch_score} />}
                  <span className={cn('text-xs px-1.5 py-0.5 rounded', ts.bg, ts.text)}>{ts.label}</span>
                </div>
              </div>

              {/* Countdown */}
              <div className="flex items-center justify-between">
                <div>
                  <div className={cn('text-2xl font-bold font-mono', ts.text)}>
                    {o.status === 'ready' ? '✓ Fertig' : fmtSec(sec)}
                  </div>
                  {warmOver && (
                    <div className="flex items-center gap-1 text-xs text-amber-300 mt-0.5">
                      <Thermometer className="h-3 w-3" /> Warm seit {fmtSec(warmSec(o))}
                    </div>
                  )}
                </div>
                {o.driver_eta_sec !== null && o.status === 'cooking' && (
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">Fahrer-ETA</div>
                    <div className={cn('text-sm font-mono', driverDelta !== null && driverDelta < -60 ? 'text-blue-400' : 'text-zinc-300')}>
                      {fmtSec(Math.max(0, o.driver_eta_sec - now))}
                      {driverDelta !== null && driverDelta < -60 && <Zap className="inline h-3 w-3 ml-0.5 text-blue-400" />}
                    </div>
                  </div>
                )}
              </div>

              {/* Progress */}
              {o.status === 'cooking' && (
                <div className="space-y-1">
                  <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all',
                      tier === 'ok' ? 'bg-emerald-500' : tier === 'warn' ? 'bg-yellow-400' : 'bg-red-500')}
                      style={{ width: `${Math.min(100, Math.max(0, 100 - (sec / 900) * 100))}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-zinc-600">
                    <span>{o.station}</span>
                    {o.batch_id && <span className="text-violet-400">Batch {o.batch_id}</span>}
                    {o.cook_offset_sec !== 0 && (
                      <span className={o.cook_offset_sec > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                        {o.cook_offset_sec > 0 ? '+' : ''}{o.cook_offset_sec}s Offset
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-zinc-600">1s-Tick · 15s-Polling · Phase 5510</p>
    </Card>
  );
}
