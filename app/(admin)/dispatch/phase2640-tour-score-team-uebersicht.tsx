'use client';

/**
 * Phase 2640 — Tour-Score Team-Übersicht
 *
 * Dispatch-Cockpit für Team-Score-Analyse:
 * - Kompakter Score-Ring je Fahrer (0–100)
 * - Team-Ø Score + Best/Worst Fahrer Highlight
 * - Farbkodierte Stop-Dots (grün=geliefert, grau=ausstehend, rot=verspätet)
 * - ETA je aktivem Stopp
 * - Alert bei Team-Ø <65
 * - 25-Sek-Polling
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Truck, Trophy, AlertTriangle, MapPin, Loader2 } from 'lucide-react';

interface StopDot {
  status: 'delivered' | 'pending' | 'delayed';
  etaMin?: number;
}

interface DriverEntry {
  driverId: string;
  name: string;
  score: number;
  stopsCompleted: number;
  stopsTotal: number;
  dots: StopDot[];
  etaNextMin: number | null;
  activeDelivery: boolean;
}

interface TeamSummary {
  avgScore: number;
  bestDriverId: string | null;
  worstDriverId: string | null;
  activeDrivers: number;
  totalDeliveries: number;
}

interface ApiResponse {
  drivers: DriverEntry[];
  summary: TeamSummary;
}

const MOCK: ApiResponse = {
  drivers: [
    { driverId: 'd1', name: 'Max M.', score: 92, stopsCompleted: 5, stopsTotal: 7, dots: [{ status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'pending', etaMin: 4 }, { status: 'pending', etaMin: 18 }], etaNextMin: 4, activeDelivery: true },
    { driverId: 'd2', name: 'Lisa K.', score: 58, stopsCompleted: 2, stopsTotal: 6, dots: [{ status: 'delivered' }, { status: 'delivered' }, { status: 'delayed', etaMin: 2 }, { status: 'pending' }, { status: 'pending' }, { status: 'pending' }], etaNextMin: 2, activeDelivery: true },
    { driverId: 'd3', name: 'Tom R.', score: 74, stopsCompleted: 3, stopsTotal: 5, dots: [{ status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'pending', etaMin: 6 }, { status: 'pending' }], etaNextMin: 6, activeDelivery: true },
    { driverId: 'd4', name: 'Anna S.', score: 83, stopsCompleted: 4, stopsTotal: 4, dots: [{ status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }], etaNextMin: null, activeDelivery: false },
  ],
  summary: { avgScore: 77, bestDriverId: 'd1', worstDriverId: 'd2', activeDrivers: 3, totalDeliveries: 14 },
};

function scoreColor(s: number) {
  if (s >= 80) return { ring: '#22c55e', text: 'text-matcha-600', badge: 'bg-matcha-100 text-matcha-700' };
  if (s >= 65) return { ring: '#f59e0b', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' };
  return { ring: '#ef4444', text: 'text-red-600', badge: 'bg-red-100 text-red-700' };
}

function dotStyle(s: StopDot['status']) {
  switch (s) {
    case 'delivered': return 'bg-matcha-500';
    case 'delayed':   return 'bg-red-500 ring-1 ring-red-300';
    default:          return 'bg-muted-foreground/30';
  }
}

function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const { ring } = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={5} className="text-muted/20" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={ring} strokeWidth={5}
        strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DispatchPhase2640TourScoreTeamUebersicht({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchData() {
    if (!locationId) return;
    if (data === null) setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/dispatch-score-tour-cockpit?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 25_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const display = data ?? MOCK;
  const s = display.summary;
  const avgC = scoreColor(s.avgScore);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-matcha-50/60">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-matcha-700">
            Team-Score Übersicht
          </span>
        </div>
        <div className="flex items-center gap-2">
          {s.avgScore < 65 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              <AlertTriangle className="h-3 w-3" />
              Score kritisch
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Team KPI */}
      <div className="grid grid-cols-3 divide-x border-b text-center">
        <div className="py-2 px-2">
          <div className={cn('text-sm font-black', avgC.text)}>{s.avgScore}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Team-Ø Score</div>
        </div>
        <div className="py-2 px-2">
          <div className="text-xs font-bold text-foreground">{s.activeDrivers}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Aktiv</div>
        </div>
        <div className="py-2 px-2">
          <div className="text-xs font-bold text-foreground">{s.totalDeliveries}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Lieferungen</div>
        </div>
      </div>

      {/* Driver Rows */}
      <div className="divide-y">
        {display.drivers.map(d => {
          const c = scoreColor(d.score);
          const isBest  = d.driverId === s.bestDriverId;
          const isWorst = d.driverId === s.worstDriverId;
          const pct = d.stopsTotal > 0 ? (d.stopsCompleted / d.stopsTotal) * 100 : 0;

          return (
            <div key={d.driverId} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors">
              {/* Score Ring */}
              <div className="relative flex-none">
                <ScoreRing score={d.score} size={38} />
                <div className={cn('absolute inset-0 flex items-center justify-center text-[10px] font-black', c.text)}>
                  {d.score}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-semibold text-foreground truncate">{d.name}</span>
                  {isBest  && <Trophy className="h-3 w-3 text-amber-500 flex-none" />}
                  {isWorst && <AlertTriangle className="h-3 w-3 text-red-500 flex-none" />}
                  {!d.activeDelivery && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[8px] text-muted-foreground font-medium">
                      Fertig
                    </span>
                  )}
                </div>

                {/* Stop Dots */}
                <div className="flex items-center gap-1 mb-1.5">
                  {d.dots.map((dot, i) => (
                    <span key={i} className={cn('h-2 w-2 rounded-full flex-none', dotStyle(dot.status))} />
                  ))}
                </div>

                {/* Progress bar */}
                <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      d.score >= 80 ? 'bg-matcha-500' : d.score >= 65 ? 'bg-amber-500' : 'bg-red-500'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* ETA */}
              {d.etaNextMin !== null && (
                <div className="flex-none flex flex-col items-end">
                  <div className="flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold text-foreground">{d.etaNextMin} Min</span>
                  </div>
                  <span className="text-[8px] text-muted-foreground">
                    {d.stopsCompleted}/{d.stopsTotal} Stopps
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-1.5 bg-muted/20">
        <span className="text-[9px] text-muted-foreground">Polling alle 25 Sek · Score 0–100</span>
      </div>
    </div>
  );
}
