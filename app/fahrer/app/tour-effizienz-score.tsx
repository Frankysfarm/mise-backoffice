'use client';

/**
 * TourEffizienzScore
 * Zeigt nach jeder Zustellung eine Effizienz-Wertung (1–5 Sterne + Erklärung).
 * Basiert auf ETA-Genauigkeit des letzten abgeschlossenen Stops.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    eta_earliest?: string | null;
    eta_latest?: string | null;
  };
};

interface Props {
  recentlyDeliveredStop: Stop | null;
  tourStartedAt: string | null;
}

function calcEffizienz(stop: Stop): { stars: number; label: string; detail: string; color: string } {
  const { geliefert_am, order } = stop;
  if (!geliefert_am) return { stars: 3, label: 'Geliefert', detail: 'Keine ETA-Daten', color: 'text-muted-foreground' };

  const deliveredMs = new Date(geliefert_am).getTime();
  const etaEarliestMs = order.eta_earliest ? new Date(order.eta_earliest).getTime() : null;
  const etaLatestMs   = order.eta_latest   ? new Date(order.eta_latest).getTime()   : null;

  if (!etaEarliestMs || !etaLatestMs) {
    return { stars: 3, label: 'Pünktlich', detail: 'ETA nicht gesetzt', color: 'text-matcha-600' };
  }

  const deltaMin = (deliveredMs - etaLatestMs) / 60_000;

  if (deltaMin <= -10) return { stars: 5, label: 'Blitzschnell!',  detail: `${Math.abs(Math.round(deltaMin))} Min zu früh`, color: 'text-matcha-600' };
  if (deltaMin <=   0) return { stars: 4, label: 'Im Zeitfenster', detail: 'Perfekt getimed',                                 color: 'text-matcha-600' };
  if (deltaMin <=   5) return { stars: 3, label: 'Leicht verzögert', detail: `${Math.round(deltaMin)} Min zu spät`,           color: 'text-amber-600'  };
  if (deltaMin <=  15) return { stars: 2, label: 'Verspätet',       detail: `${Math.round(deltaMin)} Min Verzögerung`,        color: 'text-orange-600' };
  return                      { stars: 1, label: 'Stark verspätet', detail: `${Math.round(deltaMin)} Min Verzögerung`,        color: 'text-red-600'    };
}

export function TourEffizienzScore({ recentlyDeliveredStop, tourStartedAt }: Props) {
  const [visible, setVisible] = useState(false);
  const [stopId, setStopId] = useState<string | null>(null);

  useEffect(() => {
    if (!recentlyDeliveredStop || recentlyDeliveredStop.id === stopId) return;
    setStopId(recentlyDeliveredStop.id);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 8_000);
    return () => clearTimeout(t);
  }, [recentlyDeliveredStop, stopId]);

  if (!visible || !recentlyDeliveredStop) return null;

  const { stars, label, detail, color } = calcEffizienz(recentlyDeliveredStop);

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-2xl border-2 px-4 py-3 shadow-lg transition-all',
      stars >= 4 ? 'bg-matcha-950 border-matcha-500/60' :
      stars === 3 ? 'bg-amber-950 border-amber-500/60' :
      'bg-red-950 border-red-500/60',
    )}>
      <div className="shrink-0">
        <CheckCircle2 className={cn('h-8 w-8', color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-0.5 mb-0.5">
          {[1, 2, 3, 4, 5].map(s => (
            <Star
              key={s}
              className={cn('h-4 w-4', s <= stars ? 'text-gold fill-gold' : 'text-matcha-700')}
            />
          ))}
        </div>
        <div className={cn('font-display text-sm font-black leading-tight', color)}>
          {label}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock className="h-3 w-3 text-matcha-400" />
          <span className="text-[10px] text-matcha-400">{detail}</span>
        </div>
        <div className="text-[10px] text-matcha-500 truncate mt-0.5">
          {recentlyDeliveredStop.order.bestellnummer} · {recentlyDeliveredStop.order.kunde_name}
        </div>
      </div>
      <TrendingUp className={cn('h-5 w-5 shrink-0 opacity-60', color)} />
    </div>
  );
}
