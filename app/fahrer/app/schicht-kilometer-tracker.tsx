'use client';

import * as React from 'react';

// Mock — API-Anbindung folgt
const INITIAL_KM = parseFloat((Math.random() * 26 + 8).toFixed(1));
const CO2_PER_KM_CAR = 0.121; // kg CO2 per km (Pkw-Durchschnitt)
const CO2_PER_KM_BIKE = 0.0;  // Fahrrad: 0 CO2

interface Props {
  fahrzeug: string | null;
}

function formatKm(km: number): string {
  return km.toFixed(1);
}

function getAvgSpeed(km: number): number {
  // Simulate ~2.5h shift
  return parseFloat((km / 2.5).toFixed(1));
}

export function SchichtKilometerTracker({ fahrzeug }: Props) {
  const [km, setKm] = React.useState(INITIAL_KM);
  const [animated, setAnimated] = React.useState(false);

  React.useEffect(() => {
    const iv = setInterval(() => {
      setKm((prev) => parseFloat((prev + 0.1).toFixed(1)));
      setAnimated(true);
      setTimeout(() => setAnimated(false), 600);
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  const isBike = fahrzeug?.toLowerCase().includes('rad') || fahrzeug?.toLowerCase().includes('bike');
  const co2Saved = parseFloat((km * CO2_PER_KM_CAR).toFixed(2));
  const avgSpeed = getAvgSpeed(km);

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50 p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-matcha-700">Schicht-Kilometer</span>
        {(isBike || !fahrzeug) && (
          <span className="text-xs font-medium text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5">
            🌿 {co2Saved} kg CO₂ gespart
          </span>
        )}
      </div>

      <div className="flex items-end gap-2 mb-3">
        <span
          className={`text-4xl font-bold text-matcha-700 transition-all duration-300 ${animated ? 'scale-110 text-matcha-500' : ''}`}
          style={{ display: 'inline-block' }}
        >
          {formatKm(km)}
        </span>
        <span className="text-lg font-medium text-matcha-500 mb-1">km</span>
      </div>

      <div className="flex gap-4 text-xs text-gray-600">
        <div className="flex flex-col">
          <span className="text-gray-400">Ø Geschw.</span>
          <span className="font-semibold text-matcha-700">{avgSpeed} km/h</span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-400">Fahrzeug</span>
          <span className="font-semibold text-matcha-700">{fahrzeug ?? '—'}</span>
        </div>
        {!isBike && fahrzeug && (
          <div className="flex flex-col">
            <span className="text-gray-400">CO₂ vs. Rad</span>
            <span className="font-semibold text-amber-600">+{co2Saved} kg</span>
          </div>
        )}
      </div>
    </div>
  );
}
