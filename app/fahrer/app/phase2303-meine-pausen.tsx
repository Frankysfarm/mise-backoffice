'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Coffee } from 'lucide-react';

type PausenAmpel = 'gruen' | 'gelb' | 'rot';

type FahrerPausenInfo = {
  fahrer_id: string;
  fahrer_name: string;
  letzte_pause_vor_min: number | null;
  pausen_anzahl: number;
  gesamtpausenzeit_min: number;
  ampel: PausenAmpel;
  alert: boolean;
};

type ApiData = {
  fahrer: FahrerPausenInfo[];
  team_avg_pausen: number;
};

function calcColor(ampel: PausenAmpel): string {
  if (ampel === 'gruen') return 'text-green-600 dark:text-green-400';
  if (ampel === 'gelb') return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function calcTipp(ampel: PausenAmpel, letztePauseVorMin: number | null): string {
  if (ampel === 'rot') return 'Über 6h ohne Pause! Bitte jetzt eine Pflichtpause einlegen.';
  if (ampel === 'gelb') return 'Über 4h ohne Pause — eine kurze Pause verbessert Konzentration und Sicherheit.';
  if (letztePauseVorMin === null) return 'Noch keine Pause heute — plane eine ein, wenn es ruhiger wird.';
  return 'Gute Pausen-Balance! Regelmäßige Pausen halten dich leistungsfähig.';
}

function formatMin(min: number | null): string {
  if (min === null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} Min`;
  return `${h}h ${m}m`;
}

export function FahrerPhase2303MeinePausen({
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
    if (!locationId || !driverId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-pausen?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId, driverId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !driverId || !locationId || !data) return null;

  const ich = data.fahrer.find((f) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!ich) return null;

  const color = calcColor(ich.ampel);
  const tipp = calcTipp(ich.ampel, ich.letzte_pause_vor_min);

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Coffee className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-orange-900 dark:text-orange-200 text-sm">
            Meine Pausen
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-orange-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-orange-400" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {ich.alert && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Pflichtpausen-Erinnerung: Bitte jetzt pausieren!</span>
            </div>
          )}

          <div className="text-center">
            <div className={`text-3xl font-bold ${color}`}>
              {ich.pausen_anzahl === 0 ? '0' : ich.pausen_anzahl}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Pausen heute · {ich.gesamtpausenzeit_min} Min gesamt
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-orange-100 dark:border-orange-900 p-2">
              <div className={`font-bold ${color}`}>
                {formatMin(ich.letzte_pause_vor_min)}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Letzte Pause</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-orange-100 dark:border-orange-900 p-2">
              <div className="font-bold text-orange-700 dark:text-orange-300">
                {ich.pausen_anzahl}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Anzahl</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-orange-100 dark:border-orange-900 p-2">
              <div className="font-bold text-orange-700 dark:text-orange-300">
                {data.team_avg_pausen}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Team-Ø</div>
            </div>
          </div>

          <p className={`text-xs rounded px-2 py-1.5 ${
            ich.ampel === 'rot'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              : ich.ampel === 'gelb'
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
              : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
          }`}>
            {tipp}
          </p>
        </div>
      )}
    </div>
  );
}
