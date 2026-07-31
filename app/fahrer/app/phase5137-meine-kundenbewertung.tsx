'use client';

import { useEffect, useState } from 'react';
import { Star, WifiOff, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock-Daten: API /api/delivery/admin/fahrer-kundenbewertung-ranking noch nicht vorhanden

interface ApiResponse {
  fahrer: { fahrer_id: string; fahrer_name: string; rang: number; avg_rating: number; ampel: string }[];
  team_avg_rating: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Marco R.',  rang: 1, avg_rating: 4.9, ampel: 'gruen' },
    { fahrer_id: 'f2', fahrer_name: 'Lena K.',   rang: 2, avg_rating: 4.7, ampel: 'gruen' },
    { fahrer_id: 'me', fahrer_name: 'Ich',        rang: 3, avg_rating: 4.5, ampel: 'gruen' },
    { fahrer_id: 'f4', fahrer_name: 'Sara B.',   rang: 4, avg_rating: 4.1, ampel: 'gelb' },
    { fahrer_id: 'f5', fahrer_name: 'Jonas W.',  rang: 5, avg_rating: 3.6, ampel: 'rot' },
  ],
  team_avg_rating: 4.36,
  gesamt: 5,
};

function coachingTipp(val: number): { text: string; color: string } {
  if (val >= 4.5) return {
    text: 'Hervorragende Bewertung! Du zählst zu den besten Fahrern. Weiter so!',
    color: 'text-green-300',
  };
  if (val >= 4.0) return {
    text: 'Gute Bewertung. Mit noch mehr Freundlichkeit und Pünktlichkeit erreichst du die Spitze.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Bewertung unter 4.0. Rede mit deinem Disponenten – gemeinsam finden wir Verbesserungen.',
    color: 'text-red-400',
  };
}

function ratingColor(val: number) {
  if (val >= 4.5) return 'text-green-300';
  if (val >= 4.0) return 'text-yellow-400';
  return 'text-red-400';
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn('w-4 h-4', i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-600')}
        />
      ))}
    </div>
  );
}

export function FahrerPhase5137MeineKundenbewertung({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = `/api/delivery/admin/fahrer-kundenbewertung-ranking${locationId ? `?location_id=${locationId}` : ''}`;
    try {
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
      else setData(MOCK);
    } catch { setData(MOCK); }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 30 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 flex items-center gap-2 text-slate-500 text-sm">
        <WifiOff className="w-4 h-4" /> Offline – Bewertung nicht verfügbar
      </div>
    );
  }

  if (!data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer.find(f => f.fahrer_name === 'Ich') ?? data.fahrer[2];
  if (!me) return null;

  const tipp = coachingTipp(me.avg_rating);
  const barPct = Math.round(((me.avg_rating - 1) / 4) * 100);
  const teamBarPct = Math.round(((data.team_avg_rating - 1) / 4) * 100);
  const delta = me.avg_rating - data.team_avg_rating;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-slate-900/80 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-400" />
        <span className="font-semibold text-white text-sm">Meine Kundenbewertung</span>
      </div>

      <div className="text-center space-y-1">
        <div className={cn('text-5xl font-bold tabular-nums', ratingColor(me.avg_rating))}>
          {me.avg_rating.toFixed(1)}
        </div>
        <Stars rating={me.avg_rating} />
        <div className={cn('text-2xl font-bold tabular-nums', me.rang <= 2 ? 'text-green-300' : me.rang <= 4 ? 'text-yellow-400' : 'text-red-400')}>
          Rang #{me.rang} von {data.gesamt}
        </div>
      </div>

      {/* Mini-Bar */}
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Ich</span>
            <span className={ratingColor(me.avg_rating)}>{me.avg_rating.toFixed(1)}★</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${barPct}%` }} />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Team-Ø</span>
            <span className="text-white">{data.team_avg_rating.toFixed(1)}★</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-slate-500 transition-all" style={{ width: `${teamBarPct}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {delta >= 0
            ? <TrendingUp className="w-3.5 h-3.5 text-green-400" />
            : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
          <span className={delta >= 0 ? 'text-green-300' : 'text-red-400'}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)} vs Team-Ø
          </span>
        </div>
      </div>

      <div className={cn('text-xs rounded px-2 py-1.5 bg-slate-800/60', tipp.color)}>
        {tipp.text}
      </div>

      <div className="text-[10px] text-slate-600">30-Min-Polling · Mock-Fallback</div>
    </div>
  );
}
