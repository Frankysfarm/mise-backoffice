'use client';

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Route, Clock, TrendingUp, CheckCircle2, AlertTriangle, Bike, MapPin, Zap } from 'lucide-react';

type Stop = {
  id: string;
  completed_at?: string | null;
  sequence?: number | null;
};

type Batch = {
  id: string;
  started_at?: string | null;
  zone?: string | null;
  driver_id?: string | null;
  status?: string | null;
  stops?: Stop[];
  fahrer?: { vorname: string; nachname: string } | null;
  driver?: { vorname: string; nachname: string } | null;
};

type ScoreTier = 'elite' | 'gut' | 'ok' | 'schlecht';

function computeTourScore(batch: Batch): { score: number; tier: ScoreTier; breakdown: Record<string, number> } {
  const stops = batch.stops ?? [];
  const total = stops.length;
  const completed = stops.filter(s => s.completed_at).length;

  const completionRate = total > 0 ? completed / total : 0;
  const completionScore = Math.round(completionRate * 40);

  let speedScore = 20;
  if (batch.started_at) {
    const elapsedMin = (Date.now() - new Date(batch.started_at).getTime()) / 60_000;
    const stopsPerHour = completed / Math.max(elapsedMin / 60, 0.1);
    if (stopsPerHour >= 6) speedScore = 30;
    else if (stopsPerHour >= 4) speedScore = 25;
    else if (stopsPerHour >= 2) speedScore = 20;
    else speedScore = 10;
  }

  const sequenceScore = stops.every(s => s.sequence !== null) ? 20 : 15;
  const activeScore = batch.status === 'unterwegs' || batch.status === 'on_route' ? 10 : 5;

  const score = Math.min(100, completionScore + speedScore + sequenceScore + activeScore);
  const tier: ScoreTier = score >= 85 ? 'elite' : score >= 65 ? 'gut' : score >= 45 ? 'ok' : 'schlecht';

  return {
    score,
    tier,
    breakdown: { Abschlussrate: completionScore, Tempo: speedScore, Sequenz: sequenceScore, Status: activeScore },
  };
}

const TIER_STYLE: Record<ScoreTier, { bg: string; border: string; badge: string; label: string; barColor: string }> = {
  elite:    { bg: 'bg-matcha-50',  border: 'border-matcha-200',  badge: 'bg-matcha-600 text-white',     label: 'Elite',    barColor: 'bg-matcha-500' },
  gut:      { bg: 'bg-blue-50',    border: 'border-blue-200',    badge: 'bg-blue-500 text-white',       label: 'Gut',      barColor: 'bg-blue-500' },
  ok:       { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-400 text-white',      label: 'OK',       barColor: 'bg-amber-400' },
  schlecht: { bg: 'bg-red-50',     border: 'border-red-200',     badge: 'bg-red-500 text-white',        label: 'Schwach',  barColor: 'bg-red-400' },
};

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-700', color)}
        style={{ width: `${Math.max(4, value)}%` }}
      />
    </div>
  );
}

function TourStopTimeline({ stops }: { stops: Stop[] }) {
  if (stops.length === 0) return null;
  const sorted = [...stops].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  return (
    <div className="flex items-center gap-1 mt-2 flex-wrap">
      {sorted.map((stop, i) => (
        <div key={stop.id} className="flex items-center gap-0.5">
          {i > 0 && <div className="w-3 h-px bg-border" />}
          <div className={cn(
            'h-4 w-4 rounded-full border-2 flex items-center justify-center text-[8px] font-black',
            stop.completed_at
              ? 'bg-matcha-500 border-matcha-600 text-white'
              : 'bg-white border-border text-muted-foreground',
          )}>
            {i + 1}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DispatchPhase692TourScoreVisualisierung({ batches }: { batches: Batch[] }) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const activeBatches = batches.filter(b =>
    ['zugewiesen', 'pickup', 'unterwegs', 'assigned', 'at_restaurant', 'on_route'].includes(b.status ?? ''),
  );

  if (activeBatches.length === 0) return null;

  const scored = activeBatches
    .map(b => ({ batch: b, ...computeTourScore(b) }))
    .sort((a, b) => b.score - a.score);

  const avgScore = Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length);
  const eliteCount = scored.filter(r => r.tier === 'elite').length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Phase 692 · Tour-Score-Visualisierung
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[9px] font-black',
            avgScore >= 80 ? 'bg-matcha-500 text-white' : avgScore >= 60 ? 'bg-amber-400 text-white' : 'bg-red-500 text-white',
          )}>
            Ø {avgScore} Pts
          </span>
          {eliteCount > 0 && (
            <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[9px] font-black text-yellow-900">
              {eliteCount}× Elite
            </span>
          )}
          <Badge variant="secondary" className="text-[9px]">{activeBatches.length} Touren</Badge>
        </div>
      </button>

      {open && (
        <div className="border-t divide-y">
          {scored.map(({ batch, score, tier, breakdown }) => {
            const style = TIER_STYLE[tier];
            const stops = batch.stops ?? [];
            const completed = stops.filter(s => s.completed_at).length;
            const driverName = batch.fahrer
              ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}`
              : batch.driver
              ? `${batch.driver.vorname} ${batch.driver.nachname}`
              : 'Fahrer';
            const elapsedMin = batch.started_at
              ? Math.round((Date.now() - new Date(batch.started_at).getTime()) / 60_000)
              : null;

            return (
              <div key={batch.id} className={cn('px-4 py-3', style.bg, style.border.replace('border-', 'border-l-4 border-l-'))}>
                {/* Top row */}
                <div className="flex items-center gap-2 mb-2">
                  {/* Score dial */}
                  <div className="relative shrink-0 h-10 w-10">
                    <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
                      <circle
                        cx="18" cy="18" r="14" fill="none"
                        stroke={tier === 'elite' ? '#3d7a4f' : tier === 'gut' ? '#3b82f6' : tier === 'ok' ? '#f59e0b' : '#ef4444'}
                        strokeWidth="3" strokeLinecap="round"
                        strokeDasharray={`${(score / 100) * 87.96} 87.96`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black tabular-nums">
                      {score}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold">{driverName}</span>
                      {batch.zone && (
                        <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold">
                          Zone {batch.zone}
                        </span>
                      )}
                      <Badge className={cn('text-[9px] font-black px-2 py-0', style.badge)}>
                        {style.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{completed}/{stops.length} Stops</span>
                      {elapsedMin !== null && <span>{elapsedMin} Min aktiv</span>}
                    </div>
                  </div>
                </div>

                {/* Score bar breakdown */}
                <div className="space-y-1 mb-2">
                  {Object.entries(breakdown).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground w-20 shrink-0">{key}</span>
                      <ScoreBar value={val} color={style.barColor} />
                      <span className="text-[9px] font-bold tabular-nums w-5 text-right">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Stop timeline */}
                <TourStopTimeline stops={stops} />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
