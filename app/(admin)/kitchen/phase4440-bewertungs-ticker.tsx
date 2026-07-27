'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_rating: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_rating: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_rating: 4.8, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_rating: 4.6, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_rating: 4.2, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_rating: 3.8, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_rating: 4.35,
  bester_name: 'Julia F.',
  alert_count: 1,
  gesamt: 4,
};

interface Props { locationId: string | null; }

export function KitchenPhase4440BewertungsTicker({ locationId }: Props) {
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-bewertungs-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const best = data.fahrer[0];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-semibold text-gray-700">Kundenbewertungen</span>
          {data.alert_count > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
              <AlertTriangle className="h-3 w-3" />{data.alert_count}
            </span>
          )}
        </div>
        {loading && <span className="text-xs text-gray-400">…</span>}
      </div>

      {best && (
        <div className="mb-2 text-center">
          <span className="text-xs text-gray-500">Bester #1</span>
          <div className="font-bold text-amber-700 text-sm">{best.fahrer_name} · {best.avg_rating.toFixed(1)} ★</div>
          <div className="text-xs text-gray-400">Ziel ≥ 4.5 ★</div>
        </div>
      )}

      <div className="space-y-1">
        {data.fahrer.map(f => {
          const dotColor =
            f.ampel === 'gruen' ? 'bg-emerald-500' :
            f.ampel === 'gelb'  ? 'bg-yellow-400'  : 'bg-red-500';
          return (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${dotColor} flex-shrink-0`} />
              <span className="flex-1 truncate text-xs text-gray-700">{f.fahrer_name}</span>
              <span className="text-xs font-semibold text-gray-700">{f.avg_rating.toFixed(1)} ★</span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-right text-xs text-gray-400">Ø {data.team_avg_rating.toFixed(1)} ★ · 30 Tage</div>
    </div>
  );
}
