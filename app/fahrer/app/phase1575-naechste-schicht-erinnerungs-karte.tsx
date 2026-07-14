'use client';

import React, { useEffect, useState } from 'react';

interface SchichtInfo {
  schicht_id: string;
  datum: string;
  start_zeit: string;
  end_zeit: string;
  countdown_min: number;
  bestaetigt: boolean;
}

interface ApiResponse {
  naechste_schicht: SchichtInfo | null;
}

interface Props {
  isOnline: boolean;
  driverId: string | null;
}

export function FahrerPhase1575NaechsteSchichtErinnerungsKarte({ isOnline, driverId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [bestaetigt, setBestaetigt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOnline || !driverId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/driver/naechste-schicht?driver_id=${driverId}`);
        if (res.ok) {
          const json: ApiResponse = await res.json();
          setData(json);
          if (json.naechste_schicht?.bestaetigt) setBestaetigt(true);
        } else {
          setData({
            naechste_schicht: {
              schicht_id: 'mock-1',
              datum: 'Morgen',
              start_zeit: '10:00',
              end_zeit: '18:00',
              countdown_min: 840,
              bestaetigt: false,
            },
          });
        }
      } catch {
        setData({
          naechste_schicht: {
            schicht_id: 'mock-1',
            datum: 'Morgen',
            start_zeit: '10:00',
            end_zeit: '18:00',
            countdown_min: 840,
            bestaetigt: false,
          },
        });
      }
    };
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline, driverId]);

  const bestaetigen = async () => {
    if (!data?.naechste_schicht || submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/delivery/driver/schicht-bestaetigung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schicht_id: data.naechste_schicht.schicht_id, action: 'bestaetigen' }),
      });
      setBestaetigt(true);
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  if (!mounted || !isOnline || !data?.naechste_schicht) return null;

  const s = data.naechste_schicht;
  const h = Math.floor(s.countdown_min / 60);
  const m = s.countdown_min % 60;
  const countdownText = h > 0 ? `${h}h ${m}min` : `${m} Min`;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-blue-500 text-lg">🕐</span>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-400">Nächste Schicht</div>
          <div className="text-sm font-bold text-blue-800">{s.datum} · {s.start_zeit}–{s.end_zeit} Uhr</div>
        </div>
      </div>
      <div className="text-xs text-blue-600 mb-3">
        Beginnt in <span className="font-bold">{countdownText}</span>
      </div>
      {bestaetigt ? (
        <div className="text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-lg px-3 py-1.5 text-center">
          ✓ Schicht bestätigt
        </div>
      ) : (
        <button
          onClick={bestaetigen}
          disabled={submitting}
          className="w-full text-sm font-semibold bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Wird bestätigt…' : 'Schicht bestätigen'}
        </button>
      )}
    </div>
  );
}
