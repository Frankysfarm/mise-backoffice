'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Clock, CloudSun, MapPin, Smartphone } from 'lucide-react';

/**
 * Phase 1021 — Schicht-Start-Assistent (Fahrer-App)
 *
 * Vorbereitungs-Checkliste vor Schichtbeginn:
 * Fahrzeug-Check, GPS aktiv, Wetter-Hinweis, nächste Bestellung erwartet.
 * Zeigt sich nur wenn isOnline=false (Fahrer noch offline).
 * 10-Min-Polling für Bestellprognose. Props: driverId, isOnline, locationId.
 */

interface ForecastSlot {
  stunde: number;
  prognose: number;
}

interface ForecastData {
  naechste_schicht_start: string | null;
  slots: ForecastSlot[];
  bestellungen_prognose_naechste_stunde: number;
  empfehlung: string;
}

const MOCK: ForecastData = {
  naechste_schicht_start: null,
  slots: [
    { stunde: 11, prognose: 8 },
    { stunde: 12, prognose: 14 },
    { stunde: 13, prognose: 11 },
  ],
  bestellungen_prognose_naechste_stunde: 10,
  empfehlung: 'Mittag-Hochbetrieb erwartet — pünktliche Bereitschaft empfohlen.',
};

interface CheckItem {
  id: string;
  label: string;
  icon: typeof CheckCircle2;
  checked: boolean;
}

interface Props {
  driverId: string;
  isOnline: boolean;
  locationId?: string | null;
}

const CHECKLIST_INIT: CheckItem[] = [
  { id: 'fahrzeug', label: 'Fahrzeug gecheckt & tankfull', icon: MapPin, checked: false },
  { id: 'gps', label: 'GPS & Standort aktiv', icon: Smartphone, checked: false },
  { id: 'wetter', label: 'Wetter & Route geprüft', icon: CloudSun, checked: false },
  { id: 'app', label: 'App-Status: Bereit', icon: CheckCircle2, checked: false },
];

export function FahrerPhase1021SchichtStartAssistent({ isOnline, locationId }: Props) {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [checklist, setChecklist] = useState<CheckItem[]>(CHECKLIST_INIT);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/schicht-forecast?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('api');
      const json = await res.json();
      setForecast({
        naechste_schicht_start: json.naechste_schicht_start ?? null,
        slots: (json.slots ?? []).slice(0, 3).map((s: Record<string, unknown>) => ({
          stunde: (s.stunde as number) ?? 0,
          prognose: (s.bestellungen_prognose as number) ?? 0,
        })),
        bestellungen_prognose_naechste_stunde: json.bestellungen_gesamt_prognose
          ? Math.round((json.bestellungen_gesamt_prognose as number) / 8)
          : 10,
        empfehlung: json.empfehlung ?? MOCK.empfehlung,
      });
    } catch {
      setForecast(MOCK);
    }
  }, [locationId]);

  useEffect(() => {
    if (!isOnline) {
      load();
      const iv = setInterval(load, 10 * 60 * 1000);
      return () => clearInterval(iv);
    }
  }, [load, isOnline]);

  // Don't render when driver is already online
  if (isOnline) return null;

  const allDone = checklist.every(c => c.checked);
  const doneCnt = checklist.filter(c => c.checked).length;

  function toggle(id: string) {
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c));
  }

  const nowH = new Date().getHours();

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden mb-4 mx-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-matcha-600 to-matcha-800 px-4 py-4 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-4 w-4 opacity-80" />
          <span className="text-sm font-bold opacity-90">Schicht-Start-Assistent</span>
        </div>
        <div className="text-2xl font-black">Bereit für die Schicht?</div>
        {forecast?.empfehlung && (
          <div className="mt-1.5 text-xs opacity-80">{forecast.empfehlung}</div>
        )}
      </div>

      {/* Checkliste */}
      <div className="px-4 py-4 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Vor-Schicht-Check ({doneCnt}/{checklist.length})
        </div>
        {checklist.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 transition text-left',
                item.checked
                  ? 'bg-matcha-50 border-matcha-300 dark:bg-matcha-900/20 dark:border-matcha-700'
                  : 'bg-muted/30 border-border hover:bg-muted/50',
              )}
            >
              {item.checked
                ? <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />
                : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className={cn('text-sm flex-1', item.checked ? 'text-matcha-700 dark:text-matcha-300 line-through opacity-70' : 'text-foreground')}>
                {item.label}
              </span>
            </button>
          );
        })}

        {allDone && (
          <div className="rounded-xl bg-matcha-50 border border-matcha-200 dark:bg-matcha-900/20 dark:border-matcha-700 px-3 py-2.5 text-sm text-matcha-700 dark:text-matcha-300 font-bold text-center">
            ✓ Alles bereit — Schicht kann beginnen!
          </div>
        )}
      </div>

      {/* Prognose */}
      {forecast && forecast.slots.length > 0 && (
        <div className="border-t px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Bestellprognose nächste Stunden
          </div>
          <div className="flex items-end gap-1.5">
            {forecast.slots.map(slot => {
              const maxVal = Math.max(...forecast.slots.map(s => s.prognose), 1);
              const heightPct = Math.round((slot.prognose / maxVal) * 100);
              const isNext = slot.stunde === nowH + 1 || slot.stunde === nowH;
              return (
                <div key={slot.stunde} className="flex flex-col items-center gap-0.5 flex-1">
                  <div className="text-[10px] font-bold tabular-nums text-muted-foreground">{slot.prognose}</div>
                  <div
                    className={cn('w-full rounded-t-sm transition-all', isNext ? 'bg-matcha-500' : 'bg-muted')}
                    style={{ height: `${Math.max(8, Math.round((heightPct / 100) * 40))}px` }}
                  />
                  <div className={cn('text-[9px] font-bold', isNext ? 'text-matcha-600' : 'text-muted-foreground')}>
                    {slot.stunde}h
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground text-center">
            ~{forecast.bestellungen_prognose_naechste_stunde} Bestellungen/Stunde erwartet
          </div>
        </div>
      )}
    </div>
  );
}
