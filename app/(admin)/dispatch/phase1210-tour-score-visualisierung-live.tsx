'use client';

// Phase 1210 — Tour-Score-Visualisierung-Live (Dispatch)
// Live-Board aller aktiven Touren: Score-Ring + Stop-Fortschritt + ETA-Ampel + Fahrer-Info
// Sortiert: Verspätete zuerst, dann nach Score aufsteigend

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Route, Clock, Bike, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';

interface Stop {
  id: string;
  batch_id: string;
  geliefert_am?: string | null;
  [k: string]: unknown;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id?: string | null;
  startzeit?: string | null;
  started_at?: string | null;
  total_eta_min?: number | null;
  zone?: string | null;
  stops?: Stop[];
  [k: string]: unknown;
}

interface Driver {
  employee_id: string;
  employee?: { vorname: string; nachname: string } | null;
  [k: string]: unknown;
}

type Health = 'excellent' | 'good' | 'tight' | 'late' | 'unknown';

const HEALTH_CFG: Record<Health, { bg: string; border: string; text: string; badge: string; label: string; score: number }> = {
  excellent: { bg: 'bg-matcha-50',  border: 'border-matcha-300',  text: 'text-matcha-700',  badge: 'bg-matcha-500 text-white',   label: 'Exzellent', score: 95 },
  good:      { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', badge: 'bg-emerald-400 text-white',  label: 'Gut',       score: 75 },
  tight:     { bg: 'bg-yellow-50',  border: 'border-yellow-300',  text: 'text-yellow-700',  badge: 'bg-yellow-400 text-white',  label: 'Knapp',     score: 50 },
  late:      { bg: 'bg-red-50',     border: 'border-red-300',     text: 'text-red-700',     badge: 'bg-red-500 text-white',     label: 'Spät',      score: 20 },
  unknown:   { bg: 'bg-muted/20',   border: 'border-border',      text: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground', label: 'Unbekannt', score: 50 },
};

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  return (
    <svg width="54" height="54" viewBox="0 0 54 54" className="shrink-0">
      <circle cx="27" cy="27" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle
        cx="27" cy="27" r={r}
        fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${(score / 100) * circ} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 27 27)"
      />
      <text x="27" y="31" textAnchor="middle" fontSize="11" fontWeight="900" fill={color}>
        {score}
      </text>
    </svg>
  );
}

export function DispatchPhase1210TourScoreVisualisierungLive({
  batches,
  drivers,
}: {
  batches: Batch[];
  drivers: Driver[];
}) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();

  const activeBatches = batches.filter(b =>
    ['unterwegs', 'on_route', 'gestartet'].includes(b.status)
  );

  if (activeBatches.length === 0) return null;

  type Row = {
    batch: Batch;
    driverName: string;
    health: Health;
    score: number;
    completedStops: number;
    totalStops: number;
    progressPct: number;
    elapsedMin: number;
    remainMin: number | null;
  };

  const rows: Row[] = activeBatches.map(b => {
    const driver = drivers.find(d => d.employee_id === (b.fahrer_id ?? ''));
    const driverName = driver?.employee
      ? `${driver.employee.vorname} ${driver.employee.nachname[0]}.`
      : 'Fahrer';

    const stops = b.stops ?? [];
    const totalStops = stops.length;
    const completedStops = stops.filter(s => s.geliefert_am).length;
    const progressPct = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

    const startMs = (b.startzeit ?? b.started_at) ? new Date((b.startzeit ?? b.started_at) as string).getTime() : null;
    const elapsedMin = startMs ? Math.floor((now - startMs) / 60_000) : 0;
    const etaMin = b.total_eta_min ?? null;
    const remainMin = etaMin !== null ? Math.max(0, etaMin - elapsedMin) : null;

    let health: Health = 'unknown';
    if (etaMin !== null && totalStops > 0) {
      const timePct = elapsedMin / etaMin;
      const donePct = completedStops / totalStops;
      const delta = timePct - donePct;
      if (delta < -0.1)      health = 'excellent';
      else if (delta < 0.05) health = 'good';
      else if (delta < 0.2)  health = 'tight';
      else                   health = 'late';
    } else if (etaMin === null) {
      health = 'unknown';
    }

    const cfg = HEALTH_CFG[health];
    return { batch: b, driverName, health, score: cfg.score, completedStops, totalStops, progressPct, elapsedMin, remainMin };
  }).sort((a, b) => {
    const order: Health[] = ['late', 'tight', 'unknown', 'good', 'excellent'];
    return order.indexOf(a.health) - order.indexOf(b.health);
  });

  const lateCount = rows.filter(r => r.health === 'late').length;
  const avgScore = Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Tour-Score-Visualisierung Live</span>
          <Badge variant="secondary" className="text-[10px]">{activeBatches.length} Touren</Badge>
          {lateCount > 0 && (
            <span className="text-[10px] rounded-full bg-red-100 border border-red-300 px-2 py-0.5 font-bold text-red-700 animate-pulse">
              {lateCount} verspätet
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-muted-foreground">Ø Score: {avgScore}</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t divide-y">
          {rows.map(row => {
            const cfg = HEALTH_CFG[row.health];
            const scoreColor = row.score >= 80 ? '#22c55e' : row.score >= 55 ? '#eab308' : '#ef4444';
            return (
              <div key={row.batch.id} className={cn('px-4 py-3 flex items-center gap-3', cfg.bg)}>
                {/* Score ring */}
                <ScoreRing score={row.score} color={scoreColor} />

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Bike className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-bold">{row.driverName}</span>
                    </div>
                    {row.batch.zone && (
                      <span className="text-[9px] rounded-full bg-white/70 border px-1.5 py-0.5 font-bold">
                        Zone {row.batch.zone}
                      </span>
                    )}
                    <span className={cn('text-[9px] rounded-full px-2 py-0.5 font-black', cfg.badge)}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${row.progressPct}%`,
                          backgroundColor: scoreColor,
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-bold tabular-nums shrink-0 text-muted-foreground">
                      {row.completedStops}/{row.totalStops} Stopps
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {row.elapsedMin} Min vergangen
                    </span>
                    {row.remainMin !== null && (
                      <span className={cn('font-bold', cfg.text)}>
                        ~{row.remainMin} Min verbleibend
                      </span>
                    )}
                  </div>
                </div>

                {/* Health icon */}
                <div className="shrink-0">
                  {row.health === 'excellent' || row.health === 'good'
                    ? <CheckCircle2 className={cn('h-5 w-5', cfg.text)} />
                    : row.health === 'late'
                    ? <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse" />
                    : <TrendingUp className={cn('h-5 w-5', cfg.text)} />
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
