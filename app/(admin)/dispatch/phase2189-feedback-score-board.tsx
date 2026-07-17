'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Star, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerFeedback {
  fahrer_id: string;
  name: string;
  avg_sterne: number;
  anzahl_bewertungen: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  alert: boolean;
  rang: number;
}

interface ApiData {
  fahrer: FahrerFeedback[];
  team_durchschnitt: number;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            'w-3 h-3',
            s <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'
          )}
        />
      ))}
    </span>
  );
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp className="w-3 h-3 text-green-500" />;
  if (trend === 'fallend') return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function ampel(rating: number) {
  if (rating >= 4.5) return 'text-green-600';
  if (rating >= 3.5) return 'text-yellow-600';
  return 'text-red-600';
}

export function DispatchPhase2189FeedbackScoreBoard({ locationId }: { locationId: string | null }) {
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
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  const alertFahrer = data.fahrer.filter((f) => f.alert);
  const sorted = [...data.fahrer].sort((a, b) => b.avg_sterne - a.avg_sterne);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Feedback-Score Ranking</span>
        <div className="flex items-center gap-2">
          {alertFahrer.length > 0 && (
            <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {alertFahrer.length} Alert
            </span>
          )}
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            Team-Ø {data.team_durchschnitt}
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {alertFahrer.length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {alertFahrer.map((f) => f.name).join(', ')} — unter 3.5 Sterne! Gespräch empfohlen.
              </span>
            </div>
          )}

          <div className="space-y-2">
            {sorted.map((f) => (
              <div key={f.fahrer_id} className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{f.name}</span>
                  <div className="flex items-center gap-1.5">
                    <TrendIcon trend={f.trend} />
                    <span className={cn('text-sm font-bold', ampel(f.avg_sterne))}>
                      {f.avg_sterne > 0 ? f.avg_sterne.toFixed(1) : '–'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Stars rating={f.avg_sterne} />
                  <div className="flex gap-3 text-xs text-gray-400">
                    <span>{f.anzahl_bewertungen} Bewertungen</span>
                    <span>Δ {f.trend_delta > 0 ? '+' : ''}{f.trend_delta}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
