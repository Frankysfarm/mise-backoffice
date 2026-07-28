'use client';

import { useEffect, useState } from 'react';
import { Sun, WifiOff } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    rang: number;
    samstag_pct: number;
    ampel: 'gruen' | 'gelb' | 'rot';
    alert_niedrig: boolean;
  }>;
  gesamt: number;
}

function coaching(pct: number): string {
  if (pct >= 60) return 'Top! Du bist oft samstagmittags dabei.';
  if (pct >= 30) return 'Gut! Samstagmittag-Anteil im Bereich.';
  return 'Wenig Samstagmittag-Touren — Sa 11–15 Uhr einplanen?';
}

export function FahrerPhase4604MeinSamstagMittag({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<{ pct: number; rang: number; gesamt: number } | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-samstag-mittag-ranking${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: ApiResponse = await res.json();
        const me = json.fahrer.find(f => f.fahrer_id === driverId);
        if (!cancelled && me) {
          setData({ pct: me.samstag_pct, rang: me.rang, gesamt: json.gesamt });
        }
      } catch {
        // silent
      }
    }

    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [driverId, locationId, isOnline]);

  if (!isOnline) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-5 h-5" />
        <span className="text-sm">Offline — Samstagmittag nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 animate-pulse h-32" />
    );
  }

  return (
    <div className="rounded-2xl border border-yellow-200 dark:border-yellow-800 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sun className="w-5 h-5 text-yellow-400" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Mein Samstagmittag</h3>
      </div>

      <div className="flex items-end gap-4">
        <span className="text-5xl font-extrabold text-yellow-500">{data.pct}%</span>
        <div className="pb-1">
          <p className="text-xs text-gray-400">Rang</p>
          <p className="text-2xl font-bold text-gray-700 dark:text-gray-200">
            #{data.rang} <span className="text-sm font-normal text-gray-400">/ {data.gesamt}</span>
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">{coaching(data.pct)}</p>
    </div>
  );
}
