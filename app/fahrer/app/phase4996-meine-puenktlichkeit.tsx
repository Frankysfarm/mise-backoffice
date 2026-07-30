'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Clock } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    rate_pct: number;
    ampel: 'gruen' | 'gelb' | 'rot';
    alert_niedrig: boolean;
  }>;
  team_avg_pct: number;
  gesamt: number;
}

function coachingTipp(pct: number): { text: string; color: string } {
  if (pct >= 90) return {
    text: 'Exzellente Pünktlichkeit! Du lieferst zuverlässig im Zeitfenster — Top-Performer im Team.',
    color: 'text-green-300',
  };
  if (pct >= 75) return {
    text: 'Gute Pünktlichkeit! Kurze Routen zuerst und direkte Übergabe helfen dir über 90% zu kommen.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Verbesserungspotenzial: Plane ausreichend Zeit für Stopps ein — Pünktlichkeit steigert dein Kunden-Rating.',
    color: 'text-gray-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-gray-400';
}

export function FahrerPhase4996MeinePuenktlichkeit({
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
    const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeits-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Meine Pünktlichkeit — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.rate_pct);
  const ichPct = Math.min(100, mein.rate_pct);
  const avgPct = Math.min(100, data.team_avg_pct);

  return (
    <div className="rounded-2xl border border-green-700 bg-green-950/40 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 border-b border-green-700/40 flex items-center gap-2 bg-green-900/20">
        <Clock className="w-4 h-4 text-green-300" />
        <span className="text-sm font-semibold text-green-200">Meine Pünktlichkeit (letzte 30 Tage)</span>
      </div>

      {/* Main Stats */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <div className={`text-4xl font-black ${ampelColor(mein.ampel)}`}>
            {mein.rate_pct}%
          </div>
          <div className="text-xs text-gray-500 mt-0.5">pünktliche Lieferungen</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${mein.rang === 1 ? 'text-green-300' : 'text-gray-300'}`}>
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
            <div className="h-full rounded-full bg-green-400" style={{ width: `${ichPct}%` }} />
          </div>
          <span className="text-[10px] text-green-300 w-16 text-right">{mein.rate_pct}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Team-Ø</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gray-500" style={{ width: `${avgPct}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 w-16 text-right">{data.team_avg_pct}%</span>
        </div>
      </div>

      {/* Coaching Tipp */}
      <div className="px-4 pb-3">
        <p className={`text-xs ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
