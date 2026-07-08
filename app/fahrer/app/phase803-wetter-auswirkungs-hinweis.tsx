'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun, CloudSnow, Wind, X } from 'lucide-react';

type WetterBedingung = 'sonnig' | 'bewoelkt' | 'regen' | 'schnee' | 'wind' | 'gewitter';

interface WetterDaten {
  bedingung: WetterBedingung;
  beschreibung: string;
  eta_aufschlag_min: number;
  tipp: string;
}

const WETTER_MOCK: WetterDaten = {
  bedingung: 'regen',
  beschreibung: 'Leichter Regen',
  eta_aufschlag_min: 8,
  tipp: 'Vorsichtig fahren — rutschige Straßen möglich',
};

const WETTER_NACH_STUNDE: Record<number, WetterDaten> = {
  0: { bedingung: 'bewoelkt', beschreibung: 'Bedeckt', eta_aufschlag_min: 0, tipp: 'Normale Fahrbedingungen' },
  1: { bedingung: 'regen', beschreibung: 'Leichter Regen', eta_aufschlag_min: 8, tipp: 'Vorsichtig fahren — rutschige Straßen' },
  2: { bedingung: 'regen', beschreibung: 'Starkregen', eta_aufschlag_min: 15, tipp: 'ETA für Kunden anpassen, langsam fahren' },
  3: { bedingung: 'wind', beschreibung: 'Starker Wind', eta_aufschlag_min: 5, tipp: 'Fahrrad-Touren vermeiden, Schutzkleidung' },
  4: { bedingung: 'sonnig', beschreibung: 'Sonnig', eta_aufschlag_min: 0, tipp: 'Optimale Fahrbedingungen — volle Kraft!' },
  5: { bedingung: 'schnee', beschreibung: 'Schneefall', eta_aufschlag_min: 20, tipp: 'Sehr vorsichtig — ETA deutlich erhöht' },
  6: { bedingung: 'bewoelkt', beschreibung: 'Teilweise bewölkt', eta_aufschlag_min: 0, tipp: 'Gute Fahrbedingungen' },
};

const WETTER_ICONS: Record<WetterBedingung, typeof Sun> = {
  sonnig: Sun,
  bewoelkt: Cloud,
  regen: CloudRain,
  schnee: CloudSnow,
  wind: Wind,
  gewitter: CloudRain,
};

const WETTER_FARBEN: Record<WetterBedingung, string> = {
  sonnig: 'text-amber-500 dark:text-amber-400',
  bewoelkt: 'text-slate-500 dark:text-slate-400',
  regen: 'text-blue-500 dark:text-blue-400',
  schnee: 'text-sky-400 dark:text-sky-300',
  wind: 'text-teal-500 dark:text-teal-400',
  gewitter: 'text-purple-500 dark:text-purple-400',
};

function getWetterData(): WetterDaten {
  const stunde = new Date().getHours() % 7;
  return WETTER_NACH_STUNDE[stunde] ?? WETTER_MOCK;
}

interface Props {
  locationId?: string | null;
}

export function FahrerPhase803WetterAuswirkungsHinweis({ locationId: _locationId }: Props) {
  const [wetter, setWetter] = useState<WetterDaten | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setWetter(getWetterData());

    const id = setInterval(() => {
      setWetter(getWetterData());
    }, 15 * 60_000);

    return () => clearInterval(id);
  }, []);

  if (dismissed || !wetter) return null;
  if (wetter.eta_aufschlag_min === 0 && wetter.bedingung === 'sonnig') return null;

  const Icon = WETTER_ICONS[wetter.bedingung];
  const farbKlasse = WETTER_FARBEN[wetter.bedingung];

  const hintergrundKlasse =
    wetter.eta_aufschlag_min >= 15
      ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20'
      : wetter.eta_aufschlag_min >= 5
      ? 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20'
      : 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20';

  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${hintergrundKlasse}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${farbKlasse}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">{wetter.beschreibung}</span>
              {wetter.eta_aufschlag_min > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    wetter.eta_aufschlag_min >= 15
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  +{wetter.eta_aufschlag_min} Min ETA
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{wetter.tipp}</p>
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0"
          aria-label="Schließen"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      {wetter.eta_aufschlag_min > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                wetter.eta_aufschlag_min >= 15
                  ? 'bg-red-500'
                  : wetter.eta_aufschlag_min >= 5
                  ? 'bg-amber-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, (wetter.eta_aufschlag_min / 20) * 100)}%` }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground shrink-0">
            +{wetter.eta_aufschlag_min} Min
          </span>
        </div>
      )}
    </div>
  );
}
