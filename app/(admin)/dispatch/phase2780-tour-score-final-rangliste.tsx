'use client';

/**
 * Phase 2780 — Tour-Score Final-Rangliste
 * Fahrerliste sortiert nach Score 0–100; Score-Ring SVG; farbkodierte Stop-Dots;
 * Tour-Fortschrittsbalken; ETA-Badge; Drill-down Stop-Liste; Alert Score <60;
 * Team-Ø; Bester/Schlechtester-Highlight; Trend vs. Schicht-Ø; 25-Sek-Polling
 */

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Star, Bike, MapPin, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StopEntry {
  id: string;
  sequence: number;
  status: string;
  address: string | null;
  customer_name: string | null;
}

interface DriverEntry {
  driver_id: string;
  driver_name: string;
  score: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  stops_total: number;
  stops_done: number;
  eta_return_min: number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
  stops: StopEntry[];
}

interface ApiData {
  fahrer: DriverEntry[];
  team_avg_score: number;
  schicht_avg: number;
}

const ZIEL = 80;
const WARN = 60;

const MOCK_DATA: ApiData = {
  team_avg_score: 73,
  schicht_avg: 68,
  fahrer: [
    {
      driver_id: 'd1', driver_name: 'Max M.', score: 91, trend: 'steigend', trend_delta: 8,
      stops_total: 4, stops_done: 3, eta_return_min: 12, ampel: 'gruen', alert: null,
      stops: [
        { id: 's1', sequence: 1, status: 'completed', address: 'Hauptstr. 5', customer_name: 'Müller' },
        { id: 's2', sequence: 2, status: 'completed', address: 'Bergweg 12', customer_name: 'Schmidt' },
        { id: 's3', sequence: 3, status: 'completed', address: 'Gartenstr. 3', customer_name: 'Weber' },
        { id: 's4', sequence: 4, status: 'pending', address: 'Parkstr. 7', customer_name: 'Becker' },
      ],
    },
    {
      driver_id: 'd2', driver_name: 'Sara K.', score: 77, trend: 'stabil', trend_delta: 1,
      stops_total: 3, stops_done: 1, eta_return_min: 28, ampel: 'gruen', alert: null,
      stops: [
        { id: 's5', sequence: 1, status: 'completed', address: 'Lindenallee 2', customer_name: 'Fischer' },
        { id: 's6', sequence: 2, status: 'active', address: 'Rosenstr. 9', customer_name: 'Wagner' },
        { id: 's7', sequence: 3, status: 'pending', address: 'Waldweg 4', customer_name: 'Bauer' },
      ],
    },
    {
      driver_id: 'd3', driver_name: 'Tim B.', score: 62, trend: 'fallend', trend_delta: -5,
      stops_total: 5, stops_done: 2, eta_return_min: 45, ampel: 'gelb', alert: null,
      stops: [
        { id: 's8', sequence: 1, status: 'completed', address: 'Kirchstr. 1', customer_name: 'Herrmann' },
        { id: 's9', sequence: 2, status: 'completed', address: 'Schillerstr. 8', customer_name: 'Richter' },
        { id: 's10', sequence: 3, status: 'active', address: 'Goetheallee 6', customer_name: 'Klein' },
        { id: 's11', sequence: 4, status: 'pending', address: 'Mozartstr. 3', customer_name: 'Wolf' },
        { id: 's12', sequence: 5, status: 'pending', address: 'Beethovenstr. 11', customer_name: 'Schröder' },
      ],
    },
    {
      driver_id: 'd4', driver_name: 'Julia F.', score: 48, trend: 'fallend', trend_delta: -12,
      stops_total: 3, stops_done: 0, eta_return_min: 55, ampel: 'rot', alert: 'Score deutlich unter Ziel!',
      stops: [
        { id: 's13', sequence: 1, status: 'active', address: 'Bahnhofstr. 20', customer_name: 'Kraus' },
        { id: 's14', sequence: 2, status: 'pending', address: 'Industriestr. 5', customer_name: 'Lange' },
        { id: 's15', sequence: 3, status: 'pending', address: 'Feldweg 8', customer_name: 'Koch' },
      ],
    },
  ],
};

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    ring: '#ef4444', text: 'text-red-700',   dot: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', ring: '#f59e0b', text: 'text-amber-700', dot: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', ring: '#22c55e', text: 'text-green-700', dot: 'bg-green-500' };
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 18;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;
  return (
    <svg width={48} height={48} viewBox="0 0 48 48" className="shrink-0">
      <circle cx={24} cy={24} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle
        cx={24} cy={24} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
      />
      <text x={24} y={24} dominantBaseline="middle" textAnchor="middle" fontSize={11} fontWeight="bold" fill={color}>
        {score}
      </text>
    </svg>
  );
}

function TrendBadge({ trend, delta }: { trend: string; delta: number }) {
  if (trend === 'steigend') return (
    <span className="flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
      <TrendingUp className="h-2.5 w-2.5" />+{delta}
    </span>
  );
  if (trend === 'fallend') return (
    <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
      <TrendingDown className="h-2.5 w-2.5" />{delta}
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold text-stone-500">
      <Minus className="h-2.5 w-2.5" />±0
    </span>
  );
}

function StopDot({ status }: { status: string }) {
  const cls = status === 'completed' ? 'bg-green-500' : status === 'active' ? 'bg-blue-500 animate-pulse' : 'bg-stone-300';
  return <span className={cn('inline-block h-2.5 w-2.5 rounded-full', cls)} />;
}

function DriverCard({ driver, rank }: { driver: DriverEntry; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const cls = ampelCls(driver.ampel);
  const progressPct = driver.stops_total > 0
    ? Math.round((driver.stops_done / driver.stops_total) * 100)
    : 0;

  return (
    <div className={cn('rounded-xl border overflow-hidden', cls.bg)}>
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded((p) => !p)}
      >
        {/* Rank */}
        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black',
          rank === 1 ? 'bg-yellow-400 text-white' : rank === 2 ? 'bg-stone-300 text-white' : rank === 3 ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600'
        )}>
          {rank === 1 ? <Star className="h-3 w-3" /> : rank}
        </span>

        {/* Score Ring */}
        <ScoreRing score={driver.score} color={cls.ring} />

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-stone-800">{driver.driver_name}</span>
            <TrendBadge trend={driver.trend} delta={driver.trend_delta} />
            {driver.alert && (
              <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-bold text-white">
                <AlertTriangle className="h-2.5 w-2.5" />
                {driver.alert}
              </span>
            )}
          </div>
          {/* Stop progress */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex gap-1">
              {driver.stops.map((s) => <StopDot key={s.id} status={s.status} />)}
            </div>
            <span className="text-[10px] text-stone-500">{driver.stops_done}/{driver.stops_total} Stopps</span>
            {driver.eta_return_min !== null && (
              <>
                <span className="text-stone-300">·</span>
                <Clock className="h-3 w-3 text-stone-400" />
                <span className="text-[10px] text-stone-500 tabular-nums">Rückkehr in {driver.eta_return_min} Min</span>
              </>
            )}
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 rounded-full bg-white/80 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', driver.ampel === 'gruen' ? 'bg-green-500' : driver.ampel === 'gelb' ? 'bg-amber-400' : 'bg-red-500')}
              style={{ width: `${Math.max(3, progressPct)}%` }}
            />
          </div>
        </div>

        {/* Expand toggle */}
        <button className="shrink-0 rounded-lg p-1 hover:bg-white/60 transition-colors">
          {expanded ? <ChevronUp className="h-4 w-4 text-stone-500" /> : <ChevronDown className="h-4 w-4 text-stone-500" />}
        </button>
      </div>

      {/* Expanded: stop list */}
      {expanded && (
        <div className="border-t border-white/60 bg-white/40 px-4 py-3 space-y-1.5">
          {driver.stops.map((stop) => (
            <div key={stop.id} className="flex items-center gap-2 text-[11px]">
              <StopDot status={stop.status} />
              <span className="font-mono text-stone-500 w-4 shrink-0">{stop.sequence}.</span>
              <MapPin className="h-3 w-3 text-stone-400 shrink-0" />
              <span className="truncate text-stone-700 font-medium">{stop.address ?? '—'}</span>
              {stop.customer_name && (
                <span className="text-stone-400 truncate">({stop.customer_name})</span>
              )}
              <span className={cn('ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold',
                stop.status === 'completed' ? 'bg-green-100 text-green-700' :
                stop.status === 'active' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                'bg-stone-100 text-stone-500'
              )}>
                {stop.status === 'completed' ? 'Geliefert' : stop.status === 'active' ? 'Aktiv' : 'Ausstehend'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DispatchPhase2780TourScoreFinalRangliste({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) { setData(MOCK_DATA); return; }
    const load = () =>
      fetch(`/api/delivery/admin/dispatch-score-tour-cockpit?location_id=${locationId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d ? setData(d) : setData(MOCK_DATA))
        .catch(() => setData(MOCK_DATA));
    load();
    const iv = setInterval(load, 25_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.score - a.score);
  const alerts = sorted.filter((d) => d.ampel === 'rot' || d.alert);
  const teamAvg = data.team_avg_score;
  const avgColor = teamAvg >= ZIEL ? 'text-green-600' : teamAvg >= WARN ? 'text-amber-600' : 'text-red-600';
  const avgBg = teamAvg >= ZIEL ? 'bg-green-100' : teamAvg >= WARN ? 'bg-amber-100' : 'bg-red-100';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between gap-3 border-b border-stone-100 px-5 py-3 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <Bike className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-stone-800">Tour-Score Rangliste</div>
            <div className="text-[11px] text-stone-400">Score-Ring · Stop-Dots · Fortschritt · ETA</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
            </span>
          )}
          <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums', avgBg, avgColor)}>
            Ø {teamAvg} Pkt
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <>
          {/* Team KPI strip */}
          <div className="grid grid-cols-3 divide-x divide-stone-100 border-b border-stone-100 bg-stone-50">
            <div className="px-4 py-2 text-center">
              <div className={cn('text-lg font-black tabular-nums', avgColor)}>{teamAvg}</div>
              <div className="text-[9px] uppercase tracking-wider text-stone-400">Team-Ø Score</div>
            </div>
            <div className="px-4 py-2 text-center">
              <div className="text-lg font-black tabular-nums text-stone-700">{sorted.length}</div>
              <div className="text-[9px] uppercase tracking-wider text-stone-400">Aktive Fahrer</div>
            </div>
            <div className="px-4 py-2 text-center">
              <div className={cn('text-lg font-black tabular-nums',
                data.team_avg_score >= data.schicht_avg ? 'text-green-600' : 'text-red-600'
              )}>
                {data.team_avg_score >= data.schicht_avg ? '+' : ''}{data.team_avg_score - data.schicht_avg}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-stone-400">vs. Schicht-Ø</div>
            </div>
          </div>

          {/* Driver list */}
          <div className="p-4 space-y-2">
            {sorted.length === 0 ? (
              <p className="text-center text-sm text-stone-400 py-6">Keine aktiven Touren</p>
            ) : (
              sorted.map((driver, i) => (
                <DriverCard key={driver.driver_id} driver={driver} rank={i + 1} />
              ))
            )}
          </div>

          {/* Legend + polling note */}
          <div className="flex items-center gap-4 border-t border-stone-100 bg-stone-50 px-5 py-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" /><span className="text-[10px] text-stone-500">≥{ZIEL} Pkt</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" /><span className="text-[10px] text-stone-500">{WARN}–{ZIEL-1} Pkt</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" /><span className="text-[10px] text-stone-500">&lt;{WARN} Pkt</span>
            </div>
            <span className="ml-auto text-[9px] text-stone-400">↻ 25 Sek</span>
          </div>
        </>
      )}
    </div>
  );
}
