'use client';

import React, { useEffect, useState } from 'react';

interface SchichtInfo {
  schicht_id: string;
  start_zeit: string;
  end_zeit: string;
  rest_minuten: number;
  letzte_tour_eta_min: number | null;
  weitere_tour_sinnvoll: boolean;
  empfehlung: string;
}

interface ApiResponse {
  schicht: SchichtInfo | null;
}

interface Props {
  isOnline: boolean;
  driverId: string | null;
}

const MOCK_SCHICHT: SchichtInfo = {
  schicht_id: 'mock-shift-1',
  start_zeit: '10:00',
  end_zeit: '18:00',
  rest_minuten: 87,
  letzte_tour_eta_min: 22,
  weitere_tour_sinnvoll: true,
  empfehlung: 'Noch 1–2 Touren möglich vor Schichtende.',
};

function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m} Min`;
}

export function FahrerPhase1580SchichtCountdownTimer({ isOnline, driverId }: Props) {
  const [schicht, setSchicht] = useState<SchichtInfo | null>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOnline || !driverId || !mounted) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/driver/aktive-schicht?driver_id=${driverId}`);
        if (res.ok) {
          const json: ApiResponse = await res.json();
          setSchicht(json.schicht);
        } else {
          setSchicht(MOCK_SCHICHT);
        }
      } catch {
        setSchicht(MOCK_SCHICHT);
      }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline, driverId, mounted]);

  if (!mounted || !isOnline || !schicht || !open) return null;

  const urgency = schicht.rest_minuten <= 30;
  const empfehlungColor = schicht.weitere_tour_sinnvoll
    ? 'text-emerald-700'
    : 'text-rose-700';

  return (
    <div
      className={`rounded-xl border p-3 mb-3 ${
        urgency
          ? 'bg-rose-50 border-rose-200'
          : 'bg-sky-50 border-sky-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              urgency ? 'bg-rose-400 animate-pulse' : 'bg-sky-400'
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${
              urgency ? 'text-rose-600' : 'text-sky-600'
            }`}
          >
            Schicht-Countdown
          </div>
          <div className={`text-sm font-bold ${urgency ? 'text-rose-800' : 'text-sky-800'}`}>
            Noch {formatMin(schicht.rest_minuten)} bis {schicht.end_zeit} Uhr
          </div>
          {schicht.letzte_tour_eta_min != null && (
            <div className={`text-xs mt-0.5 ${urgency ? 'text-rose-600' : 'text-sky-600'}`}>
              ETA letzter Stopp: {schicht.letzte_tour_eta_min} Min
            </div>
          )}
          <div className={`text-xs mt-1 font-medium ${empfehlungColor}`}>
            {schicht.empfehlung}
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className={`text-lg leading-none opacity-40 hover:opacity-70 shrink-0 ${
            urgency ? 'text-rose-700' : 'text-sky-700'
          }`}
          aria-label="Schließen"
        >
          ×
        </button>
      </div>
    </div>
  );
}
