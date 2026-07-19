'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Euro, TrendingUp, Route, Clock, Star, ArrowUpRight } from 'lucide-react';

interface TourEffizienz {
  tourId: string;
  fahrer: string;
  stops: number;
  distanzKm: number;
  umsatz: number;
  umsatzProKm: number;
  umsatzProStop: number;
  etaMin: number | null;
  score: number;
}

const MOCK_TOUREN: TourEffizienz[] = [
  { tourId: 'T-001', fahrer: 'Ahmed K.', stops: 4, distanzKm: 8.2, umsatz: 142, umsatzProKm: 17.3, umsatzProStop: 35.5, etaMin: 22, score: 89 },
  { tourId: 'T-002', fahrer: 'Leila M.', stops: 3, distanzKm: 5.1, umsatz: 98, umsatzProKm: 19.2, umsatzProStop: 32.7, etaMin: 14, score: 94 },
  { tourId: 'T-003', fahrer: 'Sam F.', stops: 5, distanzKm: 12.4, umsatz: 185, umsatzProKm: 14.9, umsatzProStop: 37.0, etaMin: 38, score: 71 },
  { tourId: 'T-004', fahrer: 'Jonas B.', stops: 2, distanzKm: 3.8, umsatz: 67, umsatzProKm: 17.6, umsatzProStop: 33.5, etaMin: 9, score: 86 },
];

function ScoreBadge({ score }: { score: number }) {
  const bg = score >= 90 ? 'bg-emerald-100 text-emerald-700' :
             score >= 75 ? 'bg-amber-100 text-amber-700' :
             'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${bg}`}>
      <Star className="w-2.5 h-2.5" />{score}
    </span>
  );
}

export function DispatchPhase2195TourGewinnEffizienzCockpit() {
  const [touren, setTouren] = useState<TourEffizienz[]>(MOCK_TOUREN);
  const [sortKey, setSortKey] = useState<'score' | 'umsatzProKm'>('score');
  const supabase = createClient();

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('active_tours')
        .select('id,driver_name,stop_count,distance_km,revenue,eta_min,score')
        .order('score', { ascending: false })
        .limit(6);
      if (data && data.length > 0) {
        setTouren(data.map((d: any) => ({
          tourId: d.id,
          fahrer: d.driver_name ?? 'Unbekannt',
          stops: d.stop_count ?? 0,
          distanzKm: d.distance_km ?? 0,
          umsatz: d.revenue ?? 0,
          umsatzProKm: d.distance_km ? d.revenue / d.distance_km : 0,
          umsatzProStop: d.stop_count ? d.revenue / d.stop_count : 0,
          etaMin: d.eta_min,
          score: d.score ?? 0,
        })));
      }
    } catch {
      // keep mock
    }
  }, [supabase]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 20000);
    return () => clearInterval(id);
  }, [refresh]);

  const sorted = [...touren].sort((a, b) =>
    sortKey === 'score' ? b.score - a.score : b.umsatzProKm - a.umsatzProKm
  );

  const gesamtUmsatz = touren.reduce((s, t) => s + t.umsatz, 0);
  const avgScore = Math.round(touren.reduce((s, t) => s + t.score, 0) / touren.length);

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-stone-800">Tour-Effizienz Live</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500">Ø Score: <span className="font-bold text-stone-800">{avgScore}</span></span>
          <span className="text-xs text-emerald-700 font-bold">€{gesamtUmsatz.toFixed(0)} aktiv</span>
        </div>
      </div>

      {/* Sort toggle */}
      <div className="flex gap-1 mb-3">
        {(['score', 'umsatzProKm'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setSortKey(k)}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
              sortKey === k ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}
          >
            {k === 'score' ? 'Score' : '€/km'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {sorted.map((t, i) => (
          <div key={t.tourId} className="flex items-center gap-2 p-2 rounded-lg bg-stone-50 border border-stone-100">
            <span className="text-[10px] text-stone-400 w-4 text-center font-mono">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-stone-800 truncate">{t.fahrer}</span>
                <ScoreBadge score={t.score} />
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-stone-500">
                <span className="flex items-center gap-0.5"><Route className="w-2.5 h-2.5" />{t.stops} Stopps</span>
                <span className="flex items-center gap-0.5"><Euro className="w-2.5 h-2.5" />{t.umsatz.toFixed(0)}</span>
                <span className="flex items-center gap-0.5"><ArrowUpRight className="w-2.5 h-2.5" />{t.umsatzProKm.toFixed(1)}/km</span>
                {t.etaMin != null && (
                  <span className="flex items-center gap-0.5 ml-auto"><Clock className="w-2.5 h-2.5" />{t.etaMin}min</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-stone-400 text-center mt-2">Aktive Touren · 20s Refresh</p>
    </div>
  );
}
