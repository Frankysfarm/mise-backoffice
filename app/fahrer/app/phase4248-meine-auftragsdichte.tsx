'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerSingle { fahrer_id: string; fahrer_name: string; rang: number; dichte: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; gesamt: number; ziel: number; }

const MOCK: FahrerSingle = { fahrer_id: 'me', fahrer_name: 'Julia F.', rang: 1, dichte: 4.2, rank_delta: 1, ampel: 'gruen', gesamt: 4, ziel: 4.0 };

function tip(dichte: number, ziel: number): string {
  if (dichte >= ziel * 1.1) return 'Exzellente Auftragsdichte! Du liegst deutlich über dem Ziel.';
  if (dichte >= ziel) return 'Ziel erreicht. Halte dein Tempo und optimiere deine Route.';
  if (dichte >= ziel * 0.8) return 'Nah am Ziel. Reduziere Wartezeiten zwischen Aufträgen.';
  return 'Dichte unter Ziel. Prüfe deine Verfügbarkeit und reaktionszeit.';
}

interface Props { driverId: string; locationId: string | null; isOnline: boolean; }

export function FahrerPhase4248MeineAuftragsdichte({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<FahrerSingle>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-auftragsdichte-ranking?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        const me = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
        if (me) setData({ ...me, gesamt: json.gesamt ?? 4, ziel: json.ziel ?? 4.0 });
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId, driverId, isOnline]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  if (!isOnline) return null;

  const ringColor = data.ampel === 'gruen' ? 'text-blue-600' : data.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const Delta = data.rank_delta > 0 ? TrendingUp : data.rank_delta < 0 ? TrendingDown : Minus;
  const dColor = data.rank_delta > 0 ? 'text-emerald-500' : data.rank_delta < 0 ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-semibold text-gray-900">Meine Auftragsdichte</span>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-end gap-3">
        <span className={`text-5xl font-black ${ringColor}`}>{data.dichte}</span>
        <div className="pb-1 space-y-0.5">
          <span className="text-lg text-gray-500 font-medium">Auftr./h</span>
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold text-gray-700">Rang #{data.rang}</span>
            <span className="text-xs text-gray-400">/ {data.gesamt}</span>
          </div>
        </div>
        <div className={`ml-auto flex items-center gap-1 ${dColor}`}>
          <Delta className="w-4 h-4" />
          <span className="text-sm font-semibold">{data.rank_delta > 0 ? '+' : ''}{data.rank_delta}</span>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-3">
        <p className="text-xs text-blue-700">{tip(data.dichte, data.ziel)}</p>
        <p className="text-[10px] text-blue-400 mt-1">Ziel ≥{data.ziel} Aufträge/h</p>
      </div>
    </div>
  );
}
