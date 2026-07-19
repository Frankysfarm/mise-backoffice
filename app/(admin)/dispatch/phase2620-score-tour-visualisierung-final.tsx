'use client';

/**
 * Phase 2620 — Score + Tour-Visualisierung Final
 *
 * Score-Ring je Fahrer (0–100, Ampel grün/gelb/rot) + farbkodierte Stop-Dots
 * mit Nummern + Tour-Fortschrittsbalken + ETA + expandierbare Stop-Liste +
 * Alert bei Score <60 und überfälligen Stopps. 25-Sek-Polling.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, MapPin, Route as RouteIcon, Target, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  order_id: string;
  sequence: number;
  address: string | null;
  eta_min: number | null;
  completed_at: string | null;
  status: 'done' | 'active' | 'pending';
}

interface DriverTour {
  driver_id: string;
  driver_name: string;
  score: number;
  stops: Stop[];
  current_stop_seq: number;
  eta_finish_min: number | null;
  progress_pct: number;
  is_delayed: boolean;
}

interface Payload {
  tours: DriverTour[];
  team_avg_score: number;
  alert_count: number;
}

function ScoreRing({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeOpacity="0.15" />
      <circle
        cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3.5"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 22 22)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

function StopDot({ stop, isCurrent }: { stop: Stop; isCurrent: boolean }) {
  const cls =
    stop.status === 'done' ? 'bg-matcha-500 text-white' :
    isCurrent ? 'bg-amber-500 text-white animate-pulse' :
    'bg-muted text-muted-foreground';
  return (
    <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold shrink-0 ring-1 ring-border/20', cls)}>
      {stop.sequence}
    </span>
  );
}

export function DispatchPhase2620ScoreTourVisualisierungFinal({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Payload | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/dispatch?type=tour_scores${locationId ? `&location_id=${locationId}` : ''}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json?.tours) setData(json);
    } catch { /* silent */ }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 25_000); return () => clearInterval(iv); }, [load]);

  const tours = data?.tours ?? [];
  if (tours.length === 0) return null;

  const lowScore = tours.filter(t => t.score < 60);
  const teamAvg = data?.team_avg_score ?? Math.round(tours.reduce((s, t) => s + t.score, 0) / tours.length);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <RouteIcon className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-xs font-bold uppercase tracking-wider flex-1">
          Score &amp; Tour-Visualisierung Final · {tours.length} Touren
        </span>
        {lowScore.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-bold text-white animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" /> {lowScore.length} Alert
          </span>
        )}
        <span className={cn('text-[10px] font-bold', teamAvg >= 80 ? 'text-matcha-600' : teamAvg >= 60 ? 'text-amber-600' : 'text-red-600')}>
          Team Ø {teamAvg}
        </span>
      </div>

      <div className="divide-y divide-border/30">
        {tours.sort((a, b) => a.score - b.score).map(tour => {
          const isOpen = expanded.has(tour.driver_id);
          const scoreColor = tour.score >= 80 ? 'text-matcha-700' : tour.score >= 60 ? 'text-amber-700' : 'text-red-700';
          return (
            <div key={tour.driver_id} className={cn('px-3 py-2', tour.score < 60 && 'bg-red-50/40 dark:bg-red-950/10')}>
              <div className="flex items-center gap-2">
                <ScoreRing score={tour.score} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={cn('text-[11px] font-bold', scoreColor)}>{tour.driver_name}</span>
                    {tour.is_delayed && <AlertTriangle className="h-3 w-3 text-red-500" />}
                    {tour.eta_finish_min != null && (
                      <span className="ml-auto text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" /> Fertig ~{tour.eta_finish_min} Min
                      </span>
                    )}
                  </div>
                  {/* Stop Dots */}
                  <div className="flex items-center gap-1 flex-wrap mb-1.5">
                    {tour.stops.map(s => (
                      <StopDot key={s.id} stop={s} isCurrent={s.sequence === tour.current_stop_seq} />
                    ))}
                  </div>
                  {/* Fortschrittsbalken */}
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', tour.score >= 80 ? 'bg-matcha-500' : tour.score >= 60 ? 'bg-amber-400' : 'bg-red-500')}
                      style={{ width: `${tour.progress_pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[8px] text-muted-foreground">{tour.progress_pct}% abgeschlossen</span>
                    <button
                      onClick={() => setExpanded(prev => {
                        const n = new Set(prev);
                        if (n.has(tour.driver_id)) n.delete(tour.driver_id); else n.add(tour.driver_id);
                        return n;
                      })}
                      className="text-[8px] text-muted-foreground flex items-center gap-0.5 hover:text-foreground"
                    >
                      {isOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                      Stopps
                    </button>
                  </div>
                </div>
              </div>

              {/* Expandierbare Stop-Liste */}
              {isOpen && (
                <div className="mt-2 ml-11 space-y-1">
                  {tour.stops.map(s => (
                    <div key={s.id} className={cn('flex items-center gap-2 rounded-md px-2 py-1 text-[9px]',
                      s.status === 'done' ? 'bg-matcha-50 dark:bg-matcha-950/20' :
                      s.sequence === tour.current_stop_seq ? 'bg-amber-50 dark:bg-amber-950/20' :
                      'bg-muted/30')}>
                      <StopDot stop={s} isCurrent={s.sequence === tour.current_stop_seq} />
                      <span className="flex-1 truncate">{s.address ?? `Stopp ${s.sequence}`}</span>
                      {s.eta_min != null && !s.completed_at && (
                        <span className="text-muted-foreground shrink-0">~{s.eta_min} Min</span>
                      )}
                      {s.status === 'done' && <CheckCircle2 className="h-3 w-3 text-matcha-500 shrink-0" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-3 py-1.5 border-t border-border/50 flex items-center gap-3">
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-matcha-500 inline-block" /> ≥80
          <span className="h-2 w-2 rounded-full bg-amber-400 inline-block ml-1" /> 60–79
          <span className="h-2 w-2 rounded-full bg-red-500 inline-block ml-1" /> &lt;60
        </div>
        <span className="ml-auto text-[9px] text-muted-foreground">25-Sek-Update</span>
      </div>
    </div>
  );
}
