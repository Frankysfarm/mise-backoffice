'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Cloud, Sun, CloudRain, CloudSnow, Wind, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 1026 — Wetter-Einfluss-Anzeige (Fahrer-App)
 *
 * Zeigt aktuelles Wetter + geschätzte Auswirkung auf Lieferzeit + Sicherheits-Tipps
 * bei schlechtem Wetter. 15-Min-Polling, isOnline-Guard.
 */

interface WetterData {
  zustand: 'klar' | 'bewoelkt' | 'regen' | 'schnee' | 'wind' | 'gewitter';
  temperatur_c: number;
  wind_kmh: number;
  niederschlag_mm: number;
  sichtweite_km: number;
  eta_aufschlag_min: number;
  eta_faktor: number;
  sicherheits_level: 'normal' | 'vorsicht' | 'gefahr';
  tipps: string[];
  generiert_am: string;
}

interface Props {
  driverId: string;
  isOnline: boolean;
  locationId?: string | null;
}

const MOCK: WetterData = {
  zustand: 'regen',
  temperatur_c: 12,
  wind_kmh: 28,
  niederschlag_mm: 3.2,
  sichtweite_km: 4.5,
  eta_aufschlag_min: 7,
  eta_faktor: 1.25,
  sicherheits_level: 'vorsicht',
  tipps: [
    'Regenkleidung anziehen und Gepäck wasserdicht verpacken',
    'Geschwindigkeit reduzieren — Bremsweg verlängert sich bei Nässe',
    'Mehr Abstand zu anderen Fahrzeugen halten',
    'Kunden proaktiv über ETA-Aufschlag informieren',
  ],
  generiert_am: new Date().toISOString(),
};

function wetterIcon(zustand: WetterData['zustand']): JSX.Element {
  switch (zustand) {
    case 'klar': return <Sun className="h-6 w-6 text-yellow-500" />;
    case 'bewoelkt': return <Cloud className="h-6 w-6 text-zinc-400" />;
    case 'regen': return <CloudRain className="h-6 w-6 text-blue-500" />;
    case 'schnee': return <CloudSnow className="h-6 w-6 text-blue-300" />;
    case 'wind': return <Wind className="h-6 w-6 text-zinc-500" />;
    case 'gewitter': return <AlertTriangle className="h-6 w-6 text-yellow-600" />;
    default: return <Cloud className="h-6 w-6 text-zinc-400" />;
  }
}

function wetterLabel(zustand: WetterData['zustand']): string {
  const map: Record<WetterData['zustand'], string> = {
    klar: 'Klarer Himmel', bewoelkt: 'Bewölkt', regen: 'Regen', schnee: 'Schneefall', wind: 'Starker Wind', gewitter: 'Gewitter',
  };
  return map[zustand] ?? 'Unbekannt';
}

function sicherheitStyle(level: WetterData['sicherheits_level']) {
  switch (level) {
    case 'gefahr': return { bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700', header: 'bg-red-500', badge: 'bg-red-100 dark:bg-red-900/30 border-red-300 text-red-700 dark:text-red-300', label: '⚠️ Gefahr — Besondere Vorsicht!' };
    case 'vorsicht': return { bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700', header: 'bg-amber-500', badge: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 text-amber-700 dark:text-amber-300', label: '⚡ Vorsicht empfohlen' };
    default: return { bg: 'bg-matcha-50 dark:bg-matcha-900/20 border-matcha-200 dark:border-matcha-700', header: 'bg-matcha-500', badge: 'bg-matcha-100 dark:bg-matcha-900/30 border-matcha-300 text-matcha-700 dark:text-matcha-300', label: '✅ Normalbetrieb' };
  }
}

export function FahrerPhase1026WetterEinflussAnzeige({ driverId, isOnline, locationId }: Props) {
  const [data, setData] = useState<WetterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!isOnline) return;

    async function load() {
      setLoading(true);
      try {
        // Try weather API if available, otherwise use mock
        const url = locationId
          ? `/api/delivery/driver/wetter-einfluss?location_id=${locationId}&driver_id=${driverId}`
          : null;
        if (url) {
          const res = await fetch(url);
          if (res.ok) { setData(await res.json()); setLoading(false); return; }
        }
        setData(MOCK);
      } catch { setData(MOCK); }
      finally { setLoading(false); }
    }

    load();
    const id = setInterval(load, 15 * 60_000);
    return () => clearInterval(id);
  }, [isOnline, locationId, driverId]);

  if (!isOnline || !data) return null;

  const style = sicherheitStyle(data.sicherheits_level);

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', style.bg)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition"
      >
        <div className="flex items-center gap-2">
          {wetterIcon(data.zustand)}
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Wetter-Einfluss</span>
          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', style.badge)}>
            {style.label}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Wetter-KPI-Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-3 text-center">
              <div className="flex justify-center mb-1">{wetterIcon(data.zustand)}</div>
              <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{wetterLabel(data.zustand)}</div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{data.temperatur_c}°C</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-3 text-center">
              <Clock className="h-5 w-5 text-amber-500 mx-auto mb-1" />
              <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">ETA-Aufschlag</div>
              <div className={cn('text-lg font-bold', data.eta_aufschlag_min > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-matcha-600 dark:text-matcha-400')}>
                {data.eta_aufschlag_min > 0 ? `+${data.eta_aufschlag_min} Min` : 'Kein Aufschlag'}
              </div>
            </div>
          </div>

          {/* Wetter-Details */}
          <div className="grid grid-cols-3 gap-2 text-[10px] text-center">
            <div className="rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5">
              <Wind className="h-3 w-3 mx-auto text-zinc-400 mb-0.5" />
              <div className="font-bold text-zinc-700 dark:text-zinc-300">{data.wind_kmh} km/h</div>
              <div className="text-muted-foreground">Wind</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5">
              <CloudRain className="h-3 w-3 mx-auto text-blue-400 mb-0.5" />
              <div className="font-bold text-zinc-700 dark:text-zinc-300">{data.niederschlag_mm} mm</div>
              <div className="text-muted-foreground">Niederschlag</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5">
              <Sun className="h-3 w-3 mx-auto text-yellow-400 mb-0.5" />
              <div className="font-bold text-zinc-700 dark:text-zinc-300">{data.sichtweite_km} km</div>
              <div className="text-muted-foreground">Sichtweite</div>
            </div>
          </div>

          {/* Sicherheits-Tipps */}
          {data.sicherheits_level !== 'normal' && data.tipps.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-white dark:bg-zinc-800 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Sicherheits-Tipps</span>
              </div>
              <ul className="space-y-1.5">
                {data.tipps.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                    <span className="text-amber-500 shrink-0 mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.sicherheits_level === 'normal' && (
            <div className="rounded-lg border border-matcha-200 dark:border-matcha-700 bg-white dark:bg-zinc-800 px-3 py-2">
              <p className="text-xs text-matcha-700 dark:text-matcha-300 text-center">
                ✅ Gute Bedingungen — normaler Betrieb
              </p>
            </div>
          )}

          <p className="text-[10px] text-right text-muted-foreground/60">
            Alle 15 Min aktualisiert
          </p>
        </div>
      )}
    </div>
  );
}
