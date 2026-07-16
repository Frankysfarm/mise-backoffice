'use client';

import { useState, useEffect } from 'react';
import { Clock, ChevronUp, ChevronDown, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StundenSlot {
  stunde: string;
  erwartete_fahrer: number;
  ampel: string;
  alert: boolean;
}

interface ForecastData {
  slots: StundenSlot[];
  engpass_count: number;
}

const MOCK: ForecastData = {
  slots: [
    { stunde: '14:00', erwartete_fahrer: 4, ampel: 'gruen', alert: false },
    { stunde: '15:00', erwartete_fahrer: 3, ampel: 'gruen', alert: false },
    { stunde: '16:00', erwartete_fahrer: 2, ampel: 'gelb',  alert: false },
    { stunde: '17:00', erwartete_fahrer: 1, ampel: 'rot',   alert: true  },
  ],
  engpass_count: 1,
};

function pauseEmpfehlung(slots: StundenSlot[]): string {
  const ruhigerSlot = slots.find((s) => s.erwartete_fahrer >= 3);
  if (ruhigerSlot) return `Pause empfohlen um ${ruhigerSlot.stunde} — Team hat genug Kapazität`;
  return 'Heute stark ausgelastet — Pause nach Absprache';
}

export function FahrerPhase2009MeinSchichtForecast({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [daten, setDaten] = useState<ForecastData | null>(null);
  const [offen, setOffen] = useState(true);

  const laden = async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-verfuegbarkeits-forecast?location_id=${locationId}`);
      if (!res.ok) { setDaten(MOCK); return; }
      const json: ForecastData = await res.json();
      setDaten(json);
    } catch {
      setDaten(MOCK);
    }
  };

  useEffect(() => {
    if (!isOnline) return;
    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId, isOnline]);

  if (!isOnline) return null;

  const anzeige = daten ?? MOCK;
  const heuteFahrer = anzeige.slots.map((s) => s.erwartete_fahrer);
  const maxFahrer = Math.max(...heuteFahrer, 1);
  const empfehlung = pauseEmpfehlung(anzeige.slots);
  const hatEngpass = anzeige.engpass_count > 0;

  return (
    <section className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold text-white">Mein Schicht-Forecast</span>
          {hatEngpass && (
            <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-bold">Engpass</span>
          )}
        </div>
        {offen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {offen && (
        <div className="border-t border-slate-700/50 px-4 pb-4 space-y-3 pt-3">
          <div className="space-y-2">
            {anzeige.slots.map((slot) => {
              const pct = Math.round((slot.erwartete_fahrer / maxFahrer) * 100);
              const barColor = slot.ampel === 'gruen'
                ? 'bg-green-500'
                : slot.ampel === 'gelb'
                  ? 'bg-amber-500'
                  : 'bg-red-500';
              return (
                <div key={slot.stunde} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400 w-11 shrink-0">{slot.stunde}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', barColor)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 w-6 shrink-0 text-right">
                    {slot.erwartete_fahrer}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-slate-700/40 px-3 py-2">
            <Coffee className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-slate-300">{empfehlung}</p>
          </div>

          {driverId && (
            <p className="text-[9px] text-slate-500 text-right">
              Nächste Aktualisierung in 30 Min
            </p>
          )}
        </div>
      )}
    </section>
  );
}
