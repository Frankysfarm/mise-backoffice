'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Award, ChevronDown, ChevronUp, Loader2, MapPin, Route, Star, Target, TrendingUp } from 'lucide-react';

type TourStop = {
  stopNr: number;
  adresse: string;
  status: 'abgeschlossen' | 'aktiv' | 'ausstehend';
  etaSec?: number;
};

type TourScore = {
  batchId: string;
  fahrerName: string;
  score: number;
  stopsDone: number;
  stopsTotal: number;
  stops: TourStop[];
  distanceKm?: number;
  onTimeRate?: number;
};

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(1, Math.max(0, score / 100));
  const color =
    score >= 80 ? '#16a34a' :
    score >= 60 ? '#d97706' :
    score >= 40 ? '#ea580c' :
    '#dc2626';
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - fill)}
        strokeLinecap="round"
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        fontSize={13} fontWeight="900" fill={color}
        transform={`rotate(90 ${size / 2} ${size / 2})`}
      >
        {Math.round(score)}
      </text>
    </svg>
  );
}

function StopDot({ status }: { status: TourStop['status'] }) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full border-2 shrink-0',
        status === 'abgeschlossen' ? 'bg-matcha-500 border-matcha-500' :
        status === 'aktiv' ? 'bg-amber-400 border-amber-400 animate-pulse' :
        'bg-muted border-border',
      )}
    />
  );
}

function etaLabel(sec?: number): string {
  if (!sec || sec <= 0) return '';
  if (sec < 60) return `<1 Min`;
  return `~${Math.round(sec / 60)} Min`;
}

const MOCK_TOURS: TourScore[] = [
  {
    batchId: 'mock-1', fahrerName: 'Ali K.', score: 87,
    stopsDone: 2, stopsTotal: 4, distanceKm: 6.2, onTimeRate: 0.92,
    stops: [
      { stopNr: 1, adresse: 'Hauptstr. 12', status: 'abgeschlossen' },
      { stopNr: 2, adresse: 'Bahnhofstr. 5', status: 'abgeschlossen' },
      { stopNr: 3, adresse: 'Kirchweg 3', status: 'aktiv', etaSec: 240 },
      { stopNr: 4, adresse: 'Parkstr. 8', status: 'ausstehend', etaSec: 600 },
    ],
  },
  {
    batchId: 'mock-2', fahrerName: 'Maria S.', score: 64,
    stopsDone: 1, stopsTotal: 3, distanceKm: 4.8, onTimeRate: 0.70,
    stops: [
      { stopNr: 1, adresse: 'Marktplatz 1', status: 'abgeschlossen' },
      { stopNr: 2, adresse: 'Rathausgasse 7', status: 'aktiv', etaSec: 90 },
      { stopNr: 3, adresse: 'Lindenallee 22', status: 'ausstehend', etaSec: 420 },
    ],
  },
  {
    batchId: 'mock-3', fahrerName: 'Tobias W.', score: 43,
    stopsDone: 0, stopsTotal: 2, distanceKm: 3.1, onTimeRate: 0.50,
    stops: [
      { stopNr: 1, adresse: 'Schulweg 15', status: 'aktiv', etaSec: 480 },
      { stopNr: 2, adresse: 'Gartenstr. 2', status: 'ausstehend', etaSec: 900 },
    ],
  },
];

export function DispatchPhase1040TourScoreEchtzeitUebersicht({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [tours, setTours] = useState<TourScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [expandedTour, setExpandedTour] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const load = () => {
      if (!locationId) {
        setTours(MOCK_TOURS);
        setLoading(false);
        return;
      }
      fetch(`/api/delivery/admin/overview?location_id=${encodeURIComponent(locationId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          if (d?.active_tours && Array.isArray(d.active_tours)) {
            setTours(d.active_tours);
          } else {
            setTours(MOCK_TOURS);
          }
        })
        .catch(() => { if (!cancelled) setTours(MOCK_TOURS); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };

    load();
    const iv = setInterval(load, 30_000);

    const channel = supabase
      .channel('dispatch-phase1040-batches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, load)
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [locationId]);

  const avgScore = tours.length ? Math.round(tours.reduce((s, t) => s + t.score, 0) / tours.length) : 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Tour-Score Echtzeit
          </span>
          {!loading && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {tours.length} Touren · Ø{avgScore}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t">
          {loading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Touren…
            </div>
          ) : tours.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Keine aktiven Touren</div>
          ) : (
            <div className="divide-y">
              {[...tours].sort((a, b) => b.score - a.score).map((tour) => {
                const isExpanded = expandedTour === tour.batchId;
                const progress = tour.stopsTotal > 0 ? tour.stopsDone / tour.stopsTotal : 0;
                return (
                  <div key={tour.batchId}>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition text-left"
                      onClick={() => setExpandedTour(isExpanded ? null : tour.batchId)}
                    >
                      <ScoreRing score={tour.score} size={44} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold truncate">{tour.fahrerName}</span>
                          {tour.onTimeRate !== undefined && (
                            <span className={cn(
                              'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                              tour.onTimeRate >= 0.85 ? 'bg-matcha-100 text-matcha-700' :
                              tour.onTimeRate >= 0.7 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700',
                            )}>
                              {Math.round(tour.onTimeRate * 100)}% pünktl.
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-matcha-500 rounded-full transition-all"
                              style={{ width: `${progress * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                            {tour.stopsDone}/{tour.stopsTotal} Stopps
                          </span>
                        </div>
                      </div>
                      {tour.distanceKm !== undefined && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                          <Route size={10} />
                          {tour.distanceKm.toFixed(1)} km
                        </div>
                      )}
                      {isExpanded
                        ? <ChevronUp size={14} className="text-muted-foreground shrink-0" />
                        : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1 bg-muted/20">
                        <div className="space-y-1.5">
                          {tour.stops.map((stop) => (
                            <div key={stop.stopNr} className="flex items-center gap-2">
                              <StopDot status={stop.status} />
                              <span className="text-[11px] flex-1 truncate text-muted-foreground">
                                <span className="font-bold text-foreground">#{stop.stopNr}</span>{' '}
                                {stop.adresse}
                              </span>
                              {stop.etaSec !== undefined && stop.status !== 'abgeschlossen' && (
                                <span className="text-[10px] text-amber-600 font-bold tabular-nums shrink-0">
                                  {etaLabel(stop.etaSec)}
                                </span>
                              )}
                              {stop.status === 'abgeschlossen' && (
                                <span className="text-[10px] text-matcha-600 font-bold shrink-0">✓</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary footer */}
          {!loading && tours.length > 0 && (
            <div className="border-t px-4 py-2 flex items-center gap-4 bg-muted/20">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Star size={10} className="text-amber-400" />
                <span>Ø Score: <strong className="text-foreground">{avgScore}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <MapPin size={10} />
                <span>{tours.reduce((s, t) => s + t.stopsTotal, 0)} Stopps gesamt</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <TrendingUp size={10} className="text-matcha-500" />
                <span>{tours.reduce((s, t) => s + t.stopsDone, 0)} abgeschlossen</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
