'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Star, Route, MapPin, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface TourScoreEntry {
  tourId: string;
  fahrer: string;
  score: number;
  scoreVorherige: number;
  stopsDone: number;
  stopsTotal: number;
  distanzKm: number;
  etaMin: number | null;
  zone: string;
  status: 'aktiv' | 'abgeschlossen' | 'pause';
}

const MOCK_TOUREN: TourScoreEntry[] = [
  { tourId: 'T-01', fahrer: 'Ahmed K.', score: 92, scoreVorherige: 88, stopsDone: 2, stopsTotal: 4, distanzKm: 8.2, etaMin: 18, zone: 'Nord', status: 'aktiv' },
  { tourId: 'T-02', fahrer: 'Lena M.', score: 78, scoreVorherige: 82, stopsDone: 3, stopsTotal: 3, distanzKm: 5.6, etaMin: null, zone: 'Mitte', status: 'abgeschlossen' },
  { tourId: 'T-03', fahrer: 'Jonas B.', score: 85, scoreVorherige: 80, stopsDone: 1, stopsTotal: 5, distanzKm: 11.1, etaMin: 34, zone: 'Süd', status: 'aktiv' },
  { tourId: 'T-04', fahrer: 'Sana R.', score: 61, scoreVorherige: 67, stopsDone: 0, stopsTotal: 3, distanzKm: 4.3, etaMin: 45, zone: 'West', status: 'aktiv' },
  { tourId: 'T-05', fahrer: 'Max W.', score: 95, scoreVorherige: 91, stopsDone: 4, stopsTotal: 4, distanzKm: 7.0, etaMin: null, zone: 'Nord', status: 'abgeschlossen' },
];

function ScoreRing({ score }: { score: number }) {
  const color = score >= 90 ? '#10b981' : score >= 75 ? '#f59e0b' : '#ef4444';
  const r = 18;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  return (
    <svg width="48" height="48" className="shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx="24" cy="24" r={r} fill="none"
        stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        transform="rotate(-90 24 24)"
      />
      <text x="24" y="29" textAnchor="middle" fontSize="11" fontWeight="800" fill={color}>{score}</text>
    </svg>
  );
}

function TourBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full flex-1 transition-colors ${i < done ? 'bg-matcha-500' : 'bg-stone-200'}`}
        />
      ))}
    </div>
  );
}

export function DispatchPhase2200TourScoreVisualisierungBoard() {
  const [touren, setTouren] = useState<TourScoreEntry[]>(MOCK_TOUREN);
  const [filter, setFilter] = useState<'alle' | 'aktiv' | 'abgeschlossen'>('alle');
  const supabase = createClient();

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('active_tours')
        .select('id,driver_name,score,prev_score,stops_done,stop_count,distance_km,eta_min,zone,status')
        .order('score', { ascending: false })
        .limit(8);
      if (data && data.length > 0) {
        setTouren(data.map((d: any) => ({
          tourId: d.id,
          fahrer: d.driver_name ?? 'Unbekannt',
          score: d.score ?? 0,
          scoreVorherige: d.prev_score ?? d.score ?? 0,
          stopsDone: d.stops_done ?? 0,
          stopsTotal: d.stop_count ?? 1,
          distanzKm: d.distance_km ?? 0,
          etaMin: d.eta_min,
          zone: d.zone ?? '—',
          status: d.status ?? 'aktiv',
        })));
      }
    } catch {
      // keep mock
    }
  }, [supabase]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 25000);
    return () => clearInterval(id);
  }, [refresh]);

  const visible = filter === 'alle' ? touren : touren.filter((t) => t.status === filter);
  const avgScore = visible.length ? Math.round(visible.reduce((s, t) => s + t.score, 0) / visible.length) : 0;

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-stone-800">Tour-Score Visualisierung</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          avgScore >= 85 ? 'bg-emerald-100 text-emerald-700' :
          avgScore >= 70 ? 'bg-amber-100 text-amber-700' :
          'bg-red-100 text-red-700'
        }`}>
          Ø {avgScore}
        </span>
      </div>

      <div className="flex gap-1 mb-3">
        {(['alle', 'aktiv', 'abgeschlossen'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[10px] px-2 py-0.5 rounded-full capitalize transition-colors ${
              filter === f ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}
          >
            {f === 'alle' ? 'Alle' : f === 'aktiv' ? 'Aktiv' : 'Fertig'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((t) => {
          const delta = t.score - t.scoreVorherige;
          return (
            <div key={t.tourId} className="flex items-center gap-3">
              <ScoreRing score={t.score} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-semibold text-stone-800 truncate">{t.fahrer}</span>
                  {delta !== 0 && (
                    <span className={`flex items-center gap-0.5 text-[10px] font-bold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {delta > 0 ? '+' : ''}{delta}
                    </span>
                  )}
                  <span className={`ml-auto text-[9px] px-1 py-0.5 rounded ${
                    t.status === 'aktiv' ? 'bg-matcha-100 text-matcha-700' :
                    t.status === 'abgeschlossen' ? 'bg-stone-100 text-stone-500' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {t.status}
                  </span>
                </div>
                <TourBar done={t.stopsDone} total={t.stopsTotal} />
                <div className="flex items-center gap-2 mt-1 text-[9px] text-stone-500">
                  <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{t.zone}</span>
                  <span className="flex items-center gap-0.5"><Route className="w-2.5 h-2.5" />{t.stopsDone}/{t.stopsTotal}</span>
                  <span>{t.distanzKm.toFixed(1)} km</span>
                  {t.etaMin != null && (
                    <span className="flex items-center gap-0.5 ml-auto"><Clock className="w-2.5 h-2.5" />{t.etaMin}min</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-stone-400 text-center mt-3">Score-Ring + Stopps-Fortschritt · 25s Refresh</p>
    </div>
  );
}
