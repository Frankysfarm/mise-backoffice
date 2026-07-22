'use client';
import { useEffect, useState } from 'react';
import { Zap, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_sek: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_sek: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

function fmtSek(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function coachingTipp(ampel: string): string {
  if (ampel === 'gruen') return 'Sehr gut! Du reagierst blitzschnell auf neue Aufträge.';
  if (ampel === 'gelb')  return 'Solide Reaktionszeit — kleine Verbesserungen bringen dich weiter nach vorne.';
  return 'Reagiere schneller auf neue Touren, um deinen Rang zu verbessern.';
}

export function FahrerPhase3242MeineReaktionszeit({
  driverId, locationId, isOnline,
}: { driverId: string | null; locationId: string | null; isOnline: boolean }) {
  const [data, setData]       = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!isOnline) return;
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      if (driverId)   params.set('driver_id', driverId);
      const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit-ranking?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const t = setInterval(load, 30 * 60 * 1000); return () => clearInterval(t); }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;
  if (loading)   return <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse h-40 bg-gray-50 dark:bg-gray-800/40" />;
  if (!data)     return null;

  const me = data.fahrer[0] ?? null;
  if (!me) return null;

  const pct = data.gesamt > 1 ? Math.round(((data.gesamt - me.rang) / (data.gesamt - 1)) * 100) : 100;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-yellow-500" />
        <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Reaktionszeit</span>
      </div>

      {/* Rang + Zeit */}
      <div className="flex items-end gap-4">
        <div className="text-center">
          <div className={`text-4xl font-black ${me.ampel === 'gruen' ? 'text-green-600' : me.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500'}`}>
            #{me.rang}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Rang</div>
        </div>
        <div className="text-center">
          <div className={`text-4xl font-black ${me.ampel === 'gruen' ? 'text-green-600' : me.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500'}`}>
            {fmtSek(me.avg_sek)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Ø Reaktion</div>
        </div>
      </div>

      {/* Rang-Balken 1–N (bessere Position = mehr Breite) */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Rang {data.gesamt}</span>
          <span>Rang 1</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${me.ampel === 'gruen' ? 'bg-green-500' : me.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Delta-Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs text-center">
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-gray-500">Δ vs. Vortag</div>
          <div className="font-semibold">
            {me.rank_delta < 0
              ? <span className="text-green-600 flex items-center justify-center gap-0.5"><TrendingDown size={11} />{me.rank_delta}s</span>
              : me.rank_delta > 0
              ? <span className="text-red-500 flex items-center justify-center gap-0.5"><TrendingUp size={11} />+{me.rank_delta}s</span>
              : <span className="text-gray-400 flex items-center justify-center gap-0.5"><Minus size={11} />0</span>
            }
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-gray-500">Team-Ø</div>
          <div className="font-semibold text-blue-600 dark:text-blue-400">{fmtSek(data.team_avg_sek)}</div>
        </div>
      </div>

      {/* Coaching-Tipp */}
      <div className={`text-xs rounded-lg p-2 ${me.ampel === 'gruen' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : me.ampel === 'gelb' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
        {coachingTipp(me.ampel)}
      </div>
    </div>
  );
}
