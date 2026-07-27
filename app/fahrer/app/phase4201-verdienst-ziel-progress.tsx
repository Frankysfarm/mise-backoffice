'use client';

import { useState, useEffect, useCallback } from 'react';
import { Euro, Target, TrendingUp, Star } from 'lucide-react';

interface VerdienData {
  verdient_heute_eur: number;
  ziel_eur: number;
  ziel_pct: number;
  touren_heute: number;
  trinkgeld_eur: number;
  prognose_schichtende_eur: number;
  bonus_erreichbar: boolean;
  bonus_schwelle_eur: number;
}

const MOCK: VerdienData = {
  verdient_heute_eur: 68.40,
  ziel_eur: 120.00,
  ziel_pct: 57,
  touren_heute: 6,
  trinkgeld_eur: 8.50,
  prognose_schichtende_eur: 118.50,
  bonus_erreichbar: true,
  bonus_schwelle_eur: 150.00,
};

const progressColor = (pct: number) =>
  pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-gray-400';

interface Props { driverId: string | null; locationId: string | null; }

export function FahrerPhase4201VerdienstZielProgress({ driverId, locationId }: Props) {
  const [data, setData] = useState<VerdienData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/fahrer/verdienst-ziel?driver_id=${driverId}&location_id=${locationId ?? ''}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [driverId, locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const fmt = (n: number) => n.toFixed(2).replace('.', ',') + ' €';
  const restBis = data.bonus_schwelle_eur - data.verdient_heute_eur;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Euro className="w-3.5 h-3.5 text-green-500" />
          <span className="text-xs font-semibold text-gray-900">Verdienst & Ziel</span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2 h-2 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          <span className="text-[10px] text-green-600 font-semibold">{fmt(data.verdient_heute_eur)}</span>
        </div>
      </div>
      <div>
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>Ziel: {fmt(data.ziel_eur)}</span>
          <span>{data.ziel_pct}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${progressColor(data.ziel_pct)}`}
            style={{ width: `${Math.min(data.ziel_pct, 100)}%` }}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-500 mb-0.5">Touren</div>
          <div className="text-sm font-bold text-gray-700">{data.touren_heute}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-2">
          <div className="flex items-center justify-center gap-0.5 mb-0.5">
            <Star className="w-2.5 h-2.5 text-yellow-500" />
            <span className="text-[10px] text-yellow-600">Trinkgeld</span>
          </div>
          <div className="text-sm font-bold text-yellow-700">{fmt(data.trinkgeld_eur)}</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-2">
          <div className="flex items-center justify-center gap-0.5 mb-0.5">
            <TrendingUp className="w-2.5 h-2.5 text-blue-500" />
            <span className="text-[10px] text-blue-600">Prognose</span>
          </div>
          <div className="text-sm font-bold text-blue-700">{fmt(data.prognose_schichtende_eur)}</div>
        </div>
      </div>
      {data.bonus_erreichbar && restBis > 0 && (
        <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg p-2 border border-amber-200">
          <Target className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-[10px] text-amber-700">
            Noch <span className="font-bold">{fmt(restBis)}</span> bis Bonus ({fmt(data.bonus_schwelle_eur)})
          </span>
        </div>
      )}
      <div className="flex justify-between text-[10px] text-gray-400 px-0.5 pt-0.5 border-t border-gray-100">
        <span>Schichtziel-Tracking</span>
        <span>1-Min-Polling</span>
      </div>
    </div>
  );
}
