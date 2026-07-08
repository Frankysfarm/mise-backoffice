'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Navigation, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourFeedback {
  tour_id: string;
  datum: string;
  optimale_km: number;
  gefahrene_km: number;
  effizienz_score: number; // 0–100
  effizienz_label: 'sehr gut' | 'gut' | 'verbesserbar' | 'schlecht';
  tipp: string;
  stopps: number;
}

interface FeedbackData {
  letzte_tour: TourFeedback | null;
  wochen_avg_score: number | null;
  generatedAt: string;
}

const MOCK: FeedbackData = {
  letzte_tour: {
    tour_id: 'mock-1',
    datum: 'Heute 14:32',
    optimale_km: 8.4,
    gefahrene_km: 9.7,
    effizienz_score: 87,
    effizienz_label: 'gut',
    tipp: 'Stopp 3 vor Stopp 2 — spart ~1,3 km. Nächstes Mal: Route B → A → C.',
    stopps: 4,
  },
  wochen_avg_score: 83,
  generatedAt: new Date().toISOString(),
};

const effizienzStyle = {
  'sehr gut': { text: 'text-matcha-700', bg: 'bg-matcha-100 border-matcha-300', ring: 'border-matcha-400' },
  'gut':      { text: 'text-matcha-600', bg: 'bg-matcha-50 border-matcha-200', ring: 'border-matcha-300' },
  'verbesserbar': { text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', ring: 'border-amber-400' },
  'schlecht': { text: 'text-red-700', bg: 'bg-red-50 border-red-200', ring: 'border-red-400' },
};

export function FahrerPhase849StreckenEffizienzFeedback({ driverId, locationId }: { driverId: string; locationId: string | null }) {
  const [data, setData] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ driver_id: driverId });
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/strecken-effizienz?${params}`, { cache: 'no-store' });
      setData(res.ok ? await res.json() : MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [driverId, locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data?.letzte_tour) return null;

  const tour = data.letzte_tour;
  const s = effizienzStyle[tour.effizienz_label];
  const mehrKm = tour.gefahrene_km - tour.optimale_km;
  const isUp = tour.effizienz_score >= 80;

  return (
    <div className={cn('rounded-2xl border-2 p-4 space-y-3 transition-all', s.ring)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Navigation className={cn('h-4 w-4', s.text)} />
          <span className="text-sm font-bold text-stone-800">Strecken-Effizienz</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold border', s.bg, s.text)}>
            {tour.effizienz_label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <span className={cn('text-xl font-black tabular-nums', s.text)}>{tour.effizienz_score}</span>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Score-Balken */}
      <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', isUp ? 'bg-matcha-500' : 'bg-amber-500')}
          style={{ width: `${tour.effizienz_score}%` }}
        />
      </div>

      {/* KPI-Zeile */}
      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-lg bg-white/60 border border-stone-200 px-3 py-1.5 text-center">
          <div className="text-[10px] text-stone-500">Optimal</div>
          <div className="text-sm font-black tabular-nums">{tour.optimale_km.toFixed(1)} km</div>
        </div>
        <div className="flex-1 rounded-lg bg-white/60 border border-stone-200 px-3 py-1.5 text-center">
          <div className="text-[10px] text-stone-500">Gefahren</div>
          <div className="text-sm font-black tabular-nums">{tour.gefahrene_km.toFixed(1)} km</div>
        </div>
        <div className={cn('flex-1 rounded-lg border px-3 py-1.5 text-center', mehrKm > 2 ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-stone-200')}>
          <div className="text-[10px] text-stone-500">Mehrweg</div>
          <div className={cn('text-sm font-black tabular-nums flex items-center justify-center gap-0.5', mehrKm > 0 ? 'text-red-600' : 'text-matcha-600')}>
            {mehrKm > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            +{mehrKm.toFixed(1)} km
          </div>
        </div>
      </div>

      {/* Wochen-Durchschnitt */}
      {data.wochen_avg_score != null && (
        <div className="flex items-center justify-between text-[11px] text-stone-500">
          <span>Ø dieser Woche</span>
          <span className={cn('font-bold tabular-nums', data.wochen_avg_score >= 80 ? 'text-matcha-700' : 'text-amber-600')}>
            {data.wochen_avg_score}/100
          </span>
        </div>
      )}

      {/* Tipp (expandiert) */}
      {expanded && (
        <div className={cn('rounded-xl border p-3 text-[12px] font-medium', s.bg, s.text)}>
          <span className="font-black">Tipp: </span>{tour.tipp}
        </div>
      )}
    </div>
  );
}
