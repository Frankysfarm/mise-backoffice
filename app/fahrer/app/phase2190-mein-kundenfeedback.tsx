'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb, Star, TrendingDown, TrendingUp, Minus } from 'lucide-react';
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

const TIPPS: Record<string, string> = {
  top: 'Hervorragend! Deine Kunden sind begeistert. Weiter so!',
  gut: 'Gute Bewertung! Ein freundliches Lächeln und Pünktlichkeit halten sie hoch.',
  niedrig: 'Bewertung unter 3.5 Sterne. Freundlichkeit und Schnelligkeit verbessern das Feedback.',
};

function Stars({ rating, large }: { rating: number; large?: boolean }) {
  const size = large ? 'w-5 h-5' : 'w-3.5 h-3.5';
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            size,
            s <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'
          )}
        />
      ))}
    </span>
  );
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend === 'fallend') return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

export function FahrerPhase2190MeinKundenfeedback({
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
        ? `/api/delivery/admin/fahrer-feedback-score?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-feedback-score';
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

  const tippKey = me.avg_sterne >= 4.5 ? 'top' : me.avg_sterne >= 3.5 ? 'gut' : 'niedrig';
  const color = me.avg_sterne >= 4.5 ? 'text-green-600' : me.avg_sterne >= 3.5 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Mein Kundenfeedback</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className={cn('text-3xl font-bold', color)}>
                {me.avg_sterne > 0 ? me.avg_sterne.toFixed(1) : '–'}
              </div>
              <Stars rating={me.avg_sterne} large />
              <div className="text-xs text-gray-500 mt-1">{me.anzahl_bewertungen} Bewertungen heute</div>
            </div>
            <div className="text-right space-y-1">
              <div className="flex justify-end">
                <TrendIcon trend={me.trend} />
              </div>
              <div className="text-xs text-gray-400">
                Δ {me.trend_delta > 0 ? '+' : ''}{me.trend_delta} vs. 7d
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                Team-Ø {data.team_durchschnitt}
              </div>
              {me.rang <= 1 && (
                <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">#1 im Team ⭐</div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
            <Lightbulb className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
            <span>{TIPPS[tippKey]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
