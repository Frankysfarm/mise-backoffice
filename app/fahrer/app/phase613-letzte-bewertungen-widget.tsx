'use client';

import { useEffect, useState, useCallback } from 'react';
import { Star } from 'lucide-react';

interface Bewertung {
  tourId: string;
  sterne: number;
  kommentar?: string;
  datum: string;
}

interface Props {
  driverId: string;
}

function StarRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i <= count ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
        />
      ))}
    </div>
  );
}

export function FahrerPhase613LetzteBewertungenWidget({ driverId }: Props) {
  const [bewertungen, setBewertungen] = useState<Bewertung[] | null>(null);

  const laden = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/tour-feedback-analytics?driver_id=${driverId}&limit=3`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('api error');
      const json = await res.json();
      if (json.ok && Array.isArray(json.recent) && json.recent.length > 0) {
        setBewertungen(
          json.recent.slice(0, 3).map((r: Record<string, unknown>) => ({
            tourId: String(r.tour_id ?? r.batchId ?? r.id ?? Math.random()),
            sterne: Number(r.rating ?? r.sterne ?? r.stars ?? 0),
            kommentar: r.comment ?? r.kommentar ?? undefined,
            datum: String(r.created_at ?? r.datum ?? ''),
          })),
        );
      } else {
        setBewertungen([]);
      }
    } catch {
      setBewertungen([]);
    }
  }, [driverId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 300000);
    return () => clearInterval(id);
  }, [laden]);

  if (!bewertungen || bewertungen.length === 0) return null;

  const schnitt =
    Math.round((bewertungen.reduce((s, b) => s + b.sterne, 0) / bewertungen.length) * 10) / 10;

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Letzte Bewertungen
          </span>
        </div>
        <span className="text-sm font-black text-amber-700 dark:text-amber-300 tabular-nums">
          Ø {schnitt}
        </span>
      </div>

      <div className="space-y-2">
        {bewertungen.map((b) => (
          <div
            key={b.tourId}
            className="rounded-lg bg-white/70 dark:bg-white/5 px-2.5 py-2"
          >
            <StarRow count={b.sterne} />
            {b.kommentar && (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                „{b.kommentar}"
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
