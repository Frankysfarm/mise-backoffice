'use client';

import { useEffect, useState } from 'react';
import { WifiOff, CalendarDays } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    wochenende_tph: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_wochenende_tph: number;
  gesamt: number;
}

function coachingTipp(tph: number): { text: string; color: string } {
  if (tph >= 2.5) return {
    text: 'Sehr hohe Wochenende-Produktivität! Top-Leistung Sa–So — achte auf ausreichende Erholung für die Woche.',
    color: 'text-red-400',
  };
  if (tph >= 1.5) return {
    text: 'Gute WE-Effizienz. Mit optimierten Routen am Wochenende kannst du noch mehr Touren pro Stunde schaffen.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Noch Potenzial bei Wochenend-Touren. Nutze das höhere Bestellvolumen am Sa–So für mehr Stopps pro Route.',
    color: 'text-green-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase4908MeineWochenendeProd({
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
    const res = await fetch(`/api/delivery/admin/fahrer-wochenende-prod-ranking?${params}`);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId, isOnline]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-cyan-700 bg-cyan-900/60 p-4 mb-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Offline — Wochenende-Produktivität nicht verfügbar</span>
      </div>
    );
  }

  if (!data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const { text: tipp, color: tippColor } = coachingTipp(me.wochenende_tph);
  const maxTph = Math.max(me.wochenende_tph, data.team_avg_wochenende_tph, 1);

  return (
    <div className="rounded-xl border border-cyan-700 bg-cyan-900/60 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-cyan-300" />
        <span className="text-sm font-semibold text-cyan-100">Meine Wochenende-Produktivität</span>
      </div>

      <div className="text-center mb-4">
        <div className={`text-4xl font-bold ${ampelColor(me.ampel)}`}>{me.wochenende_tph.toFixed(1)}</div>
        <div className="text-sm text-gray-400">Touren/h (Sa–So)</div>
        <div className="text-xs text-gray-400 mt-1">Letzte 30 Tage</div>
        <div className={`text-xl font-semibold mt-1 ${ampelColor(me.ampel)}`}>Rang {me.rang}</div>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Ich (Sa–So)</span>
            <span className={ampelColor(me.ampel)}>{me.wochenende_tph.toFixed(1)} T/h</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${(me.wochenende_tph / maxTph) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Team-Ø Sa–So</span>
            <span className="text-gray-300">{data.team_avg_wochenende_tph.toFixed(1)} T/h</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gray-500 rounded-full" style={{ width: `${(data.team_avg_wochenende_tph / maxTph) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className={`text-xs rounded p-2 bg-black/20 ${tippColor}`}>{tipp}</div>
    </div>
  );
}
