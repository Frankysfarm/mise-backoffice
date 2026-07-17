'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Euro, MapPin, Star, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerBilanzEintrag {
  fahrer_id: string;
  fahrer_name: string;
  einnahmen_eur: number;
  stopps_heute: number;
  bewertung_avg: number | null;
  km_heute: number;
}

interface ApiData {
  fahrer: FahrerBilanzEintrag[];
  gesamt_einnahmen_eur: number;
  gesamt_stopps: number;
}

const MOTIVATIONEN: Record<string, string> = {
  top: 'Ausgezeichnete Schicht! Du bist heute der Spitzenreiter. Weiter so!',
  gut: 'Gute Leistung! Du liegst über dem Team-Ø. Bis morgen!',
  normal: 'Solide Schicht! Morgen noch einen drauf — du schaffst das.',
};

function fmt(eur: number) {
  return eur.toFixed(2).replace('.', ',') + ' €';
}

export function FahrerPhase2203MeinSchichtAbschluss({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!isOnline) return;
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-schicht-bilanz?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-schicht-bilanz';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const me = driverId ? data.fahrer.find((f) => f.fahrer_id === driverId) : data.fahrer[0];
  if (!me) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.einnahmen_eur - a.einnahmen_eur);
  const rang = sorted.findIndex((f) => f.fahrer_id === me.fahrer_id) + 1;
  const teamAvg =
    data.fahrer.length > 0
      ? data.gesamt_einnahmen_eur / data.fahrer.length
      : 0;
  const ratio = teamAvg > 0 ? me.einnahmen_eur / teamAvg : 1;
  const motivKey = ratio >= 1.1 ? 'top' : ratio >= 0.85 ? 'gut' : 'normal';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Mein Schicht-Abschluss</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-3xl font-bold text-green-600">
                {me.einnahmen_eur > 0 ? fmt(me.einnahmen_eur) : '–'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {me.stopps_heute} Stopps · {me.km_heute} km
              </div>
              {me.bewertung_avg && (
                <div className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  {me.bewertung_avg.toFixed(1)} Ø Bewertung
                </div>
              )}
            </div>
            <div className="text-right space-y-1">
              <div className="flex items-center gap-1 justify-end text-xs text-gray-400">
                <Euro className="w-3 h-3" /> Team-Ø {fmt(teamAvg)}
              </div>
              <div className={cn(
                'text-xs font-medium',
                rang === 1 ? 'text-yellow-500' : 'text-gray-400'
              )}>
                {rang === 1 ? <Trophy className="w-3.5 h-3.5 inline mr-0.5 text-yellow-500" /> : null}
                Rang #{rang} von {data.fahrer.length}
              </div>
            </div>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={cn('h-2 rounded-full transition-all', ratio >= 1.0 ? 'bg-green-500' : ratio >= 0.7 ? 'bg-yellow-500' : 'bg-red-500')}
              style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 text-right">{Math.round(ratio * 100)}% von Team-Ø</div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-xs text-green-700 dark:text-green-400">
            {MOTIVATIONEN[motivKey]}
          </div>
        </div>
      )}
    </div>
  );
}
