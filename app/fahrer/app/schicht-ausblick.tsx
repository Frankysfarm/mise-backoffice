'use client';

import { useEffect, useState } from 'react';
import { Euro, Clock, Package, TrendingUp } from 'lucide-react';
import { euro, cn } from '@/lib/utils';

interface AusblickData {
  bisherige_einnahmen: number;
  prognose_gesamt: number;
  verstrichene_min: number;
  schicht_dauer_min: number;
  stops_erledigt: number;
  stops_prognose_gesamt: number;
  effizienz_pct: number;
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-matcha-700/40 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
    </div>
  );
}

export function FahrerSchichtAusblick({
  driverId,
  bisherige_einnahmen,
  stops_erledigt,
  schicht_start,
}: {
  driverId?: string;
  bisherige_einnahmen?: number;
  stops_erledigt?: number;
  schicht_start?: string;
}) {
  const [data, setData] = useState<AusblickData | null>(null);

  useEffect(() => {
    const startMs = schicht_start ? new Date(schicht_start).getTime() : Date.now() - 90 * 60_000;
    const verstricheneMin = Math.round((Date.now() - startMs) / 60_000);
    const schichtDauerMin = 480;
    const fortschritt = Math.min(verstricheneMin / schichtDauerMin, 1);

    const bisherEin = bisherige_einnahmen ?? 38.5;
    const stopsGemacht = stops_erledigt ?? 4;

    const rate = fortschritt > 0.05 ? bisherEin / fortschritt : bisherEin * 2;
    const prognoseGesamt = Math.round(rate * 10) / 10;
    const stopsPrognose = fortschritt > 0.05 ? Math.round(stopsGemacht / fortschritt) : stopsGemacht * 8;

    setData({
      bisherige_einnahmen: bisherEin,
      prognose_gesamt: prognoseGesamt,
      verstrichene_min: verstricheneMin,
      schicht_dauer_min: schichtDauerMin,
      stops_erledigt: stopsGemacht,
      stops_prognose_gesamt: stopsPrognose,
      effizienz_pct: Math.min(100, Math.round(fortschritt > 0 ? (bisherEin / (rate * 0.85)) * 100 : 75)),
    });
  }, [bisherige_einnahmen, stops_erledigt, schicht_start]);

  if (!data) return null;

  const zeitFortschritt = data.verstrichene_min / data.schicht_dauer_min;
  const restMin = Math.max(0, data.schicht_dauer_min - data.verstrichene_min);
  const restH = Math.floor(restMin / 60);
  const restM = restMin % 60;

  const effizienzColor = data.effizienz_pct >= 80 ? '#4ade80' : data.effizienz_pct >= 60 ? '#facc15' : '#fb923c';

  return (
    <div className="rounded-2xl border border-matcha-700/40 bg-matcha-800/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-matcha-700/30 flex items-center justify-between">
        <span className="text-[11px] font-black text-matcha-100 uppercase tracking-wider">
          Schicht-Ausblick
        </span>
        <span className="text-[10px] text-matcha-400">
          {restH > 0 ? `${restH}h ${restM}m` : `${restMin}m`} verbleibend
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Schicht-Fortschritt */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-matcha-400">Schichtzeit</span>
            <span className="text-matcha-200 font-bold">
              {data.verstrichene_min} / {data.schicht_dauer_min} Min
            </span>
          </div>
          <ProgressBar pct={zeitFortschritt * 100} color="#55a47c" />
        </div>

        {/* Einnahmen */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-matcha-800/40 border border-matcha-700/30 px-3 py-2">
            <div className="flex items-center gap-1 mb-0.5">
              <Euro size={11} className="text-matcha-400" />
              <span className="text-[9px] text-matcha-400 uppercase font-bold">Bisher</span>
            </div>
            <div className="text-base font-black text-accent tabular-nums">
              {euro(data.bisherige_einnahmen)}
            </div>
          </div>
          <div className="rounded-xl bg-matcha-800/40 border border-matcha-700/30 px-3 py-2">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp size={11} className="text-matcha-400" />
              <span className="text-[9px] text-matcha-400 uppercase font-bold">Prognose</span>
            </div>
            <div className="text-base font-black text-matcha-100 tabular-nums">
              {euro(data.prognose_gesamt)}
            </div>
          </div>
        </div>

        {/* Stops + Effizienz */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-matcha-300">
            <Package size={12} className="text-matcha-400" />
            <span>
              <span className="font-black text-matcha-100">{data.stops_erledigt}</span>
              <span className="text-matcha-500"> / ~{data.stops_prognose_gesamt} Stopps</span>
            </span>
          </div>
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-full"
            style={{ background: `${effizienzColor}25`, color: effizienzColor }}
          >
            {data.effizienz_pct}% Effizienz
          </span>
        </div>
      </div>
    </div>
  );
}
