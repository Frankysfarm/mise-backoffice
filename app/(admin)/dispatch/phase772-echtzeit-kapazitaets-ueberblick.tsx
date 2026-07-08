'use client';

import { useEffect, useState } from 'react';
import { Activity, Users, Package } from 'lucide-react';

interface FahrerScore {
  driver_id: string;
  name: string;
  score: number;
  touren_heute: number;
  status: 'frei' | 'mittel' | 'aktiv' | 'voll';
}

interface AuslastungResponse {
  fahrer: FahrerScore[];
}

interface Props {
  locationId: string | null;
}

function KapazitaetsBalken({ pct }: { pct: number }) {
  const color =
    pct >= 85 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

export function DispatchPhase772EchtzeitKapazitaetsUeberblick({ locationId }: Props) {
  const [daten, setDaten] = useState<AuslastungResponse | null>(null);

  useEffect(() => {
    if (!locationId) return;
    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-auslastungs-score?location_id=${locationId}`
        );
        if (!res.ok) return;
        const json: AuslastungResponse = await res.json();
        setDaten(json);
      } catch {}
    }
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!daten) return null;

  const fahrer = daten.fahrer ?? [];
  if (!fahrer.length) return null;

  const gesamtScore = fahrer.length
    ? Math.round(fahrer.reduce((s, f) => s + f.score, 0) / fahrer.length)
    : 0;
  const aktive = fahrer.filter(f => f.status === 'aktiv' || f.status === 'voll').length;
  const freie = fahrer.filter(f => f.status === 'frei').length;

  const kapazitaetsLabel =
    gesamtScore >= 85
      ? { text: 'Überlastet', cls: 'text-red-600 dark:text-red-400' }
      : gesamtScore >= 60
      ? { text: 'Angespannt', cls: 'text-amber-600 dark:text-amber-400' }
      : { text: 'Gut', cls: 'text-emerald-600 dark:text-emerald-400' };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Kapazitäts-Überblick
          </span>
        </div>
        <span className={`text-sm font-bold ${kapazitaetsLabel.cls}`}>
          {kapazitaetsLabel.text}
        </span>
      </div>

      {/* Gesamt-Auslastung */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span>Ø Auslastung</span>
          <span className="font-mono font-semibold">{gesamtScore}%</span>
        </div>
        <KapazitaetsBalken pct={gesamtScore} />
      </div>

      {/* Fahrer-Kurzübersicht */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-2.5 flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-500 shrink-0" />
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Verfügbar</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{freie}</p>
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-2.5 flex items-center gap-2">
          <Package className="h-4 w-4 text-amber-500 shrink-0" />
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Unterwegs</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{aktive}</p>
          </div>
        </div>
      </div>

      {/* Fahrer-Liste */}
      <div className="space-y-1.5">
        {fahrer.map(f => (
          <div key={f.driver_id} className="flex items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-300 w-28 truncate shrink-0">
              {f.name}
            </span>
            <div className="flex-1">
              <KapazitaetsBalken pct={f.score} />
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-10 text-right shrink-0">
              {f.score}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
