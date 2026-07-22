'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Clock, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MeinePuenktlichkeitData {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    puenktlichkeit_pct: number;
    on_time: number;
    gesamt: number;
    rank_delta: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_pct: number;
  gesamt: number;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const POLL_INTERVAL = 30 * 60 * 1000;

const COACHING: Record<string, string> = {
  gruen: 'Stark! Deine Pünktlichkeit liegt in den Top 25%. Halte dieses Tempo.',
  gelb:  'Solide Pünktlichkeit. Noch etwas schneller und du erreichst die Top 25%.',
  rot:   'Deine Pünktlichkeit ist niedrig. Plane Routen effizienter und fahre zügiger.',
};

function ampelColor(ampel: string) {
  if (ampel === 'gruen') return 'text-green-600 dark:text-green-400';
  if (ampel === 'gelb')  return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function ampelBg(ampel: string) {
  if (ampel === 'gruen') return 'bg-green-500';
  if (ampel === 'gelb')  return 'bg-yellow-500';
  return 'bg-red-500';
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (delta > 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

export function FahrerPhase3217MeinePuenktlichkeit({ driverId, locationId, isOnline }: Props) {
  const [data, setData]       = useState<MeinePuenktlichkeitData | null>(null);
  const [open, setOpen]       = useState(true);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      if (driverId)   params.set('driver_id', driverId);
      const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit-score?${params}`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [driverId, locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const me = data?.fahrer?.[0];
  if (!me) return null;

  const rangWidth = data ? Math.max(0, 100 - ((me.rang - 1) / Math.max(data.gesamt - 1, 1)) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-gray-900 dark:text-white text-sm">Meine Pünktlichkeit</span>
          {loading && <span className="text-xs text-gray-400 animate-pulse">↻</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Main Stats */}
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div className={`text-4xl font-black ${ampelColor(me.ampel)}`}>#{me.rang}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Rang</div>
            </div>
            <div className="text-center">
              <div className={`text-4xl font-black ${ampelColor(me.ampel)}`}>{me.puenktlichkeit_pct}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Pünktlichkeit</div>
            </div>
          </div>

          {/* Rang Progress Bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Rang 1 (Bester)</span>
              <span>Rang {data?.gesamt ?? '—'}</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${ampelBg(me.ampel)}`}
                style={{ width: `${rangWidth}%` }}
              />
            </div>
          </div>

          {/* Delta Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <DeltaIcon delta={me.rank_delta} />
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  {me.rank_delta === 0 ? '±0' : me.rank_delta > 0 ? `+${me.rank_delta}` : `${me.rank_delta}`}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Rang-Δ heute</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{data?.team_avg_pct ?? '—'}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Team-Ø</div>
            </div>
          </div>

          {/* On-time details */}
          <div className="text-xs text-center text-gray-500 dark:text-gray-400">
            {me.on_time} von {me.gesamt} Lieferungen pünktlich
          </div>

          {/* Coaching Tip */}
          <div className={`rounded-lg px-3 py-2 text-xs ${
            me.ampel === 'gruen' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
            me.ampel === 'gelb'  ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' :
                                   'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          }`}>
            {COACHING[me.ampel]}
          </div>
        </div>
      )}
    </div>
  );
}
