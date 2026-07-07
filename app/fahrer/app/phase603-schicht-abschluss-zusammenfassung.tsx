'use client';

import { useEffect, useState } from 'react';
import { Bike, Clock, Euro, MapPin, Package, Star, TrendingUp } from 'lucide-react';
import { euro } from '@/lib/utils';

type ZusammenfassungData = {
  touren: number;
  lieferungen: number;
  distKm: number;
  betrag: number;
  trinkgeld: number;
  onlineMin: number;
  avgBewertung: number | null;
};

export function FahrerPhase603SchichtAbschlussZusammenfassung({
  driverId,
}: {
  driverId: string;
}) {
  const [data, setData] = useState<ZusammenfassungData | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/delivery/driver/my-performance?period=today', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const d = await res.json();
        setData({
          touren: d.tours ?? d.touren ?? 0,
          lieferungen: d.deliveries ?? d.lieferungen ?? 0,
          distKm: Math.round((d.distKm ?? d.total_distance_km ?? 0) * 10) / 10,
          betrag: d.betrag ?? d.total_earnings ?? 0,
          trinkgeld: d.trinkgeld ?? d.tips ?? 0,
          onlineMin: d.onlineMin ?? d.online_minutes ?? 0,
          avgBewertung: d.avgRating ?? d.avg_rating ?? null,
        });
      } catch {}
    };
    load();
  }, [driverId]);

  if (!data) return null;
  if (data.touren === 0 && data.lieferungen === 0) return null;

  const onlineH = Math.floor(data.onlineMin / 60);
  const onlineM = data.onlineMin % 60;
  const hourlyRate = data.onlineMin > 0
    ? Math.round((data.betrag / data.onlineMin) * 60 * 100) / 100
    : null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-matcha-600 to-matcha-800 text-white p-5 shadow-lg shadow-matcha-900/20">
      <div className="flex items-center gap-2 mb-4">
        <Bike className="w-5 h-5 text-matcha-200" />
        <span className="text-sm font-bold text-matcha-100">Schicht-Zusammenfassung</span>
        {data.onlineMin > 0 && (
          <span className="ml-auto flex items-center gap-1 text-matcha-200 text-xs">
            <Clock className="w-3.5 h-3.5" />
            {onlineH > 0 ? `${onlineH}h ` : ''}{onlineM}m
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white/10 rounded-xl px-3 py-2.5">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-matcha-200 mb-0.5">
            Touren
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black tabular-nums">{data.touren}</span>
            <span className="text-matcha-300 text-xs">{data.lieferungen} Stops</span>
          </div>
        </div>

        <div className="bg-white/10 rounded-xl px-3 py-2.5">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-matcha-200 mb-0.5">
            Strecke
          </div>
          <div className="flex items-baseline gap-1">
            <MapPin className="w-3.5 h-3.5 text-matcha-300 shrink-0 mb-0.5" />
            <span className="text-2xl font-black tabular-nums">{data.distKm}</span>
            <span className="text-matcha-300 text-xs">km</span>
          </div>
        </div>

        <div className="bg-white/10 rounded-xl px-3 py-2.5">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-matcha-200 mb-0.5">
            Liefergebühren
          </div>
          <div className="flex items-baseline gap-1">
            <Euro className="w-3.5 h-3.5 text-matcha-300 shrink-0 mb-0.5" />
            <span className="text-2xl font-black tabular-nums">
              {euro(data.betrag)}
            </span>
          </div>
        </div>

        <div className="bg-white/10 rounded-xl px-3 py-2.5">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-matcha-200 mb-0.5">
            Trinkgeld
          </div>
          <div className="flex items-baseline gap-1">
            <Package className="w-3.5 h-3.5 text-matcha-300 shrink-0 mb-0.5" />
            <span className="text-2xl font-black tabular-nums">
              {euro(data.trinkgeld)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {hourlyRate && (
          <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-2">
            <TrendingUp className="w-3.5 h-3.5 text-matcha-300" />
            <span className="text-xs font-bold tabular-nums">
              {euro(hourlyRate)}/h
            </span>
          </div>
        )}
        {data.avgBewertung !== null && (
          <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-2">
            <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span className="text-xs font-bold tabular-nums">
              {data.avgBewertung.toFixed(1)}
            </span>
          </div>
        )}
        <div className="ml-auto text-xs text-matcha-300 font-semibold">
          Gesamt: {euro(data.betrag + data.trinkgeld)}
        </div>
      </div>
    </div>
  );
}
