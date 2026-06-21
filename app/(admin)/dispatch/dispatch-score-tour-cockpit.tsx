'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import {
  AlertTriangle, Award, Bike, CheckCircle2, ChevronDown, ChevronUp,
  Clock, MapPin, Route, Star, Target, TrendingUp, Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';

interface ScoreBreakdown {
  punctuality: number;
  speed: number;
  rating: number;
  acceptance: number;
  efficiency: number;
}

interface TourStop {
  stopIndex: number;
  orderNumber: string;
  customerName: string;
  address: string;
  etaMin: number | null;
  status: 'pending' | 'arrived' | 'delivered' | 'skipped';
  distKm: number | null;
}

interface DriverTourScore {
  driverId: string;
  driverName: string;
  scoreTotal: number;
  scoreBreakdown: ScoreBreakdown;
  activeTourId: string | null;
  tourStops: TourStop[];
  activeDeliveries: number;
  completedToday: number;
  earnedToday: number;
  onTimeRatePct: number;
  avgDeliveryMin: number;
  status: 'verfügbar' | 'unterwegs' | 'pause' | 'offline';
}

interface Props {
  drivers: DriverTourScore[];
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 85 ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : score >= 70 ? 'bg-matcha-100 text-matcha-700 border-matcha-200'
    : score >= 55 ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-red-100 text-red-700 border-red-200';

  const icon = score >= 85 ? <Star className="h-3 w-3 fill-current" />
    : score >= 70 ? <TrendingUp className="h-3 w-3" />
    : score >= 55 ? <AlertTriangle className="h-3 w-3" />
    : <AlertTriangle className="h-3 w-3" />;

  return (
    <div className={cn('flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-black', color)}>
      {icon}
      {score}
    </div>
  );
}

function ScoreRadar({ breakdown }: { breakdown: ScoreBreakdown }) {
  const data = [
    { subject: 'Pünktl.', value: breakdown.punctuality },
    { subject: 'Tempo', value: breakdown.speed },
    { subject: 'Bewert.', value: breakdown.rating },
    { subject: 'Annahme', value: breakdown.acceptance },
    { subject: 'Effizienz', value: breakdown.efficiency },
  ];
  return (
    <ResponsiveContainer width="100%" height={120}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#6b7280' }} />
        <Radar
          dataKey="value"
          stroke="#5f9b4e"
          fill="#5f9b4e"
          fillOpacity={0.25}
          strokeWidth={1.5}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 8 }}
          formatter={(v: number) => [`${v}`, 'Score']}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

const STOP_STATUS_STYLE: Record<TourStop['status'], { dot: string; label: string }> = {
  pending: { dot: 'bg-gray-300', label: 'Ausstehend' },
  arrived: { dot: 'bg-amber-400 animate-pulse', label: 'Angekommen' },
  delivered: { dot: 'bg-green-500', label: 'Geliefert' },
  skipped: { dot: 'bg-red-400', label: 'Übersprungen' },
};

function TourTimeline({ stops }: { stops: TourStop[] }) {
  if (stops.length === 0) return (
    <div className="text-[11px] text-muted-foreground py-2 text-center">Keine Tour aktiv</div>
  );
  return (
    <div className="space-y-1.5">
      {stops.map((stop, i) => {
        const { dot } = STOP_STATUS_STYLE[stop.status];
        const isDone = stop.status === 'delivered' || stop.status === 'skipped';
        const isCurrent = stop.status === 'arrived';
        return (
          <div key={i} className={cn(
            'flex items-start gap-2.5 relative',
            isDone && 'opacity-60',
          )}>
            {/* Vertical line */}
            {i < stops.length - 1 && (
              <div className="absolute left-[7px] top-4 bottom-0 w-px bg-gray-200" />
            )}
            {/* Dot */}
            <div className={cn('h-3.5 w-3.5 rounded-full mt-0.5 shrink-0 ring-2 ring-white', dot)} />
            {/* Content */}
            <div className={cn('flex-1 min-w-0 pb-1.5', isCurrent && 'font-bold')}>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-foreground truncate">
                  {stop.orderNumber && <span className="text-muted-foreground">#{stop.orderNumber} · </span>}
                  {stop.customerName}
                </span>
                {stop.etaMin != null && stop.status === 'pending' && (
                  <span className="text-[10px] text-muted-foreground shrink-0">~{stop.etaMin} Min</span>
                )}
                {stop.status === 'delivered' && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                )}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {stop.address}
                {stop.distKm != null && (
                  <span className="ml-1 text-matcha-600 font-medium">
                    {stop.distKm < 1 ? `${Math.round(stop.distKm * 1000)} m` : `${stop.distKm.toFixed(1)} km`}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const STATUS_BADGE: Record<DriverTourScore['status'], { label: string; cls: string }> = {
  verfügbar: { label: 'Verfügbar', cls: 'bg-green-100 text-green-700 border-green-200' },
  unterwegs: { label: 'Unterwegs', cls: 'bg-matcha-100 text-matcha-700 border-matcha-200' },
  pause: { label: 'Pause', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  offline: { label: 'Offline', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

function DriverCard({ driver }: { driver: DriverTourScore }) {
  const [expanded, setExpanded] = useState(false);
  const statusBadge = STATUS_BADGE[driver.status];

  return (
    <Card className="overflow-hidden">
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="h-10 w-10 rounded-full bg-matcha-100 flex items-center justify-center shrink-0">
          <Bike className="h-5 w-5 text-matcha-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground truncate">{driver.driverName}</span>
            <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-bold', statusBadge.cls)}>
              {statusBadge.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
            <span className="flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3" /> {driver.completedToday} heute
            </span>
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" /> ⌀ {Math.round(driver.avgDeliveryMin)} Min
            </span>
            <span className="flex items-center gap-0.5">
              <Target className="h-3 w-3" /> {Math.round(driver.onTimeRatePct)}% pünktl.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ScoreBadge score={driver.scoreTotal} />
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t">
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
            {/* Score radar */}
            <div className="p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Score Analyse
              </div>
              <ScoreRadar breakdown={driver.scoreBreakdown} />
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  { key: 'Pünktl.', val: driver.scoreBreakdown.punctuality },
                  { key: 'Tempo', val: driver.scoreBreakdown.speed },
                  { key: 'Rating', val: driver.scoreBreakdown.rating },
                  { key: 'Annahme', val: driver.scoreBreakdown.acceptance },
                  { key: 'Effizienz', val: driver.scoreBreakdown.efficiency },
                  { key: 'Verdienst', val: null, eur: driver.earnedToday },
                ].map(({ key, val, eur: e }) => (
                  <div key={key} className="rounded-lg bg-muted/50 p-1.5 text-center">
                    <div className="text-[9px] text-muted-foreground">{key}</div>
                    <div className="text-xs font-black text-foreground tabular-nums">
                      {e != null ? euro(e) : val != null ? val : '–'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tour timeline */}
            <div className="p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Route className="h-3 w-3" /> Tour Verlauf
              </div>
              <TourTimeline stops={driver.tourStops} />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export function DispatchScoreTourCockpit({ drivers }: Props) {
  const [sortBy, setSortBy] = useState<'score' | 'deliveries' | 'ontime'>('score');

  const sorted = [...drivers].sort((a, b) => {
    if (sortBy === 'score') return b.scoreTotal - a.scoreTotal;
    if (sortBy === 'deliveries') return b.completedToday - a.completedToday;
    return b.onTimeRatePct - a.onTimeRatePct;
  });

  const activeCount = drivers.filter(d => d.status === 'unterwegs').length;
  const avgScore = drivers.length > 0
    ? Math.round(drivers.reduce((s, d) => s + d.scoreTotal, 0) / drivers.length)
    : 0;
  const topDriver = drivers.length > 0
    ? drivers.reduce((best, d) => d.scoreTotal > best.scoreTotal ? d : best)
    : null;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-matcha-50 border border-matcha-100 p-3 text-center">
          <div className="text-lg font-black text-matcha-700 tabular-nums">{activeCount}</div>
          <div className="text-[10px] text-matcha-600 font-medium mt-0.5 flex items-center justify-center gap-1">
            <Bike className="h-3 w-3" /> Unterwegs
          </div>
        </div>
        <div className="rounded-xl bg-white border p-3 text-center">
          <div className="text-lg font-black text-foreground tabular-nums">{avgScore}</div>
          <div className="text-[10px] text-muted-foreground font-medium mt-0.5 flex items-center justify-center gap-1">
            <Zap className="h-3 w-3" /> ⌀ Score
          </div>
        </div>
        {topDriver && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
            <div className="text-sm font-black text-amber-700 truncate">{topDriver.driverName.split(' ')[0]}</div>
            <div className="text-[10px] text-amber-600 font-medium mt-0.5 flex items-center justify-center gap-1">
              <Award className="h-3 w-3" /> Top Score
            </div>
          </div>
        )}
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground font-medium">Sortierung:</span>
        {([
          { key: 'score', label: 'Score' },
          { key: 'deliveries', label: 'Lieferungen' },
          { key: 'ontime', label: 'Pünktlichkeit' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-bold transition-all',
              sortBy === key
                ? 'bg-matcha-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Driver cards */}
      <div className="space-y-2.5">
        {sorted.length === 0 ? (
          <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
            <MapPin className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            Keine Fahrer verfügbar
          </div>
        ) : (
          sorted.map(driver => <DriverCard key={driver.driverId} driver={driver} />)
        )}
      </div>
    </div>
  );
}
