'use client';

import { useState, useEffect } from 'react';
import { Users, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Ampel = 'gruen' | 'gelb' | 'rot';

interface StundenSlot {
  stunde: string;
  stunde_utc: string;
  erwartete_fahrer: number;
  ampel: Ampel;
  alert: boolean;
  fahrer_namen: string[];
}

interface ForecastData {
  location_id: string;
  slots: StundenSlot[];
  engpass_count: number;
  generiert_am: string;
}

const MOCK: ForecastData = {
  location_id: 'mock',
  slots: [
    { stunde: '14:00', stunde_utc: '', erwartete_fahrer: 4, ampel: 'gruen', alert: false, fahrer_namen: ['Max', 'Lisa', 'Tom', 'Anna'] },
    { stunde: '15:00', stunde_utc: '', erwartete_fahrer: 3, ampel: 'gruen', alert: false, fahrer_namen: ['Max', 'Lisa', 'Tom'] },
    { stunde: '16:00', stunde_utc: '', erwartete_fahrer: 2, ampel: 'gelb',  alert: false, fahrer_namen: ['Lisa', 'Tom'] },
    { stunde: '17:00', stunde_utc: '', erwartete_fahrer: 1, ampel: 'rot',   alert: true,  fahrer_namen: ['Lisa'] },
  ],
  engpass_count: 1,
  generiert_am: new Date().toISOString(),
};

const MAX_FAHRER = 5;

const AMPEL_COLORS: Record<Ampel, { bar: string; dot: string; text: string }> = {
  gruen: { bar: 'bg-green-500', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400' },
  gelb:  { bar: 'bg-amber-500', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  rot:   { bar: 'bg-red-500',   dot: 'bg-red-500',   text: 'text-red-600 dark:text-red-400'     },
};

export function DispatchPhase2008VerfuegbarkeitsTimeline({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [daten, setDaten] = useState<ForecastData | null>(null);
  const [offen, setOffen] = useState(true);

  const laden = async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-verfuegbarkeits-forecast?location_id=${locationId}`);
      if (!res.ok) { setDaten(MOCK); return; }
      setDaten(await res.json());
    } catch {
      setDaten(MOCK);
    }
  };

  useEffect(() => {
    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId) return null;

  const anzeige = daten ?? MOCK;

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-sky-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Verfügbarkeits-Forecast (4h)</span>
          {anzeige.engpass_count > 0 && (
            <span className="text-[10px] bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full font-bold">
              {anzeige.engpass_count} Engpass{anzeige.engpass_count !== 1 ? '¨e' : ''}
            </span>
          )}
        </div>
        {offen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {offen && (
        <div className="border-t border-slate-100 dark:border-slate-700">
          {anzeige.engpass_count > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                Personalengpass in den nächsten 4 Stunden — weniger als 2 Fahrer erwartet
              </p>
            </div>
          )}

          <div className="px-4 py-3 space-y-2.5">
            {anzeige.slots.map((slot) => {
              const c = AMPEL_COLORS[slot.ampel];
              const pct = Math.round((slot.erwartete_fahrer / MAX_FAHRER) * 100);
              return (
                <div key={slot.stunde} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full shrink-0', c.dot)} />
                      <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-200">{slot.stunde}</span>
                      <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                        {slot.fahrer_namen.slice(0, 3).join(', ')}{slot.fahrer_namen.length > 3 ? ` +${slot.fahrer_namen.length - 3}` : ''}
                      </span>
                    </div>
                    <span className={cn('text-xs font-bold tabular-nums', c.text)}>
                      {slot.erwartete_fahrer} Fahrer
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', c.bar)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 pb-2 text-[9px] text-slate-400 text-right">
            Aktualisiert: {new Date(anzeige.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}
    </div>
  );
}
