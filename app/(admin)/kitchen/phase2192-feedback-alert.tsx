'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerFeedback {
  fahrer_id: string;
  name: string;
  avg_sterne: number;
  anzahl_bewertungen: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerFeedback[];
  team_durchschnitt: number;
}

export function KitchenPhase2192FeedbackAlert({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-feedback-score?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-feedback-score';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const { alertFahrer, hasEskalation } = useMemo(() => {
    if (!data) return { alertFahrer: [], hasEskalation: false };
    const alertFahrer = data.fahrer.filter((f) => f.alert);
    return { alertFahrer, hasEskalation: alertFahrer.length >= 2 };
  }, [data]);

  if (!data) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Feedback-Alert</span>
        <div className="flex items-center gap-2">
          {alertFahrer.length > 0 && (
            <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-xs px-2 py-0.5 rounded-full">
              {alertFahrer.length} unter 3.5 ⭐
            </span>
          )}
          <span className="text-xs text-gray-400 flex items-center gap-0.5">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            {data.team_durchschnitt > 0 ? data.team_durchschnitt.toFixed(1) : '–'} Team-Ø
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {hasEskalation && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {alertFahrer.length} Fahrer unter 3.5 Sterne — Eskalation! Dispatcher informieren.
              </span>
            </div>
          )}

          {alertFahrer.length === 0 ? (
            <div className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
              Alle Fahrer haben akzeptable Bewertungen ≥ 3.5 ⭐
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-xs text-gray-500 font-medium">Fahrer unter 3.5 Sterne:</div>
              {alertFahrer.map((f) => (
                <div
                  key={f.fahrer_id}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-xs',
                    'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                  )}
                >
                  <span className="font-medium">{f.name}</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-red-400 text-red-400" />
                    <span className="font-bold">
                      {f.avg_sterne > 0 ? f.avg_sterne.toFixed(1) : '–'}
                    </span>
                    <span className="text-gray-400 ml-1">({f.anzahl_bewertungen} Bew.)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
