'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import {
  Zap, TrendingUp, MapPin, Clock, Target, CheckCircle2, AlertTriangle, Route,
} from 'lucide-react';

type BatchStop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    eta_earliest: string | null;
    eta_latest: string | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};

interface Props {
  batches: Batch[];
}

type OptScore = {
  batchId: string;
  driverName: string;
  zone: string | null;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  onTimeStops: number;
  totalStops: number;
  distanceKm: number | null;
  elapsedMin: number;
  etaMin: number;
  status: string;
};

function calcOptScore(batch: Batch, now: number): OptScore {
  const driverName = batch.fahrer
    ? `${batch.fahrer.vorname} ${batch.fahrer.nachname.charAt(0)}.`
    : 'Kein Fahrer';

  const completed = batch.stops.filter((s) => s.geliefert_am);
  const total = batch.stops.length;
  const elapsedMin = batch.startzeit
    ? (now - new Date(batch.startzeit).getTime()) / 60_000
    : 0;
  const etaMin = batch.total_eta_min ?? 30;

  const onTimeStops = completed.filter((s) => {
    if (!s.geliefert_am || !s.order?.eta_latest) return true;
    return new Date(s.geliefert_am) <= new Date(s.order.eta_latest);
  }).length;

  const timeFactor = etaMin > 0 ? Math.max(0, Math.min(1, 1 - (elapsedMin - etaMin) / Math.max(etaMin, 1))) : 0.8;
  const completionFactor = total > 0 ? completed.length / total : 0;
  const onTimeFactor = completed.length > 0 ? onTimeStops / completed.length : 1;

  const raw = timeFactor * 40 + completionFactor * 30 + onTimeFactor * 30;
  const score = Math.min(100, Math.round(raw));
  const grade: 'A' | 'B' | 'C' | 'D' =
    score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';

  return {
    batchId: batch.id,
    driverName,
    zone: batch.zone,
    score,
    grade,
    onTimeStops,
    totalStops: total,
    distanceKm: batch.total_distance_km,
    elapsedMin: Math.round(elapsedMin),
    etaMin,
    status: batch.status,
  };
}

const gradeStyle = {
  A: { ring: 'stroke-matcha-500', text: 'text-matcha-700', bg: 'bg-matcha-50 border-matcha-200' },
  B: { ring: 'stroke-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200'    },
  C: { ring: 'stroke-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200'  },
  D: { ring: 'stroke-red-400',    text: 'text-red-700',    bg: 'bg-red-50 border-red-200'      },
};

function ScoreRing({ score, grade }: { score: number; grade: 'A' | 'B' | 'C' | 'D' }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const style = gradeStyle[grade];

  return (
    <svg className="shrink-0" width={44} height={44} viewBox="0 0 44 44">
      <circle cx={22} cy={22} r={r} fill="none" stroke="currentColor" strokeWidth={3} className="text-gray-100" />
      <circle
        cx={22} cy={22} r={r} fill="none"
        strokeWidth={3}
        strokeDasharray={`${(score / 100) * circ} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        className={style.ring}
      />
      <text x={22} y={22} textAnchor="middle" dominantBaseline="central" className={cn('font-black text-[9px]', style.text)} style={{ fontSize: 9 }}>
        {grade}
      </text>
    </svg>
  );
}

export function DispatchTourOptimizerPanel({ batches }: Props) {
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const activeBatches = batches.filter((b) =>
    ['zusammengestellt', 'unterwegs', 'bestätigt'].includes(b.status),
  );

  const scores = activeBatches
    .map((b) => calcOptScore(b, now))
    .sort((a, b) => b.score - a.score);

  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((s, x) => s + x.score, 0) / scores.length)
    : 0;
  const aCount = scores.filter((s) => s.grade === 'A').length;
  const dCount = scores.filter((s) => s.grade === 'D').length;

  if (scores.length === 0) return null;

  return (
    <Card className="p-3 border rounded-xl shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Zap className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold">Tour-Optimizer</span>
          <span className="text-[10px] font-bold rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5">
            Ø {avgScore}
          </span>
          {dCount > 0 && (
            <span className="text-[10px] font-bold rounded-full bg-red-100 text-red-700 px-2 py-0.5">
              {dCount} kritisch
            </span>
          )}
        </div>
        <Route className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open ? '' : 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            {(['A', 'B', 'C', 'D'] as const).map((g) => {
              const cnt = scores.filter((s) => s.grade === g).length;
              const gs = gradeStyle[g];
              return (
                <div key={g} className={cn('rounded-lg border px-2 py-1.5', gs.bg)}>
                  <div className={cn('text-lg font-black', gs.text)}>{cnt}</div>
                  <div className="text-[9px] font-bold text-muted-foreground">Grade {g}</div>
                </div>
              );
            }).slice(0, 3)}
            <div className={cn('rounded-lg border px-2 py-1.5', gradeStyle['D'].bg)}>
              <div className={cn('text-lg font-black', gradeStyle['D'].text)}>
                {scores.filter((s) => s.grade === 'D').length}
              </div>
              <div className="text-[9px] font-bold text-muted-foreground">Grade D</div>
            </div>
          </div>

          {/* Per-tour rows */}
          <div className="space-y-1.5 mt-2">
            {scores.map((s) => {
              const gs = gradeStyle[s.grade];
              const timeOver = s.elapsedMin > s.etaMin;
              return (
                <div
                  key={s.batchId}
                  className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', gs.bg)}
                >
                  <ScoreRing score={s.score} grade={s.grade} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold truncate">{s.driverName}</span>
                      {s.zone && (
                        <span className="text-[9px] rounded-full border border-current/20 bg-white/60 px-1.5 py-px font-semibold">
                          Zone {s.zone}
                        </span>
                      )}
                      {timeOver && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          +{s.elapsedMin - s.etaMin} Min
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        {s.onTimeStops}/{s.totalStops} pünktlich
                      </span>
                      {s.distanceKm != null && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          {s.distanceKm.toFixed(1)} km
                        </span>
                      )}
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {s.elapsedMin}/{s.etaMin} Min
                      </span>
                    </div>
                  </div>
                  <div className={cn('shrink-0 text-right font-black text-lg tabular-nums', gs.text)}>
                    {s.score}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
