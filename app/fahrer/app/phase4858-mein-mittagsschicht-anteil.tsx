'use client';

import { useEffect, useState } from 'react';
import { WifiOff, UtensilsCrossed } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    mittagsschicht_anteil_pct: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_pct: number;
  gesamt: number;
}

function coachingTipp(pct: number): { text: string; color: string } {
  if (pct >= 45) return { text: 'Viele Mittags-Touren! Denk an ausreichend Pausen zwischen den Schichten — sprich mit dem Teamleiter über deine Planung.', color: 'text-red-400' };
  if (pct >= 20) return { text: 'Moderate Mittags-Touren. Gut, dass du die Stoßzeiten abdeckst — achte auf dein Energieniveau!', color: 'text-yellow-400' };
  return { text: 'Wenige Mittags-Touren — ausgeglichene Schichtverteilung. Weiter so!', color: 'text-green-400' };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase4858MeinMittagsschichtAnteil({ driverId, locationId, isOnline }: { driverId: string; locationId: string | null; isOnline: boolean }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/admin/fahrer-mittagsschicht-ranking?${params}`);
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
      <div className="rounded-xl border border-yellow-700 bg-yellow-900/60 p-4 mb-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Offline — Mittags-Anteil nicht verfügbar</span>
      </div>
    );
  }

  if (!data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const { text: tipp, color: tippColor } = coachingTipp(me.mittagsschicht_anteil_pct);
  const maxPct = Math.max(me.mittagsschicht_anteil_pct, data.team_avg_pct, 1);

  return (
    <div className="rounded-xl border border-yellow-700 bg-yellow-900/60 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <UtensilsCrossed className="w-4 h-4 text-yellow-300" />
        <span className="text-sm font-semibold text-yellow-100">Mein Mittags-Anteil</span>
      </div>

      <div className="text-center mb-4">
        <div className={`text-4xl font-bold ${ampelColor(me.ampel)}`}>{me.mittagsschicht_anteil_pct.toFixed(1)}%</div>
        <div className="text-xs text-gray-400 mt-1">Touren 11:00–14:00 Uhr UTC (letzte 30 Tage)</div>
        <div className={`text-xl font-semibold mt-1 ${ampelColor(me.ampel)}`}>Rang {me.rang}</div>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Ich</span>
            <span className={ampelColor(me.ampel)}>{me.mittagsschicht_anteil_pct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(me.mittagsschicht_anteil_pct / maxPct) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Team-Ø</span>
            <span className="text-gray-300">{data.team_avg_pct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gray-500 rounded-full" style={{ width: `${(data.team_avg_pct / maxPct) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className={`text-xs rounded p-2 bg-black/20 ${tippColor}`}>{tipp}</div>
    </div>
  );
}
