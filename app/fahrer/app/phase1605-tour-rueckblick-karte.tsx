'use client';

import React, { useMemo } from 'react';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
  order?: {
    kunde_name?: string | null;
    gesamtbetrag?: number | null;
    bestellnummer?: string | null;
  } | null;
}

interface Batch {
  id: string;
  status?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  stops?: Stop[];
}

interface Props {
  isOnline: boolean;
  lastBatch?: Batch | null;
}

interface RueckblickData {
  stoppCount: number;
  gesamtzeit_min: number;
  avg_eta_min: number;
  trinkgeld_gesamt: number;
  stopps: { name: string; bestellnummer: string; zeit_min: number | null }[];
}

function calcRueckblick(batch: Batch): RueckblickData {
  const stops = (batch.stops ?? []).sort((a, b) => a.reihenfolge - b.reihenfolge);
  const startTs = batch.started_at ? new Date(batch.started_at).getTime() : null;
  const endTs = batch.finished_at ? new Date(batch.finished_at).getTime() : null;
  const gesamtzeit_min = startTs && endTs ? Math.round((endTs - startTs) / 60_000) : 0;

  const stopps = stops.map((s) => {
    let zeit_min: number | null = null;
    if (s.angekommen_am && s.geliefert_am) {
      zeit_min = Math.round(
        (new Date(s.geliefert_am).getTime() - new Date(s.angekommen_am).getTime()) / 60_000,
      );
    }
    return {
      name: s.order?.kunde_name ?? 'Kunde',
      bestellnummer: s.order?.bestellnummer ?? s.id.slice(0, 6),
      zeit_min,
    };
  });

  const validZeiten = stopps.map((s) => s.zeit_min).filter((z): z is number => z !== null);
  const avg_eta_min =
    validZeiten.length > 0
      ? Math.round(validZeiten.reduce((a, b) => a + b, 0) / validZeiten.length)
      : 0;

  const trinkgeld_gesamt = stops.reduce(
    (a, s) => a + (s.order?.gesamtbetrag ?? 0) * 0.05,
    0,
  );

  return {
    stoppCount: stops.length,
    gesamtzeit_min,
    avg_eta_min,
    trinkgeld_gesamt: Math.round(trinkgeld_gesamt * 100) / 100,
    stopps,
  };
}

const MOCK_BATCH: Batch = {
  id: 'mock',
  status: 'abgeschlossen',
  started_at: new Date(Date.now() - 55 * 60_000).toISOString(),
  finished_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  stops: [
    {
      id: 's1', reihenfolge: 1,
      angekommen_am: new Date(Date.now() - 50 * 60_000).toISOString(),
      geliefert_am: new Date(Date.now() - 46 * 60_000).toISOString(),
      order: { kunde_name: 'Max Mustermann', bestellnummer: '#1001', gesamtbetrag: 28.5 },
    },
    {
      id: 's2', reihenfolge: 2,
      angekommen_am: new Date(Date.now() - 35 * 60_000).toISOString(),
      geliefert_am: new Date(Date.now() - 30 * 60_000).toISOString(),
      order: { kunde_name: 'Lisa Müller', bestellnummer: '#1002', gesamtbetrag: 18.9 },
    },
    {
      id: 's3', reihenfolge: 3,
      angekommen_am: new Date(Date.now() - 18 * 60_000).toISOString(),
      geliefert_am: new Date(Date.now() - 13 * 60_000).toISOString(),
      order: { kunde_name: 'Tom Becker', bestellnummer: '#1003', gesamtbetrag: 34.2 },
    },
  ],
};

export function FahrerPhase1605TourRueckblickKarte({ isOnline, lastBatch }: Props) {
  const batch = lastBatch ?? MOCK_BATCH;

  const data = useMemo(() => calcRueckblick(batch), [batch]);

  if (!isOnline && !lastBatch) return null;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-matcha-700 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Tour-Rückblick</span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
          {data.stoppCount} Stopps
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI-Zeile */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-matcha-50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-matcha-700">{data.stoppCount}</div>
            <div className="text-xs text-gray-500">Stopps</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-blue-700">{data.gesamtzeit_min} min</div>
            <div className="text-xs text-gray-500">Gesamtzeit</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-amber-700">
              {data.avg_eta_min > 0 ? `${data.avg_eta_min} min` : '—'}
            </div>
            <div className="text-xs text-gray-500">Ø ETA/Stopp</div>
          </div>
        </div>

        {/* Trinkgeld */}
        {data.trinkgeld_gesamt > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-emerald-800">Trinkgeld (geschätzt)</span>
            <span className="text-lg font-bold text-emerald-700">
              + {data.trinkgeld_gesamt.toFixed(2)} €
            </span>
          </div>
        )}

        {/* Stopp-Liste */}
        {data.stopps.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stopps</div>
            {data.stopps.map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                <span className="w-6 h-6 rounded-full bg-matcha-100 text-matcha-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700 flex-1">{s.name}</span>
                <span className="text-xs text-gray-400">{s.bestellnummer}</span>
                {s.zeit_min !== null && (
                  <span className="text-xs font-medium text-matcha-700 bg-matcha-50 rounded-full px-2 py-0.5">
                    {s.zeit_min} min
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
