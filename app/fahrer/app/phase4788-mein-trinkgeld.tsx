'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Euro } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    avg_trinkgeld_eur: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_eur: number;
  gesamt: number;
}

function coachingTipp(eur: number): { text: string; color: string } {
  if (eur >= 3) return { text: 'Hervorragend! Dein Trinkgeld liegt deutlich über dem Schnitt.', color: 'text-green-400' };
  if (eur >= 1.5) return { text: 'Solides Trinkgeld. Freundlichkeit und Pünktlichkeit helfen weiter.', color: 'text-yellow-400' };
  return { text: 'Niedriges Trinkgeld (<1,50 €). Lächeln und schnelle Lieferung machen den Unterschied.', color: 'text-red-400' };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase4788MeinTrinkgeld({ driverId, locationId, isOnline }: { driverId: string; locationId: string | null; isOnline: boolean }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/admin/fahrer-trinkgeld-ranking?${params}`);
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
      <div className="rounded-xl border border-indigo-800 bg-indigo-950/40 p-4 mb-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Offline — Trinkgeld nicht verfügbar</span>
      </div>
    );
  }

  if (!data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const { text: tipp, color: tippColor } = coachingTipp(me.avg_trinkgeld_eur);
  const maxEur = Math.max(me.avg_trinkgeld_eur, data.team_avg_eur, 1);

  return (
    <div className="rounded-xl border border-indigo-800 bg-indigo-950/40 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Euro className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-indigo-300">Mein Ø-Trinkgeld</span>
      </div>

      <div className="text-center mb-4">
        <div className={`text-4xl font-bold ${ampelColor(me.ampel)}`}>{me.avg_trinkgeld_eur.toFixed(2)} €</div>
        <div className="text-xs text-gray-400 mt-1">Ø pro Tour (30 Tage)</div>
        <div className={`text-xl font-semibold mt-1 ${ampelColor(me.ampel)}`}>Rang {me.rang}</div>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Ich</span>
            <span className={ampelColor(me.ampel)}>{me.avg_trinkgeld_eur.toFixed(2)} €</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(me.avg_trinkgeld_eur / maxEur) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Team-Ø</span>
            <span className="text-gray-300">{data.team_avg_eur.toFixed(2)} €</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gray-500 rounded-full" style={{ width: `${(data.team_avg_eur / maxEur) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className={`text-xs rounded p-2 bg-black/20 ${tippColor}`}>{tipp}</div>
    </div>
  );
}
