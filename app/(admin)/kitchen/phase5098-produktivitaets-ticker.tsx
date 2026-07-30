'use client';

import { useEffect, useState } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';

interface FahrerRang {
  rank: number;
  driver_id: string;
  fahrer_name: string;
  gesamtscore: number;
  stopps_pro_h: number;
  puenktlichkeit_pct: number;
  trend: 'up' | 'down' | 'gleich';
}

interface ApiResponse {
  rangliste: FahrerRang[];
}

export function KitchenPhase5098ProduktivitaetsTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-produktivitaets-rangliste?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-produktivitaets-rangliste';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data?.rangliste?.length) return null;

  const top = data.rangliste[0];
  const teamAvg = Math.round(
    data.rangliste.reduce((s, f) => s + f.gesamtscore, 0) / data.rangliste.length
  );

  return (
    <div className="rounded-xl border border-amber-700 bg-amber-900/60 px-4 py-3 mb-3 flex items-center gap-3">
      <Zap className="w-4 h-4 text-amber-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Produktivitäts-Ranking — Höchster Gesamt-Score</div>
        <div className="text-sm font-bold text-amber-100 truncate">
          #{top.rank} {top.fahrer_name} — {top.gesamtscore} Punkte ({top.stopps_pro_h} Stopps/h)
        </div>
        <div className="text-xs text-gray-500">Team-Ø: {teamAvg} Punkte</div>
      </div>
      {data.rangliste.filter(f => f.gesamtscore < 50).length > 0 && (
        <div className="flex items-center gap-1 text-xs text-red-400 shrink-0">
          <AlertTriangle className="w-3 h-3" />
          {data.rangliste.filter(f => f.gesamtscore < 50).length}
        </div>
      )}
    </div>
  );
}
