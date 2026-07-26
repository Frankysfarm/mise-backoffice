'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MeinUmsatzProKmData {
  umsatz_pro_km: number;
  rang: number;
  gesamt: number;
  rank_delta: number;
  team_avg_umsatz_pro_km: number;
  ziel_umsatz_pro_km: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  coaching_tipp: string;
}

const MOCK: MeinUmsatzProKmData = {
  umsatz_pro_km: 2.40,
  rang: 3,
  gesamt: 4,
  rank_delta: -1,
  team_avg_umsatz_pro_km: 2.59,
  ziel_umsatz_pro_km: 2.50,
  ampel: 'gelb',
  coaching_tipp: 'Noch €0.10/km zum Ziel! Kurze Routen optimieren und Bestellwert steigern hilft.',
};

function ampelClasses(ampel: MeinUmsatzProKmData['ampel']) {
  if (ampel === 'gruen') return { value: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' };
  if (ampel === 'gelb')  return { value: 'text-yellow-600',  badge: 'bg-yellow-100 text-yellow-700',  bar: 'bg-yellow-400' };
  return                        { value: 'text-red-600',     badge: 'bg-red-100 text-red-700',        bar: 'bg-red-500' };
}

export function FahrerPhase3775MeinUmsatzProKm({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<MeinUmsatzProKmData>(MOCK);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-umsatz-pro-km?location_id=${locationId}`);
      if (!res.ok) return;
      const json = await res.json();
      const me = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
      if (!me) return;
      const ziel = json.ziel_umsatz_pro_km ?? 2.50;
      setData({
        umsatz_pro_km: me.umsatz_pro_km,
        rang: me.rang,
        gesamt: json.gesamt,
        rank_delta: me.rank_delta,
        team_avg_umsatz_pro_km: json.team_avg_umsatz_pro_km,
        ziel_umsatz_pro_km: ziel,
        ampel: me.ampel,
        coaching_tipp: me.ampel === 'rot'
          ? 'Dein Umsatz/km ist zu niedrig. Kürzere Routen und größere Bestellungen helfen!'
          : me.ampel === 'gelb'
          ? `Noch €${Math.max(0, Math.round((ziel - me.umsatz_pro_km) * 100) / 100).toFixed(2)}/km zum Ziel. Fast da!`
          : 'Ausgezeichnet! Dein Umsatz/km ist top — weiter so!',
      });
    } catch {
      // Mock-Fallback
    }
  }, [driverId, locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const c = ampelClasses(data.ampel);
  const maxUpk = 5;
  const barPct = Math.min((data.umsatz_pro_km / maxUpk) * 100, 100);
  const teamBarPct = Math.min((data.team_avg_umsatz_pro_km / maxUpk) * 100, 100);
  const zielBarPct = Math.min((data.ziel_umsatz_pro_km / maxUpk) * 100, 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-emerald-500" />
        <span className="font-semibold text-gray-900 text-sm">Mein Umsatz/km</span>
      </div>

      {/* Haupt-Wert */}
      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${c.value}`}>€{data.umsatz_pro_km.toFixed(2)}</div>
        <div className="text-sm text-gray-400">pro Kilometer</div>
        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${c.badge}`}>
          Rang #{data.rang} von {data.gesamt}
          {data.rank_delta !== 0 && (
            data.rank_delta > 0
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />
          )}
        </div>
      </div>

      {/* Ziel-Balken */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-gray-500">
          <span>Ich (€{data.umsatz_pro_km.toFixed(2)}/km)</span>
          <span>Ziel ≥€{data.ziel_umsatz_pro_km.toFixed(2)}/km</span>
        </div>
        <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${c.bar} rounded-full transition-all duration-700`}
            style={{ width: `${barPct}%` }}
          />
          {/* Ziel-Marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
            style={{ left: `${zielBarPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>Team-Ø €{data.team_avg_umsatz_pro_km.toFixed(2)}/km</span>
          <div className="h-2.5 w-16 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-300 rounded-full" style={{ width: `${teamBarPct}%` }} />
          </div>
        </div>
      </div>

      {/* Coaching-Tipp */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
        💡 {data.coaching_tipp}
      </div>
    </div>
  );
}
