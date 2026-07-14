'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface FahrerRankingRow {
  rang: number;
  fahrer_id: string;
  fahrer_name: string;
  puenktlichkeitsrate: number;
  geliefert_gesamt: number;
  puenktlich: number;
  trend: 'steigend' | 'gleich' | 'fallend';
  status: 'gold' | 'silber' | 'bronze' | 'keine';
}

interface RankingResponse {
  fahrer: FahrerRankingRow[];
  gesamt_fahrer: number;
  auswertungs_zeitraum_tage: number;
}

interface Props {
  locationId: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  gold:   { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Gold' },
  silber: { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Silber' },
  bronze: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Bronze' },
  keine:  { bg: 'bg-white',      text: 'text-gray-400',   label: '' },
};

const TREND_ICON: Record<string, string> = {
  steigend: '↑',
  gleich:   '→',
  fallend:  '↓',
};

const TREND_COLOR: Record<string, string> = {
  steigend: 'text-emerald-600',
  gleich:   'text-gray-400',
  fallend:  'text-red-500',
};

export function DispatchPhase1609FahrerPuenktlichkeitsRankingWidget({ locationId }: Props) {
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = locationId ? `?location_id=${encodeURIComponent(locationId)}` : '';
      const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeits-ranking${params}`, { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data && loading) {
    return (
      <div className="rounded-2xl border border-yellow-200 bg-white p-4 shadow-sm mb-4 animate-pulse">
        <div className="h-4 bg-yellow-100 rounded w-2/3 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    );
  }

  if (!data) return null;

  const top = data.fahrer.slice(0, 6);

  return (
    <div className="rounded-2xl border border-yellow-200 bg-white overflow-hidden shadow-sm mb-4">
      <div className="flex items-center gap-2 px-4 py-3 bg-yellow-600 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Fahrer-Pünktlichkeits-Ranking</span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
          {data.auswertungs_zeitraum_tage}d
        </span>
      </div>

      <div className="divide-y divide-gray-50">
        {top.map((f) => {
          const ss = STATUS_STYLE[f.status] ?? STATUS_STYLE['keine'];
          return (
            <div key={f.fahrer_id} className="flex items-center gap-3 px-4 py-2.5">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${ss.bg} ${ss.text}`}>
                {f.rang}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800 truncate">{f.fahrer_name}</span>
                  {f.status !== 'keine' && (
                    <span className={`text-[9px] font-black uppercase rounded-full px-1.5 py-0.5 ${ss.bg} ${ss.text}`}>
                      {ss.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${f.puenktlichkeitsrate >= 90 ? 'bg-emerald-500' : f.puenktlichkeitsrate >= 75 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${f.puenktlichkeitsrate}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold tabular-nums text-gray-600 w-12 text-right">
                    {f.puenktlichkeitsrate.toFixed(1)} %
                  </span>
                </div>
              </div>
              <span className={`text-base font-bold shrink-0 ${TREND_COLOR[f.trend]}`}>
                {TREND_ICON[f.trend]}
              </span>
            </div>
          );
        })}
      </div>

      {data.fahrer.length > 6 && (
        <div className="px-4 py-2 bg-gray-50 text-xs text-gray-400 text-center border-t">
          +{data.fahrer.length - 6} weitere Fahrer
        </div>
      )}
    </div>
  );
}
