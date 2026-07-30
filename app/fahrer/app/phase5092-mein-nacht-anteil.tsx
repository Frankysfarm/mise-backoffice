'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Moon } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  nacht_anteil_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  gesamt: number;
}

function coachingTipp(val: number): { text: string; color: string } {
  if (val >= 40) return {
    text: 'Hoher Nacht-Anteil. Du bist ein echter Nacht-Profi — achte auf ausreichend Schlaf und Erholung.',
    color: 'text-yellow-400',
  };
  if (val >= 20) return {
    text: 'Ausgeglichener Nacht-Einsatz. Gute Balance zwischen Tag- und Nachtschichten.',
    color: 'text-green-300',
  };
  return {
    text: 'Niedriger Nacht-Anteil. Nachtschichten können deinen Verdienst durch Zuschläge steigern.',
    color: 'text-gray-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase5092MeinNachtAnteil({
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
    const res = await fetch(`/api/delivery/admin/fahrer-nacht-anteil-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Mein Nacht-Anteil — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp   = coachingTipp(mein.nacht_anteil_pct);
  const maxPct = 100;
  const ichPct = Math.min(100, mein.nacht_anteil_pct);
  const avgPct = Math.min(100, data.team_avg_pct);

  return (
    <div className="rounded-2xl border border-violet-700 bg-violet-950/40 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 border-b border-violet-700/40 flex items-center gap-2 bg-violet-900/20">
        <Moon className="w-4 h-4 text-violet-300" />
        <span className="text-sm font-semibold text-violet-200">Mein Nacht-Anteil (letzte 30 Tage)</span>
      </div>

      {/* Main Stats */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <div className={`text-4xl font-black ${ampelColor(mein.ampel)}`}>
            {mein.nacht_anteil_pct}%
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Nacht-Schichten</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${mein.rang === 1 ? 'text-violet-300' : 'text-gray-300'}`}>
            #{mein.rang}
          </div>
          <div className="text-xs text-gray-500">von {data.gesamt}</div>
        </div>
      </div>

      {/* Mini Bar: Ich vs Team-Ø */}
      <div className="px-4 pb-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Ich</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.round((ichPct / maxPct) * 100)}%` }} />
          </div>
          <span className="text-[10px] text-violet-300 w-10 text-right">{mein.nacht_anteil_pct}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Team-Ø</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gray-500" style={{ width: `${Math.round((avgPct / maxPct) * 100)}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 w-10 text-right">{data.team_avg_pct}%</span>
        </div>
      </div>

      {/* Coaching Tipp */}
      <div className="px-4 pb-3">
        <p className={`text-xs ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
