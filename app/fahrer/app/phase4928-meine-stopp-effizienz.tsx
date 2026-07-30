'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Target } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    touren_pro_stopp: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_tps: number;
  gesamt: number;
}

function coachingTipp(tps: number): { text: string; color: string } {
  if (tps >= 2.5) return {
    text: 'Exzellente Stopp-Effizienz! Du lieferst mehr als 2,5 Aufträge pro Stopp — top Bündelung und Routenplanung.',
    color: 'text-fuchsia-400',
  };
  if (tps >= 1.5) return {
    text: 'Gute Effizienz. Mit besserem Bündeln von Aufträgen auf kurzen Wegen holst du noch mehr Lieferungen pro Stopp raus.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Potenzial vorhanden. Versuche, Aufträge in der Nähe zu bündeln und weniger Einzelstopps zu fahren.',
    color: 'text-green-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-fuchsia-400';
}

export function FahrerPhase4928MeineStoppEffizienz({
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
    const res = await fetch(`/api/delivery/admin/fahrer-stopp-effizienz-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Stopp-Effizienz — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.touren_pro_stopp);
  const maxTps = data.fahrer[0]?.touren_pro_stopp ?? 1;
  const barPct = Math.min(100, Math.round((mein.touren_pro_stopp / Math.max(maxTps, 1)) * 100));

  return (
    <div className="rounded-2xl border border-fuchsia-700 bg-fuchsia-950/40 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-fuchsia-700/50 bg-fuchsia-900/20">
        <Target className="w-4 h-4 text-fuchsia-300 shrink-0" />
        <span className="text-sm font-semibold text-fuchsia-200">Meine Stopp-Effizienz</span>
      </div>

      {/* Main stat */}
      <div className="px-4 py-4 flex items-end gap-3">
        <span className={`text-4xl font-extrabold tabular-nums ${ampelColor(mein.ampel)}`}>
          {mein.touren_pro_stopp.toFixed(1)}
        </span>
        <div className="pb-1">
          <div className="text-sm text-gray-400">Touren/Stopp</div>
          <div className="text-xs text-gray-500">Rang #{mein.rang} von {data.gesamt}</div>
        </div>
      </div>

      {/* Mini-Balken: Ich vs Team-Ø */}
      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-14 shrink-0">Ich</span>
          <div className="flex-1 h-2 bg-fuchsia-900/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${mein.ampel === 'gruen' ? 'bg-green-500' : mein.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-fuchsia-500'}`}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <span className={`text-[10px] font-bold tabular-nums w-10 text-right ${ampelColor(mein.ampel)}`}>
            {mein.touren_pro_stopp.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-14 shrink-0">Team-Ø</span>
          <div className="flex-1 h-2 bg-fuchsia-900/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-fuchsia-700"
              style={{ width: `${Math.min(100, Math.round((data.team_avg_tps / Math.max(maxTps, 1)) * 100))}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">
            {data.team_avg_tps.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Coaching */}
      <div className="px-4 pb-3">
        <div className={`text-xs ${tipp.color} bg-fuchsia-900/30 rounded-lg px-3 py-2 leading-relaxed`}>
          {tipp.text}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-fuchsia-800/30">
        <span className="text-[10px] text-gray-600">Ø Lieferungen je Stopp · 30-Min-Polling · letzte 30 Tage</span>
      </div>
    </div>
  );
}
