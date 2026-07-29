'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Zap } from 'lucide-react';

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
  if (euro >= 18) return { text: 'Exzellente Spitzenzeit-Performance! Du gehörst zur Spitzengruppe.', color: 'text-green-400' };
  if (euro >= 10) return { text: 'Gute Spitzenzeit-Effizienz. Mit mehr Einsatz in Stoßzeiten kannst du weiter steigen.', color: 'text-yellow-400' };
  return { text: 'Niedriger Spitzenzeit-Wert (<10€/Tour). Versuche, in den Stoßzeiten 11:30–14:00 und 17:30–21:00 aktiver zu sein.', color: 'text-red-400' };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase4778MeineSpitzenzeit({ driverId, locationId, isOnline }: { driverId: string; locationId: string | null; isOnline: boolean }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/admin/fahrer-spitzenzeit-ranking?${params}`);
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
      <div className="rounded-xl border border-orange-800 bg-orange-950/40 p-4 mb-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Offline — Spitzenzeit-Ranking nicht verfügbar</span>
      </div>
    );
  }

  if (!data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const { text: tipp, color: tippColor } = coachingTipp(me.avg_euro_tour);
  const maxEuro = Math.max(me.avg_euro_tour, data.team_avg_euro, 1);

  return (
    <div className="rounded-xl border border-orange-800 bg-orange-950/40 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-orange-400" />
        <span className="text-sm font-semibold text-orange-300">Meine Spitzenzeit</span>
      </div>

      <div className="text-center mb-4">
        <div className={`text-4xl font-bold ${ampelColor(me.ampel)}`}>{me.avg_euro_tour.toFixed(2)}€</div>
        <div className="text-xs text-gray-400 mt-1">Ø €/Tour (Stoßzeiten, 30 Tage)</div>
        <div className={`text-xl font-semibold mt-1 ${ampelColor(me.ampel)}`}>Rang {me.rang}</div>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Ich</span>
            <span className={ampelColor(me.ampel)}>{me.avg_euro_tour.toFixed(2)}€</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(me.avg_euro_tour / maxEuro) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Team-Ø</span>
            <span className="text-gray-300">{data.team_avg_euro.toFixed(2)}€</span>
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
