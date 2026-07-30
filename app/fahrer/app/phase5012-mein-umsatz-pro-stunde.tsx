'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Euro } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  umsatz_pro_stunde: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_umsatz: number;
}

function coachingTipp(uph: number): { text: string; color: string } {
  if (uph >= 40) return {
    text: 'Exzellenter Umsatz/h! Du lieferst effizient und schnell — weiter so!',
    color: 'text-green-300',
  };
  if (uph >= 25) return {
    text: 'Guter Umsatz/h. Optimiere deine Routen und Wartezeiten für noch mehr Leistung.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Niedriger Umsatz/h: Sprich mit der Disposition — bessere Routenplanung kann helfen.',
    color: 'text-gray-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase5012MeinUmsatzProStunde({
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
    const res = await fetch(`/api/delivery/admin/fahrer-umsatz-pro-stunde?${params}`);
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
        <span className="text-xs text-gray-500">Mein Umsatz/h — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.umsatz_pro_stunde);
  const maxBar = 60;
  const ichPct = Math.min(100, (mein.umsatz_pro_stunde / maxBar) * 100);
  const avgPct = Math.min(100, (data.team_avg_umsatz / maxBar) * 100);

  return (
    <div className="rounded-2xl border border-cyan-700 bg-cyan-950/40 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 border-b border-cyan-700/40 flex items-center gap-2 bg-cyan-900/20">
        <Euro className="w-4 h-4 text-cyan-300" />
        <span className="text-sm font-semibold text-cyan-200">Mein Umsatz/h (letzte 30 Tage)</span>
      </div>

      {/* Main Stats */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <div className={`text-4xl font-black ${ampelColor(mein.ampel)}`}>
            {mein.umsatz_pro_stunde} €/h
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Ø Umsatz pro Stunde</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${mein.rang === 1 ? 'text-green-300' : 'text-gray-300'}`}>
            #{mein.rang}
          </div>
          <div className="text-xs text-gray-500">von {data.fahrer.length}</div>
        </div>
      </div>

      {/* Mini Bar: Ich vs Team-Ø */}
      <div className="px-4 pb-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Ich</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${ichPct}%` }} />
          </div>
          <span className="text-[10px] text-cyan-300 w-16 text-right">{mein.umsatz_pro_stunde} €/h</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Team-Ø</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gray-500" style={{ width: `${avgPct}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 w-16 text-right">{data.team_avg_umsatz} €/h</span>
        </div>
      </div>

      {/* Coaching Tipp */}
      <div className="px-4 pb-3">
        <p className={`text-xs ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
