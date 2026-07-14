'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface Props {
  isOnline: boolean;
  driverId: string | null;
}

interface WochenzielData {
  wochenziel: number;
  verdient_diese_woche: number;
  fortschritt_pct: number;
  restbetrag: number;
  schichten_verbleibend: number;
  prognose_ende_woche: number;
  status: 'auf_kurs' | 'fast_da' | 'erreicht' | 'hinterher';
}

const WOCHENZIEL_DEFAULT = 50;

const MOCK_DATA: WochenzielData = {
  wochenziel: WOCHENZIEL_DEFAULT,
  verdient_diese_woche: 32.4,
  fortschritt_pct: 64.8,
  restbetrag: 17.6,
  schichten_verbleibend: 3,
  prognose_ende_woche: 48.6,
  status: 'auf_kurs',
};

const STATUS_STYLE: Record<string, { label: string; color: string; bar: string }> = {
  erreicht:   { label: 'Ziel erreicht!',  color: 'text-emerald-700', bar: 'bg-emerald-500' },
  fast_da:    { label: 'Fast geschafft!', color: 'text-matcha-700',  bar: 'bg-matcha-500'  },
  auf_kurs:   { label: 'Auf Kurs',        color: 'text-blue-700',    bar: 'bg-blue-500'    },
  hinterher:  { label: 'Hinterher',       color: 'text-amber-700',   bar: 'bg-amber-400'   },
};

export function FahrerPhase1610TrinkgeldWochenzielTracker({ isOnline, driverId }: Props) {
  const [data, setData] = useState<WochenzielData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId) { setData(MOCK_DATA); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/driver-app/trinkgeld-wochenziel?driver_id=${encodeURIComponent(driverId)}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(MOCK_DATA);
      }
    } catch {
      setData(MOCK_DATA);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline && !data) return null;

  const d = data ?? MOCK_DATA;
  const ss = STATUS_STYLE[d.status] ?? STATUS_STYLE['auf_kurs'];
  const pct = Math.min(100, Math.round(d.fortschritt_pct));

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm animate-pulse">
        <div className="h-4 bg-emerald-100 rounded w-1/2 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-3/4" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-emerald-700 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Trinkgeld-Wochenziel</span>
        <span className={`text-xs font-bold rounded-full px-2 py-0.5 bg-white/20`}>
          {ss.label}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Hauptzahl + Ziel */}
        <div className="flex items-end justify-between">
          <div>
            <div className={`text-3xl font-black tabular-nums ${ss.color}`}>
              {d.verdient_diese_woche.toFixed(2)} €
            </div>
            <div className="text-xs text-gray-400">diese Woche</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-600">{d.wochenziel.toFixed(2)} €</div>
            <div className="text-xs text-gray-400">Ziel</div>
          </div>
        </div>

        {/* Fortschrittsbalken */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{pct} % erreicht</span>
            {d.restbetrag > 0 && <span>noch {d.restbetrag.toFixed(2)} € fehlen</span>}
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${ss.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Prognose */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
          <div className="text-xs text-gray-500">Prognose Ende Woche</div>
          <div className="text-sm font-bold text-gray-800">
            {d.prognose_ende_woche.toFixed(2)} €
            {d.prognose_ende_woche >= d.wochenziel && (
              <span className="ml-1 text-emerald-600 text-xs">✓</span>
            )}
          </div>
        </div>

        {d.schichten_verbleibend > 0 && d.restbetrag > 0 && (
          <div className="text-xs text-gray-400 text-center">
            {d.schichten_verbleibend} Schicht{d.schichten_verbleibend !== 1 ? 'en' : ''} verbleibend ·
            ca. {(d.restbetrag / d.schichten_verbleibend).toFixed(2)} € / Schicht nötig
          </div>
        )}
      </div>
    </div>
  );
}
