'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Users } from 'lucide-react';

type RisikoStufe = 'niedrig' | 'mittel' | 'hoch';

interface FahrerRisiko {
  driver_id: string;
  fahrer_name: string;
  risiko_stufe: RisikoStufe;
  risiko_score: number;
}

interface ApiData {
  fahrer: FahrerRisiko[];
  gesamt_risiko: RisikoStufe;
  hoch_risiko_anzahl: number;
}

export function KitchenPhase2220AusfallrisikoTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-ausfallrisiko?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-ausfallrisiko';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const { verfuegbar, kritisch, rotFahrer } = useMemo(() => {
    if (!data) return { verfuegbar: 0, kritisch: false, rotFahrer: [] as FahrerRisiko[] };
    const rotFahrer = data.fahrer.filter((f) => f.risiko_stufe === 'hoch');
    const verfuegbar = data.fahrer.filter((f) => f.risiko_stufe !== 'hoch').length;
    return { verfuegbar, kritisch: verfuegbar < 2, rotFahrer };
  }, [data]);

  if (!data) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Ausfallrisiko-Ticker</span>
        <div className="flex items-center gap-2">
          {kritisch && (
            <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Kapazität kritisch
            </span>
          )}
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Users className="w-3 h-3" /> {verfuegbar} verfügbar
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {kritisch && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Kapazität kritisch!</strong> Weniger als 2 zuverlässige Fahrer verfügbar.
                Dispatcher sofort informieren und Verstärkung anfordern.
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 py-2">
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{data.fahrer.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Gesamt</div>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 py-2">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">{verfuegbar}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Verfügbar</div>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 py-2">
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">{data.hoch_risiko_anzahl}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Hoch-Risiko</div>
            </div>
          </div>

          {rotFahrer.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Fahrer mit hohem Ausfallrisiko
              </p>
              {rotFahrer.map((f) => (
                <div
                  key={f.driver_id}
                  className="flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900 px-3 py-1.5"
                >
                  <span className="text-sm text-gray-800 dark:text-gray-100">{f.fahrer_name}</span>
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">Score {f.risiko_score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
