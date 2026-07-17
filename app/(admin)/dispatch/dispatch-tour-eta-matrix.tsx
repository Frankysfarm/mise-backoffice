'use client';

/**
 * DispatchTourEtaMatrix
 * Echtzeit-ETA-Matrix für alle aktiven Touren.
 * Zeigt Score-Verlauf, Stopp-Fortschritt, Effizienz und Prognose.
 */

import { useEffect, useState, useCallback } from 'react';
import { Route, Clock, TrendingUp, TrendingDown, Minus, MapPin, Bike, CheckCircle2, AlertCircle, BarChart2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStop {
  id: string;
  address: string;
  status: 'done' | 'active' | 'pending';
  eta_min?: number;
}

interface TourRow {
  id: string;
  driver: string;
  vehicle: 'bike' | 'car';
  zone: string;
  score: number;
  score_delta: number;
  stops_done: number;
  stops_total: number;
  elapsed_min: number;
  eta_remaining_min: number;
  on_time: boolean;
  efficiency: number;
  stops: TourStop[];
  forecast_finish_min: number;
}

const MOCK_TOURS: TourRow[] = [
  {
    id: 't1', driver: 'Ahmed K.', vehicle: 'bike', zone: 'Innenstadt',
    score: 94, score_delta: +3, stops_done: 3, stops_total: 5,
    elapsed_min: 22, eta_remaining_min: 14, on_time: true, efficiency: 91,
    forecast_finish_min: 14,
    stops: [
      { id: 's1', address: 'Markt 4', status: 'done' },
      { id: 's2', address: 'Pontstr. 12', status: 'done' },
      { id: 's3', address: 'Siebenbirg. 8', status: 'done' },
      { id: 's4', address: 'Habsburgstr. 7', status: 'active', eta_min: 3 },
      { id: 's5', address: 'Jülicher Str. 22', status: 'pending', eta_min: 11 },
    ],
  },
  {
    id: 't2', driver: 'Lukas M.', vehicle: 'car', zone: 'Burtscheid',
    score: 78, score_delta: -2, stops_done: 1, stops_total: 3,
    elapsed_min: 18, eta_remaining_min: 25, on_time: false, efficiency: 72,
    forecast_finish_min: 28,
    stops: [
      { id: 's6', address: 'Roermonder Str. 15', status: 'done' },
      { id: 's7', address: 'Südstr. 44', status: 'active', eta_min: 7 },
      { id: 's8', address: 'Kaiserplatz 2', status: 'pending', eta_min: 18 },
    ],
  },
  {
    id: 't3', driver: 'Sara P.', vehicle: 'bike', zone: 'Laurensberg',
    score: 88, score_delta: 0, stops_done: 2, stops_total: 4,
    elapsed_min: 31, eta_remaining_min: 19, on_time: true, efficiency: 85,
    forecast_finish_min: 20,
    stops: [
      { id: 's9', address: 'Laurensb. Str. 8', status: 'done' },
      { id: 's10', address: 'Rathausstr. 5', status: 'done' },
      { id: 's11', address: 'Germanstr. 12', status: 'active', eta_min: 4 },
      { id: 's12', address: 'Würselen Weg 1', status: 'pending', eta_min: 15 },
    ],
  },
  {
    id: 't4', driver: 'Marco T.', vehicle: 'car', zone: 'Eilendorf',
    score: 61, score_delta: -5, stops_done: 0, stops_total: 2,
    elapsed_min: 8, eta_remaining_min: 32, on_time: false, efficiency: 58,
    forecast_finish_min: 35,
    stops: [
      { id: 's13', address: 'Eilendorfer Str. 3', status: 'active', eta_min: 12 },
      { id: 's14', address: 'Am Kronenberg 9', status: 'pending', eta_min: 28 },
    ],
  },
];

function ScoreDelta({ delta }: { delta: number }) {
  if (delta > 0) return <span className="flex items-center gap-0.5 text-matcha-600 text-[10px] font-bold"><TrendingUp className="w-3 h-3" />+{delta}</span>;
  if (delta < 0) return <span className="flex items-center gap-0.5 text-red-500 text-[10px] font-bold"><TrendingDown className="w-3 h-3" />{delta}</span>;
  return <span className="flex items-center gap-0.5 text-stone-400 text-[10px]"><Minus className="w-3 h-3" />0</span>;
}

function StopDots({ stops }: { stops: TourStop[] }) {
  return (
    <div className="flex items-center gap-0.5">
      {stops.map(s => (
        <div
          key={s.id}
          className={cn(
            'rounded-full transition-all',
            s.status === 'done' ? 'w-2 h-2 bg-matcha-500' :
            s.status === 'active' ? 'w-2.5 h-2.5 bg-amber-400 ring-2 ring-amber-200 animate-pulse' :
            'w-2 h-2 bg-stone-200',
          )}
          title={s.address}
        />
      ))}
    </div>
  );
}

function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const fill = (score / 100) * c;
  const color = score >= 85 ? '#4ade80' : score >= 65 ? '#fbbf24' : '#f87171';

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${fill} ${c}`} strokeLinecap="round" />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: `rotate(90deg) translate(0, -${size}px)`, transformOrigin: `${size / 2}px ${size / 2}px` }}
        fontSize={10} fontWeight="900" fill={color}>
        {score}
      </text>
    </svg>
  );
}

export function DispatchTourEtaMatrix({ locationId }: { locationId?: string | null }) {
  const [tours] = useState<TourRow[]>(MOCK_TOURS);

  const avgScore = Math.round(tours.reduce((a, t) => a + t.score, 0) / tours.length);
  const onTimeCount = tours.filter(t => t.on_time).length;
  const lateCount = tours.length - onTimeCount;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Route className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xs font-black text-stone-900 uppercase tracking-wide">Tour ETA-Matrix</div>
            <div className="text-[10px] text-stone-400">Live Score + Stopp-Fortschritt</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-right">
          <div>
            <div className="text-sm font-black text-stone-900">{avgScore}</div>
            <div className="text-[9px] text-stone-400">Ø Score</div>
          </div>
          {lateCount > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-600">
              <AlertCircle className="w-2.5 h-2.5" /> {lateCount} spät
            </span>
          )}
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-4 divide-x divide-stone-100 border-b border-stone-100 bg-stone-50">
        {[
          { label: 'Aktive Touren', value: tours.length, color: 'text-stone-800' },
          { label: 'Pünktlich', value: onTimeCount, color: 'text-matcha-700' },
          { label: 'Verspätet', value: lateCount, color: 'text-red-600' },
          { label: 'Ø Effizienz', value: `${Math.round(tours.reduce((a, t) => a + t.efficiency, 0) / tours.length)}%`, color: 'text-blue-700' },
        ].map(kpi => (
          <div key={kpi.label} className="py-2 px-3 text-center">
            <div className={cn('text-sm font-black tabular-nums', kpi.color)}>{kpi.value}</div>
            <div className="text-[9px] text-stone-400 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tour Rows */}
      <div className="divide-y divide-stone-100">
        {tours.map(tour => (
          <div key={tour.id} className={cn(
            'px-4 py-3 flex items-center gap-3',
            !tour.on_time && 'bg-red-50/50',
          )}>
            {/* Score Ring */}
            <div className="shrink-0">
              <ScoreRing score={tour.score} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-stone-900">{tour.driver}</span>
                <span className="text-[9px] rounded-full bg-stone-100 border border-stone-200 px-1.5 py-0.5 font-semibold text-stone-500">
                  {tour.zone}
                </span>
                <ScoreDelta delta={tour.score_delta} />
                {!tour.on_time && (
                  <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-600">
                    <AlertCircle className="w-3 h-3" /> Verspätet
                  </span>
                )}
              </div>

              {/* Stop Dots */}
              <div className="flex items-center gap-2">
                <StopDots stops={tour.stops} />
                <span className="text-[9px] text-stone-400 tabular-nums">
                  {tour.stops_done}/{tour.stops_total} Stopps
                </span>
              </div>

              {/* ETA Info */}
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[9px] text-stone-500">
                  <Clock className="w-2.5 h-2.5" /> {tour.elapsed_min} Min vergangen
                </span>
                <span className={cn('flex items-center gap-1 text-[9px] font-bold', tour.on_time ? 'text-matcha-700' : 'text-red-600')}>
                  ~{tour.eta_remaining_min} Min verbleibend
                </span>
                <span className="flex items-center gap-1 text-[9px] text-stone-400 ml-auto">
                  <BarChart2 className="w-2.5 h-2.5" /> {tour.efficiency}% Effizienz
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-stone-100 bg-stone-50">
        <Zap className="w-3 h-3 text-blue-400" />
        <span className="text-[10px] text-stone-500">
          Prognose: alle Touren in ø {Math.round(tours.reduce((a, t) => a + t.forecast_finish_min, 0) / tours.length)} Min abgeschlossen
        </span>
      </div>
    </div>
  );
}
