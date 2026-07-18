'use client';
import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

interface ZoneInfo {
  avg_distanz_km: number;
  auslastung_pct: number;
}

interface ApiData {
  zonen: ZoneInfo[];
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2351LiefergebietBadge({ locationId, className }: Props) {
  const [avgKm, setAvgKm] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    async function load() {
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-liefergebiet-opt?location_id=${locationId}`);
        if (!r.ok) return;
        const d: ApiData = await r.json();
        const servingZones = d.zonen.filter((z) => z.auslastung_pct < 80 && z.avg_distanz_km > 0);
        if (servingZones.length === 0) return;
        const avg = servingZones.reduce((s, z) => s + z.avg_distanz_km, 0) / servingZones.length;
        if (avg <= 4) setAvgKm(Math.round(avg * 10) / 10);
      } catch {}
    }
    load();
    const t = setInterval(load, 4 * 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!mounted || avgKm === null) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs text-blue-700 font-medium ${className ?? ''}`}>
      <MapPin size={12} className="shrink-0" />
      <span>Schnelle Lieferung in Ihrer Zone — Ø {avgKm} km</span>
    </div>
  );
}
