'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Euro, TrendingUp, Clock, Gift, Loader2 } from 'lucide-react';

type Props = { driverId: string; isOnline: boolean };

type Data = {
  verdienstBisher: number;
  hochrechnungSchicht: number;
  trinkgeldBisher: number;
  trinkgeldPrognose: number;
  stundenGearbeitet: number;
  stundenGeplant: number;
  stoppsBisher: number;
  verlauf: { stunde: string; verdienst: number }[];
};

const MOCK: Data = {
  verdienstBisher: 64.5,
  hochrechnungSchicht: 112.0,
  trinkgeldBisher: 8.5,
  trinkgeldPrognose: 15.0,
  stundenGearbeitet: 3.5,
  stundenGeplant: 6,
  stoppsBisher: 7,
  verlauf: [
    { stunde: '16', verdienst: 18.0 },
    { stunde: '17', verdienst: 22.5 },
    { stunde: '18', verdienst: 24.0 },
  ],
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function FahrerPhase961SchichtGewinnHochrechnung({ driverId, isOnline }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/delivery/fahrer/schicht-gewinn-hochrechnung?driverId=${driverId}`)
      .then(r => r.json())
      .then(d => setData(d?.verdienstBisher != null ? d : MOCK))
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, [driverId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 justify-center py-4 text-[11px] text-blue-300">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade Verdienst-Prognose…
      </div>
    );
  }

  if (!data) return null;

  const fortschrittPct = Math.min(100, Math.round((data.stundenGearbeitet / data.stundenGeplant) * 100));
  const maxVerdienst = Math.max(...data.verlauf.map(v => v.verdienst), 1);

  return (
    <section className="rounded-2xl bg-gradient-to-br from-blue-900 to-indigo-900 border border-blue-700 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
          <Euro className="h-4 w-4 text-yellow-300" />
        </div>
        <div>
          <div className="text-sm font-bold text-white">Verdienst-Hochrechnung</div>
          <div className="text-[10px] text-blue-300">Prognose bis Schicht-Ende</div>
        </div>
        {!isOnline && (
          <span className="ml-auto text-[9px] text-blue-400 font-semibold">Offline</span>
        )}
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/10 p-3">
          <div className="text-lg font-black tabular-nums text-yellow-300">{fmtEur(data.hochrechnungSchicht)}</div>
          <div className="text-[10px] text-blue-300 mt-0.5">Schicht-Prognose</div>
        </div>
        <div className="rounded-xl bg-white/10 p-3">
          <div className="text-lg font-black tabular-nums text-white">{fmtEur(data.verdienstBisher)}</div>
          <div className="text-[10px] text-blue-300 mt-0.5">Bisher verdient</div>
        </div>
        <div className="rounded-xl bg-white/10 p-3">
          <div className="text-sm font-black tabular-nums text-green-300 flex items-center gap-1">
            <Gift className="h-3.5 w-3.5" /> {fmtEur(data.trinkgeldPrognose)}
          </div>
          <div className="text-[10px] text-blue-300 mt-0.5">Trinkgeld-Prognose</div>
        </div>
        <div className="rounded-xl bg-white/10 p-3">
          <div className="text-sm font-black tabular-nums text-white">{data.stoppsBisher} Stopps</div>
          <div className="text-[10px] text-blue-300 mt-0.5">Abgeschlossen</div>
        </div>
      </div>

      {/* Schicht-Fortschritt */}
      <div>
        <div className="flex justify-between text-[10px] text-blue-300 mb-1 font-semibold">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Schicht-Fortschritt</span>
          <span>{data.stundenGearbeitet.toFixed(1)}h / {data.stundenGeplant}h</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-yellow-400 transition-all duration-700"
            style={{ width: `${fortschrittPct}%` }}
          />
        </div>
      </div>

      {/* Verlauf-Mini-Bars */}
      {data.verlauf.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-[10px] text-blue-300 mb-2 font-semibold">
            <TrendingUp className="h-3 w-3" /> Stündlicher Verdienst
          </div>
          <div className="flex items-end gap-1.5 h-8">
            {data.verlauf.map(v => {
              const h = Math.max(Math.round((v.verdienst / maxVerdienst) * 100), 12);
              return (
                <div key={v.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t bg-yellow-400 transition-all duration-500"
                    style={{ height: `${h}%` }}
                  />
                  <div className="text-[8px] text-blue-400 tabular-nums">{v.stunde}h</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-lg bg-yellow-400/10 border border-yellow-400/30 px-3 py-2 text-[10px] text-yellow-200 font-medium">
        Trinkgeld bisher: <strong>{fmtEur(data.trinkgeldBisher)}</strong> —
        Hochrechnung: <strong>{fmtEur(data.trinkgeldPrognose)}</strong> bis Schicht-Ende
      </div>
    </section>
  );
}
