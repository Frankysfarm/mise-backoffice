'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

interface HeatmapTile {
  gridLat: number;
  gridLng: number;
  stopCount: number;
  avgDeliveryMin: number | null;
  zoneLabel: string | null;
}

export function HeatmapTipp({ locationId: _locationId }: { locationId: string }) {
  const [topTile, setTopTile] = useState<HeatmapTile | null>(null);

  useEffect(() => {
    fetch('/api/delivery/admin/tour-heatmap?action=tiles&days=7')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: HeatmapTile[]) => {
        const sorted = [...data].sort((a, b) => b.stopCount - a.stopCount);
        setTopTile(sorted[0] ?? null);
      })
      .catch(() => {});
  }, []);

  if (!topTile) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3">
      <div className="p-2 bg-indigo-100 rounded-lg">
        <MapPin className="h-4 w-4 text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-indigo-900">Hot-Zone der Woche</p>
        <p className="text-xs text-indigo-700 mt-0.5">
          {topTile.zoneLabel ? `Zone ${topTile.zoneLabel}` : 'Meist-angefahrene Zone'} ·{' '}
          {topTile.stopCount} Stops · Ø {topTile.avgDeliveryMin != null ? `${topTile.avgDeliveryMin} Min.` : '–'}
        </p>
      </div>
      <a
        href={`https://www.google.com/maps/@${topTile.gridLat},${topTile.gridLng},14z`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-indigo-600 hover:underline font-medium shrink-0"
      >
        Maps →
      </a>
    </div>
  );
}
