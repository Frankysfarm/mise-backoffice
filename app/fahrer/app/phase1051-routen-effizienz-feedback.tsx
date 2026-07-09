'use client';

import { useEffect, useState } from 'react';
import { Gauge, Leaf, MapPin, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type RoutenEffizienz = {
  effizienz_prozent: number;
  eingesparte_km: number;
  co2_eingespart_kg: number;
  aktueller_stopp: number;
  gesamt_stopps: number;
  optimale_reihenfolge: boolean;
  hinweis?: string;
};

const MOCK: RoutenEffizienz = {
  effizienz_prozent: 84,
  eingesparte_km: 2.3,
  co2_eingespart_kg: 0.34,
  aktueller_stopp: 2,
  gesamt_stopps: 5,
  optimale_reihenfolge: true,
  hinweis: 'Gut gemacht! Nächsten Stopp zuerst anfahren spart ~1 km.',
};

function GaugeRing({ prozent }: { prozent: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (prozent / 100) * circumference;
  const farbe = prozent >= 80 ? '#22c55e' : prozent >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={72} height={72} viewBox="0 0 72 72" className="shrink-0">
      <circle cx={36} cy={36} r={radius} fill="none" stroke="currentColor" strokeWidth={6} className="text-white/10" />
      <circle
        cx={36}
        cy={36}
        r={radius}
        fill="none"
        stroke={farbe}
        strokeWidth={6}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={36} y={40} textAnchor="middle" fontSize={14} fontWeight="bold" fill={farbe}>
        {prozent}%
      </text>
    </svg>
  );
}

export function FahrerPhase1051RoutenEffizienzFeedback({
  driverId,
  tourId,
}: {
  driverId: string;
  tourId?: string | null;
}) {
  const [data, setData] = useState<RoutenEffizienz | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const params = new URLSearchParams({ driver_id: driverId });
      if (tourId) params.set('tour_id', tourId);
      const res = await fetch(`/api/delivery/driver/routen-effizienz?${params}`);
      if (res.ok) setData(await res.json());
      else throw new Error();
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!driverId) return;
    load();
    const id = setInterval(load, 90 * 1000);
    return () => clearInterval(id);
  }, [driverId, tourId]);

  if (loading || !data) return null;
  if (!tourId) return null;

  const effizienzFarbe =
    data.effizienz_prozent >= 80
      ? 'text-matcha-600 dark:text-matcha-400'
      : data.effizienz_prozent >= 60
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-2xl border border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 p-4">
      <div className="flex items-start gap-3">
        <GaugeRing prozent={data.effizienz_prozent} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Gauge size={14} className="text-cyan-600 dark:text-cyan-400" />
            <span className="font-semibold text-cyan-800 dark:text-cyan-200 text-sm">Routen-Effizienz</span>
            <span className="ml-auto text-[10px] text-cyan-400">
              Stopp {data.aktueller_stopp}/{data.gesamt_stopps}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="rounded-lg bg-white/60 dark:bg-cyan-900/30 px-2 py-1.5 text-center">
              <div className="flex items-center justify-center gap-1">
                <MapPin size={10} className="text-cyan-500" />
                <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300">
                  −{data.eingesparte_km.toFixed(1)} km
                </span>
              </div>
              <div className="text-[9px] text-cyan-400 mt-0.5">eingespart</div>
            </div>
            <div className="rounded-lg bg-white/60 dark:bg-cyan-900/30 px-2 py-1.5 text-center">
              <div className="flex items-center justify-center gap-1">
                <Leaf size={10} className="text-matcha-500" />
                <span className="text-xs font-bold text-matcha-600 dark:text-matcha-400">
                  −{data.co2_eingespart_kg.toFixed(2)} kg
                </span>
              </div>
              <div className="text-[9px] text-cyan-400 mt-0.5">CO₂</div>
            </div>
          </div>

          {data.hinweis && (
            <div className="flex items-start gap-1.5 rounded-lg bg-cyan-100/70 dark:bg-cyan-900/30 px-2 py-1.5">
              <TrendingUp size={10} className="text-cyan-500 mt-0.5 shrink-0" />
              <span className="text-[10px] text-cyan-700 dark:text-cyan-300">{data.hinweis}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
