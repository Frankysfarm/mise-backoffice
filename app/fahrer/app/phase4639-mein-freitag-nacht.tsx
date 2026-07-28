'use client';

import { useEffect, useState } from 'react';
import { Moon, WifiOff } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    rang: number;
    freitag_pct: number;
    ampel: 'gruen' | 'gelb' | 'rot';
    alert_niedrig: boolean;
  }>;
  gesamt: number;
}

function coaching(pct: number): string {
  if (pct >= 35) return 'Top! Du bist oft freitagnachts dabei.';
  if (pct >= 18) return 'Gut! Freitagnacht-Anteil im Bereich.';
  return 'Wenig Freitagnacht-Touren — Fr 22–02 Uhr einplanen?';
}

export function FahrerPhase4639MeinFreitagNacht({
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
        const res = await fetch(`/api/delivery/admin/fahrer-freitag-nacht-ranking${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: ApiResponse = await res.json();
        const me = json.fahrer.find(f => f.fahrer_id === driverId);
        if (!cancelled && me) {
          setData({ pct: me.freitag_pct, rang: me.rang, gesamt: json.gesamt });
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
        <span className="text-sm">Offline — Freitagnacht nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 animate-pulse h-32" />
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Moon className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Mein Freitagnacht</h3>
      </div>

      <div className="flex items-end gap-4">
        <span className="text-5xl font-extrabold text-emerald-700 dark:text-emerald-300">{data.pct}%</span>
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
