'use client';

import { useEffect, useState } from 'react';
import { Bike, Star, Clock, MapPin } from 'lucide-react';

type FahrerProfil = {
  name: string;
  avgRating: number | null;
  toursThisMonth: number | null;
  etaMin: number | null;
  vehicle: string | null;
};

export function Phase604FahrerProfilVorschau({
  orderId,
  locationId,
}: {
  orderId: string | null;
  locationId: string;
}) {
  const [profil, setProfil] = useState<FahrerProfil | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/delivery/tracking/${orderId}/driver-preview`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const d = await res.json();
        if (!d.name) return;
        setProfil({
          name: d.name,
          avgRating: d.avgRating ?? d.avg_rating ?? null,
          toursThisMonth: d.toursThisMonth ?? d.tours_this_month ?? null,
          etaMin: d.etaMin ?? d.eta_min ?? null,
          vehicle: d.vehicle ?? d.fahrzeug ?? null,
        });
      } catch {}
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [orderId]);

  if (!profil) return null;

  const vehicleLabel = profil.vehicle === 'fahrrad' ? '🚲'
    : profil.vehicle === 'motorrad' ? '🏍️'
    : profil.vehicle === 'auto' ? '🚗' : '🚴';

  return (
    <div className="rounded-2xl bg-gradient-to-r from-stone-50 to-stone-100 border border-stone-200 p-4">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-matcha-100 border-2 border-matcha-200 flex items-center justify-center shrink-0">
          <span className="text-2xl">{vehicleLabel}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-char text-sm truncate">{profil.name}</span>
            {profil.avgRating !== null && (
              <div className="flex items-center gap-0.5 shrink-0">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="text-xs font-bold text-amber-700 tabular-nums">
                  {profil.avgRating.toFixed(1)}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {profil.toursThisMonth !== null && (
              <div className="flex items-center gap-1 text-[10px] text-stone-500">
                <Bike className="w-3 h-3" />
                <span>{profil.toursThisMonth} Touren diesen Monat</span>
              </div>
            )}
          </div>
        </div>

        {/* ETA */}
        {profil.etaMin !== null && (
          <div className="shrink-0 text-right">
            <div className="flex items-center gap-1 text-matcha-700">
              <Clock className="w-4 h-4" />
              <span className="text-lg font-black tabular-nums">{profil.etaMin}'</span>
            </div>
            <div className="text-[9px] text-stone-400 font-medium">ETA</div>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-stone-500">
        <MapPin className="w-3 h-3 text-matcha-500" />
        <span>Dein Fahrer ist unterwegs zu dir</span>
      </div>
    </div>
  );
}
