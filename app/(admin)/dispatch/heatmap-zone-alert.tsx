'use client';

import { useEffect, useState } from 'react';
import { Map, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface UnderservedZone {
  id: string;
  gridLat: number;
  gridLng: number;
  zoneLabel: string | null;
  avgDeliveryMin: number | null;
  stopCount: number;
  lateRate: number | null;
  severity: 'low' | 'medium' | 'high';
}

export function HeatmapZoneAlert({ locationId: _locationId }: { locationId: string }) {
  const [zones, setZones] = useState<UnderservedZone[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/delivery/admin/tour-heatmap?action=underserved')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: UnderservedZone[]) => {
        const high = data.filter((z) => z.severity === 'high' || z.severity === 'medium');
        setZones(high);
      })
      .catch(() => {});
  }, []);

  if (zones.length === 0) return null;

  const highCount = zones.filter((z) => z.severity === 'high').length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 text-left"
      >
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-800">
            Unterversorgte Zonen: {zones.length}
          </span>
          {highCount > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {highCount} kritisch
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-indigo-500" /> : <ChevronDown className="h-4 w-4 text-indigo-500" />}
      </button>
      {expanded && (
        <div className="divide-y">
          {zones.map((zone) => (
            <div key={zone.id} className="px-4 py-3 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${zone.severity === 'high' ? 'bg-red-500' : 'bg-amber-400'}`} />
                <div>
                  <span className="text-sm font-medium">
                    {zone.zoneLabel ? `Zone ${zone.zoneLabel}` : 'Unbekannte Zone'}
                    <span className="text-xs text-muted-foreground ml-2 font-mono">
                      {zone.gridLat.toFixed(3)}°, {zone.gridLng.toFixed(3)}°
                    </span>
                  </span>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{zone.stopCount} Stops</span>
                    {zone.lateRate != null && (
                      <span className={zone.lateRate >= 60 ? 'text-red-600 font-medium' : 'text-amber-600'}>
                        {zone.lateRate}% verspätet
                      </span>
                    )}
                    {zone.avgDeliveryMin != null && <span>Ø {zone.avgDeliveryMin} Min.</span>}
                  </div>
                </div>
              </div>
              <a
                href={`https://www.google.com/maps/@${zone.gridLat},${zone.gridLng},14z`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-500 hover:text-indigo-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
          <div className="px-4 py-2 bg-muted/30">
            <a href="/delivery/tour-heatmap" className="text-xs text-indigo-600 hover:underline">
              Vollständige Heatmap-Analyse öffnen →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
