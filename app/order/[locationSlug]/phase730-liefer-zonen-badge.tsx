'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

interface Props {
  locationId: string | null;
  adresse?: string;
}

interface ZonenInfo {
  zone: string;
  lieferzeit_min: number;
  liefergebuehr_eur: number;
  verfuegbar: boolean;
  farbe: 'grün' | 'gelb' | 'rot';
}

const MOCK: ZonenInfo = {
  zone: 'Zone A',
  lieferzeit_min: 25,
  liefergebuehr_eur: 2.50,
  verfuegbar: true,
  farbe: 'grün',
};

function farbenKlassen(f: ZonenInfo['farbe']) {
  switch (f) {
    case 'grün': return 'bg-emerald-100 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300';
    case 'gelb': return 'bg-amber-100 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300';
    case 'rot': return 'bg-red-100 dark:bg-red-950/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300';
  }
}

export function Phase730LieferZonenBadge({ locationId, adresse }: Props) {
  const [data, setData] = useState<ZonenInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ location_id: locationId });
      if (adresse) params.set('adresse', adresse);
      const res = await fetch(
        `/api/delivery/admin/coverage?${params.toString()}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.zone) {
          setData({
            zone: json.zone,
            lieferzeit_min: json.lieferzeit_min ?? 30,
            liefergebuehr_eur: json.liefergebuehr_eur ?? 2.50,
            verfuegbar: json.verfuegbar ?? true,
            farbe: json.verfuegbar === false ? 'rot' : (json.lieferzeit_min ?? 30) <= 25 ? 'grün' : 'gelb',
          });
          return;
        }
      }
    } catch {
      // fallback
    }
    setData(MOCK);
  }, [locationId, adresse]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
  }, [laden]);

  if (loading || !data) return null;

  return (
    <div className={`rounded-xl border px-4 py-3 ${farbenKlassen(data.farbe)}`}>
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">
            {data.verfuegbar ? `${data.zone} — Lieferung möglich` : 'Außerhalb des Liefergebiets'}
          </p>
          {data.verfuegbar && (
            <p className="text-[10px] mt-0.5 opacity-80">
              ca. {data.lieferzeit_min} Min · {data.liefergebuehr_eur.toFixed(2)} € Liefergebühr
            </p>
          )}
        </div>
        {data.verfuegbar && (
          <span className="text-xs font-bold tabular-nums shrink-0">
            {data.zone}
          </span>
        )}
      </div>
    </div>
  );
}
