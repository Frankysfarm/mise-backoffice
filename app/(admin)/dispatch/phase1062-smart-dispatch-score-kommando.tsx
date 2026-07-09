'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, Zap, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type Vorschlag = {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  gruende: string[];
  order_id: string;
  order_kurz: string;
  zone: string;
  distanz_km?: number;
  verbleibt_min?: number;
};

type ApiResponse = { vorschlaege: Vorschlag[]; timestamp: string };

function mock(): ApiResponse {
  return {
    vorschlaege: [
      {
        fahrer_id: 'f1', fahrer_name: 'Max M.', score: 94, order_id: 'o1', order_kurz: '#1042 — Nord',
        zone: 'Nord', distanz_km: 1.8, verbleibt_min: 3,
        gruende: ['Kürzeste Distanz', 'Freie Kapazität', 'Hohe Zone-Affinität'],
      },
      {
        fahrer_id: 'f2', fahrer_name: 'Anna S.', score: 77, order_id: 'o1', order_kurz: '#1042 — Nord',
        zone: 'Mitte', distanz_km: 3.2, verbleibt_min: 7,
        gruende: ['Gute Zone-Kenntnis', 'Score-Trend steigend'],
      },
    ],
    timestamp: new Date().toISOString(),
  };
}

export function DispatchPhase1062SmartDispatchScoreKommando({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const p = new URLSearchParams(); if (locationId) p.set('location_id', locationId);
      const r = await fetch(`/api/delivery/admin/smart-dispatch-vorschlag?${p}`);
      if (r.ok) setData(await r.json()); else throw new Error();
    } catch { setData(mock()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [locationId]);

  const vorschlaege = data?.vorschlaege ?? [];
  if (!loading && vorschlaege.length === 0) return null;

  return (
    <div className="rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-purple-200 dark:border-purple-800">
        <Sparkles size={15} className="text-purple-600 dark:text-purple-400" />
        <span className="text-xs font-bold text-purple-800 dark:text-purple-200 uppercase tracking-wider flex-1">
          Smart-Dispatch — Score-Kommando
        </span>
        {loading && <Loader2 size={14} className="animate-spin text-purple-400" />}
      </div>

      <div className="p-3 space-y-2">
        {vorschlaege.map((v, idx) => {
          const best = idx === 0;
          const scoreColor = v.score >= 90 ? 'text-matcha-700 dark:text-matcha-300' : v.score >= 70 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';

          return (
            <div
              key={`${v.fahrer_id}-${v.order_id}-${idx}`}
              className={cn(
                'rounded-xl border p-3',
                best
                  ? 'bg-white dark:bg-purple-900/30 border-purple-300 dark:border-purple-700'
                  : 'bg-white/60 dark:bg-purple-950/40 border-purple-100 dark:border-purple-800',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {best && <Zap size={13} className="text-purple-600 dark:text-purple-400" />}
                  <User size={12} className="text-muted-foreground" />
                  <span className="text-sm font-bold text-purple-900 dark:text-purple-100">{v.fahrer_name}</span>
                  {best && <span className="text-[9px] font-bold rounded-full bg-purple-600 text-white px-2 py-0.5">Empfohlen</span>}
                </div>
                <span className={cn('text-sm font-black tabular-nums', scoreColor)}>Score {v.score}</span>
              </div>

              <div className="mb-2">
                <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', v.score >= 90 ? 'bg-matcha-500' : v.score >= 70 ? 'bg-amber-400' : 'bg-red-400')}
                    style={{ width: `${v.score}%` }}
                  />
                </div>
              </div>

              <div className="text-[10px] text-purple-700 dark:text-purple-300 mb-1.5 font-medium">
                {v.order_kurz} — Zone {v.zone}
                {v.distanz_km !== undefined && <span className="ml-2">{v.distanz_km} km</span>}
                {v.verbleibt_min !== undefined && <span className="ml-2">~{v.verbleibt_min} Min frei</span>}
              </div>

              <div className="flex flex-wrap gap-1">
                {v.gruende.map((g) => (
                  <span key={g} className="text-[9px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 rounded px-1.5 py-0.5 font-medium">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
