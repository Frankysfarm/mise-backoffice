'use client';
import { useEffect, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  rang: number;
  score: number;
  bewertungen: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_score: number;
  gesamt: number;
}

function Stars({ score }: { score: number }) {
  const full  = Math.floor(score);
  const half  = score - full >= 0.3 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <span className="flex gap-1 items-center justify-center">
      {Array.from({ length: full  }).map((_, i) => <Star key={`f${i}`} size={20} className="text-yellow-400 fill-yellow-400" />)}
      {half === 1 && <Star size={20} className="text-yellow-400 fill-yellow-200" />}
      {Array.from({ length: empty }).map((_, i) => <Star key={`e${i}`} size={20} className="text-gray-300" />)}
    </span>
  );
}

function coachingTipp(ampel: string): string {
  if (ampel === 'gruen') return 'Exzellente Bewertungen! Weiter so — du bist ein Top-Fahrer.';
  if (ampel === 'gelb')  return 'Solide Leistung. Ein freundliches Lächeln beim Übergeben macht den Unterschied.';
  return 'Kundenzufriedenheit verbessern: Pünktlichkeit, freundlicher Kontakt und sorgfältige Übergabe zählen.';
}

export function FahrerPhase3222MeineKundenzufriedenheit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData]     = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!isOnline) return;
    try {
      const params = new URLSearchParams({ driver_id: driverId });
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/fahrer-kundenzufriedenheit-score?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const t = setInterval(load, 30 * 60 * 1000); return () => clearInterval(t); }, [driverId, locationId, isOnline]);

  if (!isOnline) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
      <WifiOff size={16} /> Offline — keine Daten
    </div>
  );

  if (loading) return <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse h-48 bg-gray-50 dark:bg-gray-800/40" />;

  const me = data?.fahrer?.[0];
  if (!me) return null;

  const ampelColor = me.ampel === 'gruen' ? 'text-green-600' : me.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-600';
  const barWidth   = Math.round((me.rang / (data?.gesamt ?? 1)) * 100);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Star size={16} className="text-yellow-400 fill-yellow-400" />
        <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Kundenzufriedenheit</span>
      </div>

      {/* Rang + Score */}
      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <div className="text-5xl font-black text-gray-800 dark:text-gray-100">#{me.rang}</div>
          <div className="text-xs text-gray-400 mt-0.5">von {data?.gesamt}</div>
        </div>
        <div className="text-center">
          <div className={`text-5xl font-black ${ampelColor}`}>{me.score.toFixed(1)}</div>
          <Stars score={me.score} />
        </div>
      </div>

      {/* Rang-Balken */}
      <div>
        <div className="text-xs text-gray-500 mb-1">Rang-Position (Rang 1 = bester)</div>
        <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${me.ampel === 'gruen' ? 'bg-green-500' : me.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500'}`}
            style={{ width: `${100 - barWidth + (1 / (data?.gesamt ?? 1)) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>#1 Bester</span><span>#{data?.gesamt} Letzter</span></div>
      </div>

      {/* Delta-Grid */}
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-gray-400">Rang-Δ</div>
          <div className="font-semibold flex items-center justify-center gap-1 mt-0.5">
            {me.rank_delta > 0 ? <><TrendingUp size={12} className="text-green-500" /><span className="text-green-600">+{me.rank_delta}</span></> :
             me.rank_delta < 0 ? <><TrendingDown size={12} className="text-red-500" /><span className="text-red-500">{me.rank_delta}</span></> :
             <><Minus size={12} className="text-gray-400" /><span className="text-gray-400">±0</span></>}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-gray-400">Team-Ø</div>
          <div className="font-semibold text-blue-600 dark:text-blue-400 mt-0.5">{data?.team_avg_score?.toFixed(1)} ★</div>
        </div>
      </div>

      {/* Bewertungen-Zähler */}
      <div className="text-center text-xs text-gray-500">
        {me.bewertungen} Bewertung{me.bewertungen !== 1 ? 'en' : ''} heute
      </div>

      {/* Coaching-Tipp */}
      <div className={`rounded-lg p-3 text-xs ${me.ampel === 'gruen' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : me.ampel === 'gelb' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
        {coachingTipp(me.ampel)}
      </div>
    </div>
  );
}
