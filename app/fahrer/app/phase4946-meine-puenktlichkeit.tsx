'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Clock } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    pct_on_time: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg: number;
  gesamt: number;
}

function coachingTipp(val: number): { text: string; color: string } {
  if (val >= 90) return {
    text: 'Herausragende Pünktlichkeit! Du lieferst fast immer innerhalb des zugesagten Zeitfensters. Spitzen-Performance!',
    color: 'text-green-300',
  };
  if (val >= 70) return {
    text: 'Solide Pünktlichkeit. Plane Touren realistischer und kommuniziere Verzögerungen früh, um deinen Score weiter zu steigern.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Potenzial vorhanden: Effizientere Routenplanung und pünktliche Abholung beim Restaurant verbessern deinen Pünktlichkeits-Score deutlich.',
    color: 'text-gray-400',
  };
}

function ampelColor(a: string) {
  if (a === 'rot') return 'text-green-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-gray-400';
}

export function FahrerPhase4946MeinePuenktlichkeit({
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
    const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit-score-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Pünktlichkeit — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.pct_on_time);
  const maxVal = Math.max(...data.fahrer.map(f => f.pct_on_time), 1);
  const barPct = Math.min(100, Math.round((mein.pct_on_time / maxVal) * 100));
  const teamBarPct = Math.min(100, Math.round((data.team_avg / maxVal) * 100));

  return (
    <div className="rounded-2xl border border-green-700 bg-green-950/40 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-green-700/50 bg-green-900/20">
        <Clock className="w-4 h-4 text-green-300 shrink-0" />
        <span className="text-sm font-semibold text-green-200">Meine Pünktlichkeit</span>
      </div>

      {/* Main stat */}
      <div className="px-4 py-4 flex items-end gap-3">
        <span className={`text-4xl font-extrabold tabular-nums ${ampelColor(mein.ampel)}`}>
          {mein.pct_on_time}
        </span>
        <div className="pb-1">
          <div className="text-sm text-gray-400">% pünktlich</div>
          <div className="text-xs text-gray-500">Rang #{mein.rang} von {data.gesamt}</div>
        </div>
      </div>

      {/* Mini-Balken: Ich vs Team-Ø */}
      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-14 shrink-0">Ich</span>
          <div className="flex-1 h-2 bg-green-900/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${mein.ampel === 'rot' ? 'bg-green-400' : mein.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-gray-600'}`}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <span className={`text-[10px] font-bold tabular-nums w-16 text-right ${ampelColor(mein.ampel)}`}>
            {mein.pct_on_time} %
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-14 shrink-0">Team-Ø</span>
          <div className="flex-1 h-2 bg-green-900/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-green-800"
              style={{ width: `${teamBarPct}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums w-16 text-right">
            {data.team_avg} %
          </span>
        </div>
      </div>

      {/* Coaching */}
      <div className="px-4 pb-3">
        <div className={`text-xs ${tipp.color} bg-green-900/30 rounded-lg px-3 py-2 leading-relaxed`}>
          {tipp.text}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-green-800/30">
        <span className="text-[10px] text-gray-600">Rang 1 = höchste Pünktlichkeit · 30-Min-Polling · letzte 30 Tage</span>
      </div>
    </div>
  );
}
