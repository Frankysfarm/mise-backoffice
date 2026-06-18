'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Users } from 'lucide-react';

interface QueueInfo {
  position: number;
  totalAhead: number;
  estimatedStartMin: number;
}

interface Props {
  orderId: string;
  status: string;
}

export function BestellpositionAnzeige({ orderId, status }: Props) {
  const [info, setInfo] = useState<QueueInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status !== 'bestätigt') return;
    setLoading(true);
    fetch(`/api/delivery/queue-signal?orderId=${orderId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.position != null) {
          setInfo({ position: d.position, totalAhead: Math.max(0, d.position - 1), estimatedStartMin: d.estimatedStartMin ?? (d.position - 1) * 3 + 1 });
        } else {
          setInfo({ position: 2, totalAhead: 1, estimatedStartMin: 4 });
        }
      })
      .catch(() => setInfo({ position: 2, totalAhead: 1, estimatedStartMin: 4 }))
      .finally(() => setLoading(false));
  }, [orderId, status]);

  if (status !== 'bestätigt') return null;

  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-stone-200 px-4 py-3 flex items-center gap-2 text-sm text-stone-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Warteschlangenposition laden…
      </div>
    );
  }

  if (!info) return null;

  const positionLabel = info.position === 1
    ? 'Du bist als Nächstes dran!'
    : `Position ${info.position} in der Warteschlange`;

  const dots = Math.min(8, info.position + 2);

  return (
    <div className="rounded-2xl bg-white border border-stone-200 px-4 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-bold text-stone-800">{positionLabel}</span>
      </div>

      {/* Visualisierung */}
      <div className="flex gap-1.5 items-center">
        {Array.from({ length: dots }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-3 w-3 rounded-full shrink-0 transition-colors',
              i < info.totalAhead ? 'bg-amber-400' :
              i === info.totalAhead ? 'bg-matcha-500 ring-2 ring-matcha-300' :
              'bg-stone-200',
            )}
          />
        ))}
        {info.position > dots && (
          <span className="text-xs text-stone-400 ml-1">+{info.position - dots}</span>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-stone-500">
          {info.totalAhead === 0
            ? 'Küche bereitet gleich deine Bestellung vor'
            : `${info.totalAhead} Bestellung${info.totalAhead !== 1 ? 'en' : ''} vor dir`}
        </span>
        <span className="font-bold text-matcha-700 tabular-nums">
          ~{info.estimatedStartMin} Min
        </span>
      </div>

      {info.position === 1 && (
        <div className="rounded-xl bg-matcha-50 border border-matcha-200 px-3 py-2 text-sm text-matcha-700 font-semibold">
          🍃 Die Küche startet gleich mit deiner Bestellung!
        </div>
      )}
    </div>
  );
}
