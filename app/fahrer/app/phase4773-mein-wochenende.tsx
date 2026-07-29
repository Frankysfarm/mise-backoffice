'use client';

import { useEffect, useState } from 'react';
import { WifiOff, CalendarDays } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    avg_euro_tour: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_euro: number;
  gesamt: number;
}

function coachingTipp(euro: number): { text: string; color: string } {
  if (euro >= 20) return { text: 'Hervorragende Wochenend-Effizienz! Weiter so — dein Einsatz am Wochenende zahlt sich aus.', color: 'text-green-400' };
  if (euro >= 12) return { text: 'Solider Wochenend-Wert. Mit mehr Touren pro Schicht kannst du noch höher kommen.', color: 'text-yellow-400' };
  return { text: 'Niedriger Wochenend-Wert (<12 €/Tour). Versuche Stoßzeiten (Sa/So Mittag/Abend) zu nutzen.', color: 'text-red-400' };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase4773MeinWochenende({ driverId, locationId, isOnline }: { driverId: string; locationId: string | null; isOnline: boolean }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/admin/fahrer-wochenend-ranking?${params}`);
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
      <div className="rounded-xl border border-teal-800 bg-teal-950/40 p-4 mb-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Offline — Wochenend-Ranking nicht verfügbar</span>
      </div>
    );
  }

  if (!data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const { text: tipp, color: tippColor } = coachingTipp(me.avg_euro_tour);
  const maxEuro = Math.max(me.avg_euro_tour, data.team_avg_euro, 1);

  return (
    <div className="rounded-xl border border-teal-800 bg-teal-950/40 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-teal-400" />
        <span className="text-sm font-semibold text-teal-300">Mein Wochenend-Wert</span>
      </div>

      <div className="text-center mb-4">
        <div className={`text-4xl font-bold ${ampelColor(me.ampel)}`}>{me.avg_euro_tour.toFixed(2)} €</div>
        <div className="text-xs text-gray-400 mt-1">Ø €/Tour am Wochenende (30 Tage)</div>
        <div className={`text-2xl font-semibold mt-1 ${ampelColor(me.ampel)}`}>Rang {me.rang}</div>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Ich</span>
            <span className={ampelColor(me.ampel)}>{me.avg_euro_tour.toFixed(2)} €</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(me.avg_euro_tour / maxEuro) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Team-Ø</span>
            <span className="text-gray-300">{data.team_avg_euro.toFixed(2)} €</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gray-500 rounded-full" style={{ width: `${(data.team_avg_euro / maxEuro) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className={`text-xs rounded p-2 bg-black/20 ${tippColor}`}>{tipp}</div>
    </div>
  );
}
