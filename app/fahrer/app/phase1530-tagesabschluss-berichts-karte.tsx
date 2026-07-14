'use client';

import React from 'react';

interface Stop {
  status?: string;
  deliveredAt?: string;
  earnedCents?: number;
  distanceKm?: number;
  deliveryMinutes?: number;
  rating?: number;
}

interface Props {
  isOnline?: boolean;
  stops?: Stop[];
  schichtStartedAt?: string;
}

function avg(values: number[]) {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function FahrerPhase1530TagesabschlussBerichtsKarte({ isOnline = false, stops = [], schichtStartedAt }: Props) {
  if (isOnline) return null;

  const delivered = stops.filter(s => s.status === 'delivered');
  if (delivered.length === 0) return null;

  const totalStopps = delivered.length;
  const totalEarnedCents = delivered.reduce((a, s) => a + (s.earnedCents ?? 0), 0);
  const totalKm = delivered.reduce((a, s) => a + (s.distanceKm ?? 0), 0);
  const avgDeliveryMin = Math.round(avg(delivered.filter(s => s.deliveryMinutes != null).map(s => s.deliveryMinutes!)));
  const avgRating = avg(delivered.filter(s => s.rating != null).map(s => s.rating!));

  const schichtDauerMin = schichtStartedAt
    ? Math.round((Date.now() - new Date(schichtStartedAt).getTime()) / 60000)
    : null;

  const eurosFormatted = (totalEarnedCents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="rounded-xl border-2 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950/30 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🏁</span>
        <div>
          <h3 className="text-sm font-bold text-green-800 dark:text-green-300">Schicht-Abschluss</h3>
          <p className="text-xs text-green-700 dark:text-green-400">
            {schichtDauerMin != null ? `${Math.floor(schichtDauerMin / 60)}h ${schichtDauerMin % 60}min Schicht beendet` : 'Schicht beendet'}
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white dark:bg-black/20 p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{totalStopps}</div>
          <div className="text-[10px] text-muted-foreground">Stopps geliefert</div>
        </div>
        <div className="rounded-lg bg-white dark:bg-black/20 p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{eurosFormatted} €</div>
          <div className="text-[10px] text-muted-foreground">Verdienst</div>
        </div>
        <div className="rounded-lg bg-white dark:bg-black/20 p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{totalKm.toFixed(1)} km</div>
          <div className="text-[10px] text-muted-foreground">Gefahrene km</div>
        </div>
        <div className="rounded-lg bg-white dark:bg-black/20 p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{avgDeliveryMin > 0 ? `${avgDeliveryMin} Min` : '—'}</div>
          <div className="text-[10px] text-muted-foreground">Ø Lieferzeit</div>
        </div>
      </div>

      {/* Bewertung */}
      {avgRating > 0 && (
        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 px-3 py-2 flex items-center gap-2">
          <span className="text-yellow-500 text-lg">★</span>
          <span className="text-sm font-bold text-yellow-700 dark:text-yellow-400">{avgRating.toFixed(1)}</span>
          <span className="text-xs text-yellow-600 dark:text-yellow-500">Ø Kundenbewertung</span>
        </div>
      )}

      <p className="text-xs text-center text-green-700 dark:text-green-400 font-medium">
        Tolle Schicht! Bis zum nächsten Mal. 👏
      </p>
    </div>
  );
}
