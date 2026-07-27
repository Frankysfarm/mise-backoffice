'use client';

import { useState, useEffect, useCallback } from 'react';
import { Award, Star, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';

interface BewertungsKategorie { kategorie: string; avg: number; count: number; delta: number; }
interface ApiData { avg_gesamt: number; avg_vorwoche: number; sterne_5: number; sterne_4: number; sterne_3: number; sterne_2: number; sterne_1: number; gesamt_bewertungen: number; kategorien: BewertungsKategorie[]; top_lob: string; top_kritik: string; }

const MOCK: ApiData = {
  avg_gesamt: 4.6,
  avg_vorwoche: 4.4,
  sterne_5: 68,
  sterne_4: 18,
  sterne_3: 8,
  sterne_2: 4,
  sterne_1: 2,
  gesamt_bewertungen: 142,
  kategorien: [
    { kategorie: 'Lieferzeit', avg: 4.5, count: 128, delta: 0.2 },
    { kategorie: 'Essen-Qualität', avg: 4.8, count: 135, delta: 0.1 },
    { kategorie: 'Fahrer-Freundlichkeit', avg: 4.7, count: 119, delta: 0.3 },
    { kategorie: 'Verpackung', avg: 4.3, count: 98, delta: -0.1 },
  ],
  top_lob: 'Sehr freundlicher Fahrer und schnelle Lieferung!',
  top_kritik: 'Essen war etwas kalt bei Ankunft.',
};

interface Props { locationId: string | null; }

export function LieferdienstPhase2790LieferQualitaetsStatistik({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/liefer-qualitaet-statistik?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 5 * 60_000); return () => clearInterval(id); }, [load]);

  const sterneDaten = [5, 4, 3, 2, 1].map(s => ({
    sterne: s,
    count: s === 5 ? data.sterne_5 : s === 4 ? data.sterne_4 : s === 3 ? data.sterne_3 : s === 2 ? data.sterne_2 : data.sterne_1,
  }));
  const maxCount = Math.max(...sterneDaten.map(d => d.count), 1);
  const deltaColor = (data.avg_gesamt - data.avg_vorwoche) >= 0 ? 'text-emerald-600' : 'text-red-500';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-semibold text-gray-900">Liefer-Qualitäts-Statistik</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-center gap-4 bg-yellow-50 rounded-xl p-3">
        <div className="text-center">
          <div className="text-4xl font-bold text-yellow-500">{data.avg_gesamt.toFixed(1)}</div>
          <div className="flex items-center justify-center gap-0.5 mt-0.5">
            {[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= Math.round(data.avg_gesamt) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />)}
          </div>
        </div>
        <div className="flex-1 space-y-1">
          {sterneDaten.map(({ sterne, count }) => (
            <div key={sterne} className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-500 w-3">{sterne}★</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(count / maxCount) * 100}%` }} />
              </div>
              <span className="text-[9px] text-gray-400 w-4 text-right">{count}</span>
            </div>
          ))}
        </div>
        <div className={`text-sm font-bold ${deltaColor}`}>
          {(data.avg_gesamt - data.avg_vorwoche) >= 0 ? '+' : ''}{(data.avg_gesamt - data.avg_vorwoche).toFixed(1)}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[10px] text-gray-500 font-medium">Kategorien</div>
        {data.kategorien.map((k) => (
          <div key={k.kategorie} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-700 flex-1">{k.kategorie}</span>
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(s => <Star key={s} className={`w-2.5 h-2.5 ${s <= Math.round(k.avg) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />)}
            </div>
            <span className="text-[10px] font-bold text-gray-700 w-6 text-right">{k.avg.toFixed(1)}</span>
            <span className={`text-[9px] w-8 text-right ${k.delta >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>{k.delta >= 0 ? '+' : ''}{k.delta.toFixed(1)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-start gap-1.5 bg-emerald-50 rounded-lg p-2">
          <ThumbsUp className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
          <span className="text-[10px] text-emerald-700 italic">„{data.top_lob}"</span>
        </div>
        <div className="flex items-start gap-1.5 bg-red-50 rounded-lg p-2">
          <ThumbsDown className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-[10px] text-red-600 italic">„{data.top_kritik}"</span>
        </div>
      </div>

      <div className="flex justify-between text-[9px] text-gray-400 border-t border-gray-100 pt-1">
        <span><MessageSquare className="w-2.5 h-2.5 inline mr-0.5" />{data.gesamt_bewertungen} Bewertungen heute</span>
        <span>5-Min-Polling · vs. Vorwoche</span>
      </div>
    </div>
  );
}
