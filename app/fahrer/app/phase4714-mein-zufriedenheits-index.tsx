'use client';

import { useEffect, useState } from 'react';
import { Star, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  zufriedenheits_index: number;
  avg_rating: number;
  puenktlichkeit_pct: number;
  erstkontakt_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_index: number;
  gesamt: number;
}

const rangColor: Record<string, string> = {
  gruen: 'text-emerald-400',
  gelb:  'text-amber-400',
  rot:   'text-red-400',
};

export function FahrerPhase4714MeinZufriedenheitsIndex({
  locationId,
  driverId,
  isOnline,
}: {
  locationId: string | null;
  driverId: string;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-zufriedenheits-index-ranking?location_id=${locationId}&driver_id=${driverId}`
      );
      if (r.ok) setData(await r.json());
    } catch { /* silent */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, driverId]);

  if (!isOnline) return (
    <div className="rounded-2xl bg-indigo-900 p-4 flex items-center gap-3 text-indigo-300">
      <WifiOff className="w-5 h-5 shrink-0" />
      <span className="text-sm">Offline — Zufriedenheits-Index nicht verfügbar</span>
    </div>
  );

  const me = data?.fahrer?.[0];
  const teamAvg = data?.team_avg_index ?? 0;

  function coaching(idx: number) {
    if (idx >= 85) return 'Hervorragend! Du bist ein Top-Performer. Weiter so!';
    if (idx >= 65) return 'Guter Index! Fokus auf Pünktlichkeit und Kundenkontakt für weitere Verbesserung.';
    return 'Index verbessern: freundlicher Erstkontakt + pünktliche Lieferung machen den Unterschied.';
  }

  return (
    <div className="rounded-2xl bg-indigo-900 text-white p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-indigo-300" />
        <span className="font-semibold text-indigo-100">Mein Zufriedenheits-Index</span>
      </div>

      {!me ? (
        <p className="text-indigo-300 text-sm animate-pulse">Lade Daten…</p>
      ) : (
        <>
          <div className="flex items-end gap-4">
            <span className={`text-4xl font-black ${rangColor[me.ampel]}`}>
              {me.zufriedenheits_index}
            </span>
            <span className={`text-2xl font-bold ${rangColor[me.ampel]}`}>
              Rang #{me.rang} / {data?.gesamt}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-indigo-800/60 p-2">
              <p className="text-xs text-indigo-400">Bewertung</p>
              <p className="text-sm font-bold text-white">★ {me.avg_rating.toFixed(1)}</p>
            </div>
            <div className="rounded-lg bg-indigo-800/60 p-2">
              <p className="text-xs text-indigo-400">Pünktlichkeit</p>
              <p className="text-sm font-bold text-white">{me.puenktlichkeit_pct}%</p>
            </div>
            <div className="rounded-lg bg-indigo-800/60 p-2">
              <p className="text-xs text-indigo-400">Erstkontakt</p>
              <p className="text-sm font-bold text-white">{me.erstkontakt_pct}%</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-indigo-400">
              <span>Ich</span>
              <span>Team-Ø {teamAvg}</span>
            </div>
            <div className="h-2 rounded-full bg-indigo-800 relative">
              <div
                className={`h-full rounded-full ${rangColor[me.ampel].replace('text-', 'bg-')}`}
                style={{ width: `${Math.min(me.zufriedenheits_index, 100)}%` }}
              />
              <div
                className="absolute top-0 h-full w-0.5 bg-white/40"
                style={{ left: `${Math.min(teamAvg, 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg bg-indigo-800/40 p-3 text-xs text-indigo-200">
            💡 {coaching(me.zufriedenheits_index)}
          </div>
        </>
      )}
    </div>
  );
}
