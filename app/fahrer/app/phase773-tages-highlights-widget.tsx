'use client';

import { useEffect, useState } from 'react';
import { Trophy, Clock, TrendingUp, Star } from 'lucide-react';

interface TagsHighlights {
  touren_heute: number;
  schnellste_tour_min: number | null;
  langsamste_tour_min: number | null;
  avg_tour_min: number | null;
  trinkgeld_heute: number;
  bewertung_heute: number | null;
  km_heute: number;
}

const MOCK: TagsHighlights = {
  touren_heute: 0,
  schnellste_tour_min: null,
  langsamste_tour_min: null,
  avg_tour_min: null,
  trinkgeld_heute: 0,
  bewertung_heute: null,
  km_heute: 0,
};

interface StatKachelProps {
  icon: React.ReactNode;
  label: string;
  wert: string;
  highlight?: boolean;
}

function StatKachel({ icon, label, wert, highlight }: StatKachelProps) {
  return (
    <div
      className={`rounded-lg p-2.5 flex flex-col gap-1 ${
        highlight
          ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-300/60 dark:border-amber-700/40'
          : 'bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600'
      }`}
    >
      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-base font-bold text-slate-800 dark:text-slate-100">{wert}</p>
    </div>
  );
}

export function FahrerPhase773TagesHighlightsWidget({
  driverId,
  locationId,
}: {
  driverId: string;
  locationId: string;
}) {
  const [daten, setDaten] = useState<TagsHighlights>(MOCK);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-monats-statistik?location_id=${locationId}&driver_id=${driverId}&tage=1`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (json.touren_gesamt != null) {
          setDaten({
            touren_heute: json.touren_gesamt ?? 0,
            schnellste_tour_min: json.schnellste_tour_min ?? null,
            langsamste_tour_min: json.langsamste_tour_min ?? null,
            avg_tour_min: json.avg_tour_min ?? null,
            trinkgeld_heute: json.trinkgeld_gesamt ?? 0,
            bewertung_heute: json.avg_rating ?? null,
            km_heute: json.km_gesamt ?? 0,
          });
        }
      } catch {}
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [driverId, locationId]);

  if (!daten.touren_heute) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Tages-Highlights
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatKachel
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Touren"
          wert={String(daten.touren_heute)}
          highlight={daten.touren_heute >= 5}
        />
        {daten.schnellste_tour_min != null && (
          <StatKachel
            icon={<Clock className="h-3.5 w-3.5 text-emerald-500" />}
            label="Schnellste Tour"
            wert={`${daten.schnellste_tour_min} Min`}
            highlight={daten.schnellste_tour_min <= 20}
          />
        )}
        {daten.trinkgeld_heute > 0 && (
          <StatKachel
            icon={<Star className="h-3.5 w-3.5 text-amber-500" />}
            label="Trinkgeld"
            wert={`€ ${daten.trinkgeld_heute.toFixed(2)}`}
          />
        )}
        {daten.avg_tour_min != null && (
          <StatKachel
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Ø Tour"
            wert={`${Math.round(daten.avg_tour_min)} Min`}
          />
        )}
      </div>

      {daten.km_heute > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-700/40 px-3 py-2">
          <span className="text-xs text-blue-700 dark:text-blue-300">km heute</span>
          <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
            {daten.km_heute.toFixed(1)} km
          </span>
        </div>
      )}
    </div>
  );
}
