'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, MapPin, Navigation, AlertTriangle } from 'lucide-react';

interface TourStop {
  geliefert_am: string | null;
  reihenfolge: number;
}

interface Tour {
  id: string;
  fahrerId: string;
  fahrerName: string;
  startzeit: string | null;
  totalEtaMin: number | null;
  stopsGesamt: number;
  stopsFertig: number;
  zone: string | null;
  lastLat: number | null;
  lastLng: number | null;
}

function useTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN((n) => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);
}

function getReturnSec(tour: Tour): number | null {
  if (!tour.startzeit || tour.totalEtaMin == null) return null;
  const startMs = new Date(tour.startzeit).getTime();
  const etaMs = startMs + tour.totalEtaMin * 60_000;
  const remainMs = etaMs - Date.now();
  return Math.floor(remainMs / 1000);
}

function formatCountdown(sec: number): string {
  if (sec < 0) {
    const abs = Math.abs(sec);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return `-${m}:${String(s).padStart(2, '0')}`;
  }
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function urgencyFromSec(sec: number | null): 'arriving' | 'soon' | 'en-route' | 'overdue' {
  if (sec === null) return 'en-route';
  if (sec < -120) return 'overdue';
  if (sec < 300) return 'arriving';
  if (sec < 900) return 'soon';
  return 'en-route';
}

interface Props {
  tours: Tour[];
}

export function DispatchTourRueckkehrBoard({ tours }: Props) {
  useTick();
  if (tours.length === 0) return null;

  const sorted = [...tours].sort((a, b) => {
    const ra = getReturnSec(a) ?? 99999;
    const rb = getReturnSec(b) ?? 99999;
    return ra - rb;
  });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-white">
        <Navigation size={14} className="text-muted-foreground" />
        <span className="text-xs font-black uppercase tracking-wider flex-1">Tour-Rückkehr Board</span>
        <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {tours.length} aktiv
        </span>
      </div>

      <div className="divide-y divide-border">
        {sorted.map((tour) => {
          const returnSec = getReturnSec(tour);
          const urgency = urgencyFromSec(returnSec);
          const progressPct = tour.stopsGesamt > 0
            ? Math.round((tour.stopsFertig / tour.stopsGesamt) * 100)
            : 0;

          const bgClass =
            urgency === 'overdue' ? 'bg-red-50/70' :
            urgency === 'arriving' ? 'bg-amber-50/50' :
            urgency === 'soon' ? 'bg-blue-50/30' : '';

          const countdownColor =
            urgency === 'overdue' ? 'text-red-600 animate-pulse' :
            urgency === 'arriving' ? 'text-amber-600' :
            urgency === 'soon' ? 'text-blue-600' : 'text-muted-foreground';

          const icon =
            urgency === 'overdue' ? <AlertTriangle size={14} className="text-red-500 animate-pulse shrink-0" /> :
            urgency === 'arriving' ? <Bike size={14} className="text-amber-500 animate-bounce shrink-0" /> :
            <Bike size={14} className="text-blue-500 shrink-0" />;

          return (
            <div key={tour.id} className={cn('px-4 py-3 transition-colors', bgClass)}>
              <div className="flex items-center gap-3">
                {icon}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground truncate">{tour.fahrerName}</span>
                    {tour.zone && (
                      <span className="text-[10px] font-semibold bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 shrink-0">
                        {tour.zone}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          progressPct === 100 ? 'bg-emerald-500' : 'bg-blue-400',
                        )}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {tour.stopsFertig}/{tour.stopsGesamt} Stopps
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                  {returnSec !== null ? (
                    <>
                      <span className={cn('text-base font-black tabular-nums font-mono', countdownColor)}>
                        {formatCountdown(returnSec)}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {urgency === 'overdue' ? 'überfällig' : urgency === 'arriving' ? 'kommt gleich' : 'Rückkehr'}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">–</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
