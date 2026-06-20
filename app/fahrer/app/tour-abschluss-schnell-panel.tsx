'use client';

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  CheckCircle2, Clock, Star, Bike, MapPin, TrendingUp, Zap, ChevronRight,
} from 'lucide-react';

interface TourSummary {
  tourId: string;
  stoppsGesamt: number;
  stoppsFertig: number;
  startzeit: string | null;
  endezeit: string | null;
  distanzKm: number | null;
  einnahmen: number | null;
  trinkgeld: number | null;
  durchschnittsBewertung: number | null;
  pünktlichkeitPct: number | null;
}

function useTourSummary(tourId: string | null): TourSummary | null {
  const [summary, setSummary] = useState<TourSummary | null>(null);

  useEffect(() => {
    if (!tourId) return;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/driver/tour-summary?tour_id=${tourId}`);
        if (r.ok) {
          const d = await r.json();
          setSummary({
            tourId,
            stoppsGesamt: d.total_stops ?? 0,
            stoppsFertig: d.completed_stops ?? d.total_stops ?? 0,
            startzeit: d.started_at ?? null,
            endezeit: d.ended_at ?? null,
            distanzKm: d.distance_km ?? null,
            einnahmen: d.earnings ?? null,
            trinkgeld: d.tip ?? null,
            durchschnittsBewertung: d.avg_rating ?? null,
            pünktlichkeitPct: d.on_time_pct ?? null,
          });
        }
      } catch {}
    };

    load();
  }, [tourId]);

  return summary;
}

function DurationLabel({ startzeit, endezeit }: { startzeit: string | null; endezeit: string | null }) {
  if (!startzeit) return <span className="text-muted-foreground">–</span>;
  const end = endezeit ? new Date(endezeit) : new Date();
  const diffMin = Math.floor((end.getTime() - new Date(startzeit).getTime()) / 60_000);
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return (
    <span className="text-lg font-black text-foreground tabular-nums">
      {h > 0 ? `${h}h ` : ''}{m}m
    </span>
  );
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          className={i <= Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  );
}

interface Props {
  tourId: string | null;
  onNeueSchicht?: () => void;
  className?: string;
}

export function TourAbschlussSchnellPanel({ tourId, onNeueSchicht, className }: Props) {
  const summary = useTourSummary(tourId);

  // Mock data when no real summary available
  const data: TourSummary = summary ?? {
    tourId: tourId ?? 'mock',
    stoppsGesamt: 4,
    stoppsFertig: 4,
    startzeit: new Date(Date.now() - 65 * 60_000).toISOString(),
    endezeit: new Date().toISOString(),
    distanzKm: 12.3,
    einnahmen: 38.5,
    trinkgeld: 4.2,
    durchschnittsBewertung: 4.8,
    pünktlichkeitPct: 100,
  };

  const gesamtEinnahmen = (data.einnahmen ?? 0) + (data.trinkgeld ?? 0);

  const stats = [
    {
      icon: CheckCircle2,
      label: 'Stopps',
      value: `${data.stoppsFertig}/${data.stoppsGesamt}`,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      icon: Clock,
      label: 'Dauer',
      value: null,
      customValue: <DurationLabel startzeit={data.startzeit} endezeit={data.endezeit} />,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      icon: Bike,
      label: 'Distanz',
      value: data.distanzKm != null ? `${data.distanzKm.toFixed(1)} km` : '–',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      icon: TrendingUp,
      label: 'Pünktlich',
      value: data.pünktlichkeitPct != null ? `${data.pünktlichkeitPct.toFixed(0)}%` : '–',
      color: data.pünktlichkeitPct != null && data.pünktlichkeitPct >= 90 ? 'text-emerald-600' : 'text-amber-600',
      bg: 'bg-gray-50',
    },
  ] as const;

  return (
    <div className={cn('rounded-2xl bg-card border border-border overflow-hidden shadow-md', className)}>
      {/* Header */}
      <div className="bg-matcha-600 text-white px-4 pt-5 pb-6">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={18} className="text-matcha-100" />
          <span className="text-sm font-black uppercase tracking-wide text-matcha-100">Tour abgeschlossen!</span>
        </div>

        {/* Earnings Hero */}
        <div className="text-center">
          <div className="text-4xl font-black tabular-nums">{euro(gesamtEinnahmen)}</div>
          <div className="text-matcha-200 text-xs mt-0.5">
            {euro(data.einnahmen ?? 0)} + {euro(data.trinkgeld ?? 0)} Trinkgeld
          </div>
        </div>

        {/* Rating */}
        {data.durchschnittsBewertung != null && (
          <div className="flex items-center justify-center gap-2 mt-3">
            <StarRating value={data.durchschnittsBewertung} />
            <span className="text-sm font-black text-white tabular-nums">
              {data.durchschnittsBewertung.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 p-4 -mt-2">
        {stats.map(({ icon: Icon, label, value, customValue, color, bg }) => (
          <div key={label} className={cn('rounded-xl p-3 flex items-center gap-2', bg)}>
            <Icon size={16} className={cn(color, 'shrink-0')} />
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground">{label}</div>
              {customValue ?? <div className={cn('text-base font-black tabular-nums', color)}>{value}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      {onNeueSchicht && (
        <div className="px-4 pb-4">
          <button
            onClick={onNeueSchicht}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-matcha-600 text-white font-black text-sm py-3.5 active:scale-95 transition-transform"
          >
            <Zap size={16} />
            Nächste Schicht
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
