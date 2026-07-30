'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Utensils } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    touren_pro_std: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_tph: number;
  gesamt: number;
}

function coachingTipp(tph: number): { text: string; color: string } {
  if (tph >= 4.0) return {
    text: 'Außergewöhnliche Mittagsschicht-Produktivität! Die Rush-Hour gehört dir — halte dein Tempo und nutze kurze Stopp-Zeiten.',
    color: 'text-red-400',
  };
  if (tph >= 2.0) return {
    text: 'Gute Mittags-Effizienz. Optimierte Routen und gebündelte Touren in der Rush-Hour bringen noch mehr Leistung.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Die Mittagsschicht bietet viel Potenzial. Konzentriere dich auf kurze Wege zwischen Stopps und enge Takt-Koordination mit der Küche.',
    color: 'text-orange-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-orange-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase4918MeineMittagsprod({
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
    const res = await fetch(`/api/delivery/admin/fahrer-mittagsprod-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Mittagsschicht-Produktivität — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.touren_pro_std);
  const maxTph = data.fahrer[0]?.touren_pro_std ?? 1;
  const barPct = Math.min(100, Math.round((mein.touren_pro_std / Math.max(maxTph, 1)) * 100));

  return (
    <div className="rounded-2xl border border-orange-700 bg-orange-950/40 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-orange-700/50 bg-orange-900/20">
        <Utensils className="w-4 h-4 text-orange-300 shrink-0" />
        <span className="text-sm font-semibold text-orange-200">Meine Mittagsschicht-Produktivität</span>
      </div>

      {/* Main stat */}
      <div className="px-4 py-4 flex items-end gap-3">
        <span className={`text-4xl font-extrabold tabular-nums ${ampelColor(mein.ampel)}`}>
          {mein.touren_pro_std.toFixed(1)}
        </span>
        <div className="pb-1">
          <div className="text-sm text-gray-400">Touren/h</div>
          <div className="text-xs text-gray-500">Rang #{mein.rang} von {data.gesamt}</div>
        </div>
      </div>

      {/* Mini-Balken: Ich vs Team-Ø */}
      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-14 shrink-0">Ich</span>
          <div className="flex-1 h-2 bg-orange-900/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${mein.ampel === 'gruen' ? 'bg-orange-500' : mein.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <span className={`text-[10px] font-bold tabular-nums w-10 text-right ${ampelColor(mein.ampel)}`}>
            {mein.touren_pro_std.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-14 shrink-0">Team-Ø</span>
          <div className="flex-1 h-2 bg-orange-900/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-700"
              style={{ width: `${Math.min(100, Math.round((data.team_avg_tph / Math.max(maxTph, 1)) * 100))}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">
            {data.team_avg_tph.toFixed(1)}
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
        <span className="text-[10px] text-gray-600">Mittagsschicht 11:00–14:00 UTC · 30-Min-Polling · letzte 30 Tage</span>
      </div>
    </div>
  );
}
