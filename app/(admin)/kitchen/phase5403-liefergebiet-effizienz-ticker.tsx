'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, AlertTriangle } from 'lucide-react';

// Phase 5403 — Liefergebiet-Effizienz-Ticker (Kitchen)
// MapPin teal-400; Beste/r #1 Name+L/km; Team-Ø; Niedrig-Alert alert_bottom; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  fahrer: { fahrer_id: string; fahrer_name: string; rang: number; lieferungen_pro_km: number; alert_bottom: boolean }[];
  team_avg: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, lieferungen_pro_km: 1.25, alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, lieferungen_pro_km: 0.37, alert_bottom: true  },
  ],
  team_avg: 0.75,
  bester_name: 'Julia F.',
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5403LiefergebietEffizienzTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = () => {
      const url = locationId
        ? `/api/delivery/admin/fahrer-lieferungen-pro-km?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-lieferungen-pro-km';
      fetch(url, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setData(d); })
        .catch(() => {});
    };
    poll();
    ivRef.current = setInterval(poll, 30 * 60_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [locationId]);

  const top = data.fahrer[0];

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 flex items-center gap-3 text-sm font-mono">
      <MapPin className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-[10px] text-zinc-500">Gebiet-Effizienz #1</span>
        <span className="text-xs font-bold text-zinc-200 truncate">{top?.fahrer_name ?? '–'}</span>
        <span className="text-xs font-bold text-teal-400">{top ? top.lieferungen_pro_km.toFixed(2) : '0.00'} L/km</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] text-zinc-500">Ø {data.team_avg.toFixed(2)}</span>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="text-[10px] text-red-400">{data.alert_count}</span>
          </div>
        )}
      </div>
    </div>
  );
}
