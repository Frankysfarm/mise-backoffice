'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Moon } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  abend_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  gesamt: number;
}

function coachingTipp(val: number): { text: string; color: string } {
  if (val >= 40) return {
    text: 'Starker Abend-Anteil! Du übernimmst oft Abendtouren — das hilft dem Team in der Stoßzeit.',
    color: 'text-indigo-300',
  };
  if (val >= 20) return {
    text: 'Guter Mix. Mit mehr Abendschichten (18–22 Uhr) kannst du deinen Abend-Anteil steigern.',
    color: 'text-blue-400',
  };
  return {
    text: 'Wenig Abendtouren. Abendschichten zwischen 18–22 Uhr verbessern dein Ranking und das Team.',
    color: 'text-gray-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-indigo-300';
  if (a === 'gelb') return 'text-blue-400';
  return 'text-gray-400';
}

export function FahrerPhase5149MeinAbendAnteil({
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
    const res = await fetch(`/api/delivery/admin/fahrer-abend-anteil-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Mein Abend-Anteil — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp   = coachingTipp(mein.abend_pct);
  const maxVal = Math.max(mein.abend_pct, data.team_avg, 1);
  const ichPct = Math.min(100, Math.round((mein.abend_pct / maxVal) * 100));
  const avgPct = Math.min(100, Math.round((data.team_avg / maxVal) * 100));

  return (
    <div className="rounded-2xl border border-indigo-800/40 bg-indigo-950/20 overflow-hidden mb-3">
      <div className="px-4 py-3 border-b border-indigo-800/30 flex items-center gap-2 bg-indigo-900/10">
        <Moon className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-indigo-200">Mein Abend-Anteil — 18–22 Uhr UTC (letzte 30 Tage)</span>
      </div>

      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <div className={`text-4xl font-black ${ampelColor(mein.ampel)}`}>
            {mein.abend_pct} %
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Touren zwischen 18–22 Uhr UTC</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${mein.rang === 1 ? 'text-indigo-300' : 'text-gray-300'}`}>
            #{mein.rang}
          </div>
          <div className="text-xs text-gray-500">von {data.gesamt}</div>
        </div>
      </div>

      <div className="px-4 pb-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Ich</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-400" style={{ width: `${ichPct}%` }} />
          </div>
          <span className="text-[10px] text-indigo-300 w-14 text-right">{mein.abend_pct} %</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Team-Ø</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gray-500" style={{ width: `${avgPct}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 w-14 text-right">{data.team_avg} %</span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className={`text-xs ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
