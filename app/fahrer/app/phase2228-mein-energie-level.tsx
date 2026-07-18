'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';

type EnergieLevel = 'hoch' | 'mittel' | 'niedrig';

type FahrerEnergie = {
  fahrer_id: string;
  name: string;
  stopps_heute: number;
  schichtstunden: number;
  energie_score: number;
  energie_level: EnergieLevel;
  trend_7tage: number;
};

type ApiData = {
  drivers: FahrerEnergie[];
  team_avg_energie: number;
  team_energie_level: EnergieLevel;
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

function empfehlung(level: EnergieLevel): string {
  if (level === 'hoch') return 'Top-Form — du läufst auf Hochtouren! 🚀';
  if (level === 'mittel') return 'Solide Leistung — noch etwas Luft nach oben.';
  return 'Pause empfohlen — dein Energie-Level ist niedrig. Kurze Verschnaufpause kann helfen.';
}

function farbe(level: EnergieLevel): string {
  if (level === 'hoch') return 'text-green-600 dark:text-green-400';
  if (level === 'mittel') return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function balkenFarbe(level: EnergieLevel): string {
  if (level === 'hoch') return 'bg-green-500';
  if (level === 'mittel') return 'bg-yellow-500';
  return 'bg-red-500';
}

function levelLabel(level: EnergieLevel): string {
  if (level === 'hoch') return 'Hoch';
  if (level === 'mittel') return 'Mittel';
  return 'Niedrig';
}

export function FahrerPhase2228MeinEnergieLevel({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-energie?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline, load]);

  if (!isOnline || !locationId || !data) return null;

  const ich = data.drivers.find((f) => f.fahrer_id === driverId) ?? null;
  const teamAvg = data.team_avg_energie;
  const score = ich?.energie_score ?? 0;
  const level = ich?.energie_level ?? 'niedrig';
  const trend = ich ? score - ich.trend_7tage : 0;
  const balkenBreite = Math.min(100, Math.round((score / 5) * 100));

  return (
    <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-4 mb-3">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          <span className="font-semibold text-yellow-900 dark:text-yellow-200">Mein Energie-Level</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-yellow-600" /> : <ChevronDown className="w-4 h-4 text-yellow-600" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="text-center">
            <div className={`text-4xl font-black ${farbe(level)}`}>{score}<span className="text-lg font-normal">/h</span></div>
            <div className={`text-sm font-semibold mt-1 ${farbe(level)}`}>Energie: {levelLabel(level)}</div>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div className={`${balkenFarbe(level)} h-2.5 rounded-full transition-all`} style={{ width: `${balkenBreite}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-gray-500 dark:text-gray-400">Team-Ø</div>
              <div className="font-bold text-gray-800 dark:text-white">{teamAvg}/h</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-gray-500 dark:text-gray-400">Trend</div>
              <div className={`font-bold ${trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}/h
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
            <span>💡</span>
            <span>{empfehlung(level)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
