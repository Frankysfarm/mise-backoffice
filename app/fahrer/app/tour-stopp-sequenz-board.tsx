'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Clock, CheckCircle2, Navigation, AlertTriangle, ChevronRight } from 'lucide-react';

type TourStop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
  } | null;
};

interface Props {
  stops: TourStop[];
  currentStopIndex?: number;
}

function formatEta(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function getStopStatus(
  stop: TourStop,
  index: number,
  currentIdx: number,
  now: number,
): 'done' | 'active' | 'upcoming' | 'late' {
  if (stop.geliefert_am) return 'done';
  if (index === currentIdx) {
    if (stop.order?.eta_latest && now > new Date(stop.order.eta_latest).getTime()) return 'late';
    return 'active';
  }
  return 'upcoming';
}

const statusStyles = {
  done:     { dot: 'bg-matcha-500', line: 'bg-matcha-300', card: '', label: 'Geliefert' },
  active:   { dot: 'bg-blue-500 animate-pulse', line: 'bg-gray-200', card: 'ring-2 ring-blue-400 bg-blue-50', label: 'Aktuell' },
  upcoming: { dot: 'bg-gray-300', line: 'bg-gray-100', card: '', label: 'Ausstehend' },
  late:     { dot: 'bg-red-500 animate-pulse', line: 'bg-gray-200', card: 'ring-2 ring-red-400 bg-red-50', label: 'Verspätet' },
};

export function TourStoppSequenzBoard({ stops, currentStopIndex = 0 }: Props) {
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const completedCount = sorted.filter((s) => s.geliefert_am).length;
  const totalCount = sorted.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const nextStop = sorted.find((s) => !s.geliefert_am);

  if (sorted.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-bold">Tour-Stopps</span>
          <span className="text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">
            {completedCount}/{totalCount}
          </span>
        </div>
        <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', open ? 'rotate-90' : '')} />
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-2">
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] text-muted-foreground">{completedCount} erledigt</span>
          <span className="text-[9px] text-muted-foreground">{totalCount - completedCount} ausstehend</span>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-3 space-y-0">
          {sorted.map((stop, idx) => {
            const status = getStopStatus(stop, idx, currentStopIndex, now);
            const style = statusStyles[status];
            const isLast = idx === sorted.length - 1;
            const etaWindow =
              stop.order?.eta_earliest && stop.order?.eta_latest
                ? `${formatEta(stop.order.eta_earliest)}–${formatEta(stop.order.eta_latest)}`
                : formatEta(stop.order?.eta_latest ?? null);

            return (
              <div key={stop.id} className="flex items-stretch gap-3">
                {/* Timeline column */}
                <div className="flex flex-col items-center shrink-0 w-5">
                  <div className={cn('h-3 w-3 rounded-full border-2 border-white shadow mt-3.5', style.dot)} />
                  {!isLast && (
                    <div className={cn('flex-1 w-0.5 min-h-[20px] mt-0.5', style.line)} />
                  )}
                </div>

                {/* Stop card */}
                <div className={cn('flex-1 rounded-xl border px-3 py-2 my-1', style.card)}>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[9px] font-black text-muted-foreground">#{idx + 1}</span>
                      <span className="text-xs font-bold truncate">
                        {stop.order?.kunde_name ?? 'Unbekannt'}
                      </span>
                    </div>
                    <div className="shrink-0">
                      {status === 'done' && <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500" />}
                      {status === 'active' && <Navigation className="h-3.5 w-3.5 text-blue-500" />}
                      {status === 'late' && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                    </div>
                  </div>

                  {stop.order?.kunde_adresse && (
                    <div className="flex items-start gap-0.5 mt-0.5">
                      <MapPin className="h-2.5 w-2.5 text-muted-foreground mt-px shrink-0" />
                      <span className="text-[10px] text-muted-foreground line-clamp-1">
                        {stop.order.kunde_adresse}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-1">
                    {stop.order?.bestellnummer && (
                      <span className="text-[9px] font-bold text-muted-foreground">
                        #{stop.order.bestellnummer}
                      </span>
                    )}
                    {etaWindow && status !== 'done' && (
                      <span className={cn('inline-flex items-center gap-0.5 text-[9px] font-bold',
                        status === 'late' ? 'text-red-600' : 'text-muted-foreground',
                      )}>
                        <Clock className="h-2.5 w-2.5" />
                        {etaWindow}
                      </span>
                    )}
                    {status === 'done' && stop.geliefert_am && (
                      <span className="text-[9px] font-bold text-matcha-600">
                        ✓ {new Date(stop.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
