'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MapPin, Star, TrendingUp, AlertTriangle, Navigation, Clock } from 'lucide-react';

type TourStop = {
  id: string;
  reihenfolge: number | null;
  geliefert_am: string | null;
  angekommen_am: string | null;
  eta_min: number | null;
  order_id: string | null;
};

type BatchRow = {
  id: string;
  fahrer_id: string | null;
  status: string;
  started_at: string | null;
  driver_name: string | null;
  stops: TourStop[];
  score: number | null;
};

function scoreColor(score: number | null): { bg: string; text: string; ring: string } {
  if (score === null) return { bg: 'bg-stone-100 border-stone-300', text: 'text-stone-500', ring: 'stroke-stone-300' };
  if (score >= 85) return { bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700', ring: 'stroke-emerald-500' };
  if (score >= 65) return { bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700', ring: 'stroke-amber-500' };
  return { bg: 'bg-red-50 border-red-300', text: 'text-red-700', ring: 'stroke-red-500' };
}

function ScoreRing({ score, size = 52 }: { score: number | null; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score !== null ? Math.min(100, Math.max(0, score)) : 0;
  const col = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" className={col.ring} strokeWidth={5}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize="13" fontWeight="bold" fill={score !== null && score < 65 ? '#b91c1c' : score !== null && score < 85 ? '#92400e' : '#065f46'}>
        {score !== null ? score : '—'}
      </text>
    </svg>
  );
}

export function DispatchPhase3326ScoreTourVisHub({ locationId }: { locationId: string | null }) {
  const supabase = createClient();
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [fleetAvg, setFleetAvg] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!locationId) return;

      const { data: rawBatches } = await supabase
        .from('delivery_batches')
        .select('id, fahrer_id, status, started_at, tour_score')
        .eq('location_id', locationId)
        .in('status', ['active', 'returning'])
        .order('started_at', { ascending: false })
        .limit(8);

      if (!rawBatches || rawBatches.length === 0) {
        setBatches([]);
        return;
      }

      const batchIds = rawBatches.map(b => b.id);
      const fahrerIds = rawBatches.map(b => b.fahrer_id).filter(Boolean) as string[];

      const [stopsRes, driversRes] = await Promise.all([
        supabase
          .from('delivery_stops')
          .select('id, batch_id, reihenfolge, geliefert_am, angekommen_am, eta_min, order_id')
          .in('batch_id', batchIds)
          .order('reihenfolge', { ascending: true }),
        fahrerIds.length
          ? supabase
              .from('employees')
              .select('id, vorname, nachname')
              .in('id', fahrerIds)
          : Promise.resolve({ data: [] }),
      ]);

      const stops = stopsRes.data ?? [];
      const drivers = driversRes.data ?? [];

      const mapped = rawBatches.map(b => {
        const drv = drivers.find((d: any) => d.id === b.fahrer_id);
        const bStops = stops.filter((s: any) => s.batch_id === b.id);
        return {
          id: b.id,
          fahrer_id: b.fahrer_id,
          status: b.status,
          started_at: b.started_at,
          driver_name: drv ? `${(drv as any).vorname} ${(drv as any).nachname}` : 'Fahrer',
          stops: bStops as TourStop[],
          score: (b as any).tour_score ?? null,
        };
      });

      setBatches(mapped);

      const scored = mapped.filter(b => b.score !== null);
      if (scored.length > 0) {
        setFleetAvg(Math.round(scored.reduce((a, b) => a + (b.score ?? 0), 0) / scored.length));
      }
    };

    load();
    const iv = setInterval(load, 25_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (batches.length === 0) return null;

  const lowScore = batches.filter(b => b.score !== null && b.score < 65).length;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-stone-50 to-white">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-matcha-600" />
          <span className="text-[11px] font-black uppercase tracking-widest text-stone-500">Tour-Score & Visualisierung</span>
          <span className="text-[10px] bg-matcha-100 text-matcha-700 rounded-full px-2 py-0.5 font-bold">
            {batches.length} aktiv
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lowScore > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold">{lowScore} Score &lt;65</span>
            </div>
          )}
          {fleetAvg !== null && (
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />
              <span className="text-[10px] font-bold text-matcha-700">Ø {fleetAvg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Alert strip */}
      {lowScore > 0 && (
        <div className="px-4 py-2 bg-red-50 text-red-700 text-[10px] font-bold flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          {lowScore} Tour{lowScore > 1 ? 'en' : ''} mit Score unter 65 — Unterstützung prüfen!
        </div>
      )}

      {/* Batch grid */}
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {batches.map(batch => {
          const col = scoreColor(batch.score);
          const delivered = batch.stops.filter(s => s.geliefert_am).length;
          const total = batch.stops.length;
          const progress = total > 0 ? Math.round((delivered / total) * 100) : 0;

          return (
            <div key={batch.id} className={`rounded-xl border-2 p-3 ${col.bg}`}>
              {/* Header row */}
              <div className="flex items-center gap-3">
                <ScoreRing score={batch.score} size={52} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-black text-stone-700 truncate">{batch.driver_name}</div>
                  <div className="text-[9px] text-stone-400 font-medium mt-0.5">
                    {delivered}/{total} Stopps · {batch.status === 'returning' ? 'Rückkehr' : 'Aktiv'}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-1.5 h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        batch.score !== null && batch.score < 65 ? 'bg-red-500' :
                        batch.score !== null && batch.score < 85 ? 'bg-amber-400' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Stop dots */}
              {total > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {batch.stops.map((stop, i) => (
                    <div
                      key={stop.id}
                      className={`flex items-center justify-center w-5 h-5 rounded-full text-[8px] font-black border ${
                        stop.geliefert_am
                          ? 'bg-emerald-500 border-emerald-600 text-white'
                          : stop.angekommen_am
                          ? 'bg-amber-400 border-amber-500 text-white'
                          : 'bg-stone-100 border-stone-300 text-stone-500'
                      }`}
                      title={`Stopp ${i + 1}`}
                    >
                      {i + 1}
                    </div>
                  ))}
                  <div className="flex items-center gap-0.5 ml-1 text-[8px] text-stone-400">
                    <MapPin className="h-2.5 w-2.5" />
                    <span>{total - delivered} offen</span>
                  </div>
                </div>
              )}

              {/* Score label */}
              <div className="mt-2 flex items-center justify-between">
                <div className={`text-[9px] font-bold flex items-center gap-1 ${col.text}`}>
                  <Star className="h-2.5 w-2.5" />
                  {batch.score !== null
                    ? batch.score >= 85 ? 'Ausgezeichnet'
                    : batch.score >= 65 ? 'Gut'
                    : 'Handlungsbedarf'
                    : 'Kein Score'}
                </div>
                {batch.started_at && (
                  <div className="flex items-center gap-1 text-[8px] text-stone-400">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{Math.floor((Date.now() - new Date(batch.started_at).getTime()) / 60_000)}min</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
