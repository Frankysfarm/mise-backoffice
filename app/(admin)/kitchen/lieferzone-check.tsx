'use client';

import { useEffect, useState } from 'react';
import { MapPin, AlertTriangle } from 'lucide-react';

interface UnderservedZone {
  id: string;
  gridLat: number;
  gridLng: number;
  zoneLabel: string | null;
  severity: 'low' | 'medium' | 'high';
  lateRate: number | null;
  stopCount: number;
}

export function LieferzonenCheck({ locationId: _locationId }: { locationId: string }) {
  const [zones, setZones] = useState<UnderservedZone[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch('/api/delivery/admin/tour-heatmap?action=underserved')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: UnderservedZone[]) => setZones(data.filter((z) => z.severity !== 'low')))
      .catch(() => {});
  }, []);

  if (zones.length === 0 || dismissed) return null;

  const highCount = zones.filter((z) => z.severity === 'high').length;

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${highCount > 0 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className={`mt-0.5 p-1 rounded ${highCount > 0 ? 'bg-red-100' : 'bg-amber-100'}`}>
        <MapPin className={`h-4 w-4 ${highCount > 0 ? 'text-red-600' : 'text-amber-600'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-3.5 w-3.5 ${highCount > 0 ? 'text-red-500' : 'text-amber-500'}`} />
          <span className="text-sm font-semibold">
            {zones.length} unterversorgte Lieferzone{zones.length > 1 ? 'n' : ''} erkannt
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {highCount > 0
            ? `${highCount} kritische Zone${highCount > 1 ? 'n' : ''} mit hoher Verspätungsrate`
            : 'Zonen mit erhöhter Verspätungsrate'}{' '}
          — Zubereitungszeiten anpassen?
        </p>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {zones.slice(0, 3).map((z) => (
            <span
              key={z.id}
              className={`text-xs px-2 py-0.5 rounded-full ${z.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}
            >
              {z.zoneLabel ? `Zone ${z.zoneLabel}` : `${z.gridLat.toFixed(2)}°N`}
              {z.lateRate != null ? ` · ${z.lateRate}% spät` : ''}
            </span>
          ))}
          {zones.length > 3 && (
            <span className="text-xs text-muted-foreground">+{zones.length - 3} weitere</span>
          )}
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-xs text-muted-foreground hover:text-foreground ml-2 shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
