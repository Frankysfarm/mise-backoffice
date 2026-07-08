'use client';

import { useEffect, useState } from 'react';
import { Lightbulb, Clock, MapPin, Euro, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CoachDaten {
  besteStunde: { h: number; label: string; avgTouren: number } | null;
  topZone: { zone: string; avgTrinkgeld: number; touren: number } | null;
  trinkgeldTipp: string | null;
  motivationsText: string;
}

interface ApiResponse {
  ok: boolean;
  coach: CoachDaten;
  generatedAt: string;
}

interface Props {
  driverId: string;
  locationId: string;
}

const STUNDEN_LABELS: Record<number, string> = {
  6: '6–9 Uhr (Frühstück)', 9: '9–12 Uhr (Vormittag)',
  12: '12–14 Uhr (Mittag)', 14: '14–17 Uhr (Nachmittag)',
  17: '17–20 Uhr (Abendrush)', 20: '20–22 Uhr (Spätabend)',
};

function stundeTipp(h: number): string {
  if (h >= 17 && h < 20) return 'Peak-Stunde! Jetzt maximal Touren fahren.';
  if (h >= 12 && h < 14) return 'Mittagsrush — kurze Wege, schnelle Touren.';
  if (h >= 20) return 'Spätabend: Trinkgeld oft höher, Verkehr weniger.';
  return `Stunde ${h}:00 war gestern besonders stark.`;
}

export function FahrerPhase793SchichtCoachTipp({ driverId, locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!driverId || !locationId) return;
    let active = true;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-schicht-coach?driver_id=${driverId}&location_id=${locationId}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (active && json.ok) setData(json);
      } catch {}
    }

    load();
  }, [driverId, locationId]);

  if (!data || dismissed) return null;

  const { coach } = data;

  return (
    <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-sky-100 dark:border-sky-800/50">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-200 dark:bg-sky-800 shrink-0">
          <Lightbulb className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
        </div>
        <span className="text-xs font-black text-sky-800 dark:text-sky-300 uppercase tracking-wide">
          Schicht-Coach · Tipp
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="ml-auto text-sky-400 hover:text-sky-600 dark:hover:text-sky-200 transition-colors"
          aria-label="Schließen"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Motivation */}
      <div className="px-3 pt-2.5 pb-1">
        <p className="text-[11px] text-sky-800 dark:text-sky-300 leading-snug font-medium">
          {coach.motivationsText}
        </p>
      </div>

      {/* Tips */}
      <div className="px-3 pb-3 space-y-1.5 mt-1">
        {coach.besteStunde && (
          <div className="flex items-start gap-2 rounded-lg bg-white dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/30 px-2.5 py-2">
            <Clock className="h-3.5 w-3.5 text-sky-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-[10px] font-bold text-sky-700 dark:text-sky-300">
                Beste Stunde gestern: {coach.besteStunde.label}
              </div>
              <div className="text-[9px] text-sky-600 dark:text-sky-400 mt-0.5">
                {stundeTipp(coach.besteStunde.h)} Ø {coach.besteStunde.avgTouren.toFixed(1)} Touren/h
              </div>
            </div>
          </div>
        )}

        {coach.topZone && (
          <div className="flex items-start gap-2 rounded-lg bg-white dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/30 px-2.5 py-2">
            <MapPin className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-[10px] font-bold text-sky-700 dark:text-sky-300">
                Top-Zone: {coach.topZone.zone} · Ø {coach.topZone.avgTrinkgeld.toFixed(2)} € Trinkgeld
              </div>
              <div className="text-[9px] text-sky-600 dark:text-sky-400 mt-0.5">
                {coach.topZone.touren} Touren in Zone {coach.topZone.zone} zuletzt
              </div>
            </div>
          </div>
        )}

        {coach.trinkgeldTipp && (
          <div className="flex items-start gap-2 rounded-lg bg-white dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/30 px-2.5 py-2">
            <Euro className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-[10px] font-bold text-sky-700 dark:text-sky-300">Trinkgeld-Tipp</div>
              <div className="text-[9px] text-sky-600 dark:text-sky-400 mt-0.5">{coach.trinkgeldTipp}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
