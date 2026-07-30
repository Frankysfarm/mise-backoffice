'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Coins } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    avg_trinkgeld_eur: number;
    ampel: 'gruen' | 'gelb' | 'rot';
    alert_niedrig: boolean;
  }>;
  team_avg_eur: number;
  gesamt: number;
}

function coachingTipp(val: number): { text: string; color: string } {
  if (val >= 2.5) return {
    text: 'Top-Trinkgeld! Kunden schätzen deinen Service sehr. Pünktlichkeit und freundliche Übergabe zahlen sich aus!',
    color: 'text-orange-300',
  };
  if (val >= 1.5) return {
    text: 'Gutes Trinkgeld! Schnelle Lieferung und ein Lächeln können deinen Schnitt noch weiter steigern.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Potenzial: Pünktliche und freundliche Lieferungen motivieren Kunden zu höherem Trinkgeld.',
    color: 'text-red-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-orange-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase4960MeinTrinkgeld({
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
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/admin/fahrer-trinkgeld-ranking?${params}`);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, locationId]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900/40 px-4 py-3 flex items-center gap-2 mb-3">
        <WifiOff className="w-4 h-4 text-gray-500 shrink-0" />
        <span className="text-xs text-gray-500">Mein Trinkgeld — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.avg_trinkgeld_eur);
  const maxVal = Math.max(...data.fahrer.map(f => f.avg_trinkgeld_eur), 1);
  const barPct = Math.min(100, Math.round((mein.avg_trinkgeld_eur / maxVal) * 100));
  const teamBarPct = Math.min(100, Math.round((data.team_avg_eur / maxVal) * 100));

  return (
    <div className="rounded-2xl border border-orange-700 bg-orange-950/40 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-orange-700/50 bg-orange-900/20">
        <Coins className="w-4 h-4 text-orange-300 shrink-0" />
        <span className="text-sm font-semibold text-orange-200">Mein Trinkgeld</span>
      </div>

      {/* Main stat */}
      <div className="px-4 py-4 flex items-end gap-3">
        <span className={`text-4xl font-extrabold tabular-nums ${ampelColor(mein.ampel)}`}>
          {mein.avg_trinkgeld_eur?.toFixed(2)}
        </span>
        <div className="pb-1">
          <div className="text-sm text-gray-400">€ Ø pro Lieferung</div>
          <div className="text-xs text-gray-500">Rang #{mein.rang} von {data.gesamt}</div>
        </div>
      </div>

      {/* Mini-Balken: Ich vs Team-Ø */}
      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-14 shrink-0">Ich</span>
          <div className="flex-1 h-2 bg-orange-900/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${mein.ampel === 'gruen' ? 'bg-orange-400' : mein.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-600'}`}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <span className={`text-[10px] font-bold tabular-nums w-16 text-right ${ampelColor(mein.ampel)}`}>
            {mein.avg_trinkgeld_eur?.toFixed(2)} €
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-14 shrink-0">Team-Ø</span>
          <div className="flex-1 h-2 bg-orange-900/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-800"
              style={{ width: `${teamBarPct}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums w-16 text-right">
            {data.team_avg_eur?.toFixed(2)} €
          </span>
        </div>
      </div>

      {/* Coaching */}
      <div className="px-4 pb-3">
        <div className={`text-xs ${tipp.color} bg-orange-900/30 rounded-lg px-3 py-2 leading-relaxed`}>
          {tipp.text}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-orange-800/30">
        <span className="text-[10px] text-gray-600">Rang 1 = höchstes Trinkgeld · 30-Min-Polling · letzte 30 Tage</span>
      </div>
    </div>
  );
}
