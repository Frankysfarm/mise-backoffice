'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Phase 1899 — Gebiets-Abdeckungs-Monitor (Dispatch)
 *
 * Zonen-Grid A/B/C/D mit Fahrer-Count + Lücken-Alert.
 * 5-Min-Polling. GET /api/delivery/admin/fahrer-gebiets-abdeckung (Phase 1898).
 */

interface ZonenAbdeckung {
  zone: string;
  fahrer_count: number;
  fahrer_namen: string[];
  abgedeckt: boolean;
  luecke: boolean;
}

interface ApiAntwort {
  location_id: string;
  zonen: ZonenAbdeckung[];
  luecken_gesamt: number;
  empfehlung: string | null;
  generiert_am: string;
}

const MOCK: ApiAntwort = {
  location_id: 'mock',
  zonen: [
    { zone: 'A', fahrer_count: 2, fahrer_namen: ['Max M.', 'Sara K.'], abgedeckt: true, luecke: false },
    { zone: 'B', fahrer_count: 1, fahrer_namen: ['Ana P.'], abgedeckt: true, luecke: false },
    { zone: 'C', fahrer_count: 0, fahrer_namen: [], abgedeckt: false, luecke: true },
    { zone: 'D', fahrer_count: 0, fahrer_namen: [], abgedeckt: false, luecke: true },
  ],
  luecken_gesamt: 2,
  empfehlung: 'Zonen C und D unbesetzt — Fahrer zuweisen oder Liefergebiet temporär einschränken.',
  generiert_am: new Date().toISOString(),
};

interface Props {
  locationId: string | null;
  className?: string;
}

export function DispatchPhase1899GebietsAbdeckungsMonitor({ locationId, className }: Props) {
  const [daten, setDaten] = useState<ApiAntwort | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-gebiets-abdeckung?location_id=${locationId}`);
        if (!res.ok) throw new Error('API Fehler');
        setDaten(await res.json());
      } catch {
        setDaten({ ...MOCK, location_id: locationId });
      }
    };

    laden();
    const id = setInterval(laden, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId || !daten) return null;

  const hatLuecken = daten.luecken_gesamt > 0;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Gebiets-Abdeckung</span>
        {hatLuecken && (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5">
            {daten.luecken_gesamt} Lücke{daten.luecken_gesamt !== 1 ? 'n' : ''}
          </span>
        )}
        {!hatLuecken && (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5">
            Vollständig
          </span>
        )}
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {/* Lücken-Alert */}
          {hatLuecken && daten.empfehlung && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300">{daten.empfehlung}</p>
            </div>
          )}

          {/* Zonen-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {daten.zonen.map((z) => (
              <div
                key={z.zone}
                className={cn(
                  'rounded-xl border px-3 py-2.5 flex items-start gap-2',
                  z.luecke
                    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20'
                    : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20',
                )}
              >
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full font-black text-sm shrink-0',
                    z.luecke
                      ? 'bg-red-500 text-white'
                      : 'bg-green-500 text-white',
                  )}
                >
                  {z.zone}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {z.abgedeckt ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400 shrink-0" />
                    )}
                    <span
                      className={cn(
                        'text-xs font-bold',
                        z.luecke ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300',
                      )}
                    >
                      {z.fahrer_count} Fahrer
                    </span>
                  </div>
                  {z.fahrer_namen.length > 0 ? (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {z.fahrer_namen.join(', ')}
                    </p>
                  ) : (
                    <p className="text-[10px] text-red-500 dark:text-red-400 mt-0.5">Unbesetzt</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            Aktualisierung alle 5 Min ·{' '}
            {new Date(daten.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  );
}
