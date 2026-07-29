'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Timer } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    avg_reaktionszeit_min: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_min: number;
  gesamt: number;
}

function coachingTipp(min: number): { text: string; color: string } {
  if (min <= 2) return { text: 'Top-Reaktionszeit! Du bist einer der schnellsten Fahrer.', color: 'text-green-400' };
  if (min <= 5) return { text: 'Gute Reaktion. Noch schnelleres Annehmen steigert dein Ranking.', color: 'text-yellow-400' };
  return { text: 'Reaktionszeit verbessern: Halte die App offen und nimm Aufträge sofort an.', color: 'text-red-400' };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase4758MeineReaktionszeit({ driverId, locationId, isOnline }: { driverId: string; locationId: string | null; isOnline: boolean }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit-ranking?${params}`);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 mb-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Offline — Reaktionszeit nicht verfügbar</span>
      </div>
    );
  }

  if (!data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const { text: tipp, color: tippColor } = coachingTipp(me.avg_reaktionszeit_min);
  const maxMin = Math.max(me.avg_reaktionszeit_min, data.team_avg_min, 1);

  return (
    <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Timer className="w-4 h-4 text-rose-400" />
        <span className="text-sm font-semibold text-rose-300">Meine Reaktionszeit</span>
      </div>

      <div className="text-center mb-4">
        <div className={`text-4xl font-bold ${ampelColor(me.ampel)}`}>{me.avg_reaktionszeit_min.toFixed(1)} min</div>
        <div className="text-xs text-gray-400 mt-1">Ø Reaktionszeit (30 Tage)</div>
        <div className={`text-xl font-semibold mt-1 ${ampelColor(me.ampel)}`}>Rang {me.rang}</div>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Ich</span>
            <span className={ampelColor(me.ampel)}>{me.avg_reaktionszeit_min.toFixed(1)} min</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(me.avg_reaktionszeit_min / maxMin) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Team-Ø</span>
            <span className="text-gray-300">{data.team_avg_min.toFixed(1)} min</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gray-500 rounded-full" style={{ width: `${(data.team_avg_min / maxMin) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className={`text-xs rounded p-2 bg-black/20 ${tippColor}`}>{tipp}</div>
    </div>
  );
}
