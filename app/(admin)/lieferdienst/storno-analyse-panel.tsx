'use client';

import { useEffect, useState } from 'react';
import { XCircle, ChevronDown, ChevronUp, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StornoHourBucket {
  hour: number;
  stornoCount: number;
  totalCount: number;
  stornoRate: number;
}

interface StornoZoneBucket {
  zone: string;
  stornoCount: number;
  totalCount: number;
  stornoRate: number;
}

interface StornoAnalyseData {
  totalOrders: number;
  totalStornos: number;
  overallRate: number;
  peakStornoHour: number | null;
  worstZone: string | null;
  byHour: StornoHourBucket[];
  byZone: StornoZoneBucket[];
}

interface Props {
  locationId: string | null;
}

function rateColor(rate: number) {
  if (rate >= 15) return 'bg-red-500';
  if (rate >= 8) return 'bg-amber-400';
  if (rate >= 3) return 'bg-yellow-300';
  return 'bg-matcha-400';
}

function rateTextColor(rate: number) {
  if (rate >= 15) return 'text-red-600 font-black';
  if (rate >= 8) return 'text-amber-600 font-bold';
  if (rate >= 3) return 'text-yellow-600';
  return 'text-matcha-600';
}

export function LieferdienstStornoAnalysePanel({ locationId }: Props) {
  const [data, setData] = useState<StornoAnalyseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/storno-analyse?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="h-4 w-48 bg-stone-100 rounded animate-pulse mb-3" />
        <div className="h-24 bg-stone-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!data || data.totalOrders === 0) return null;

  // Top 5 hours by storno rate (min 3 orders)
  const topHours = [...data.byHour]
    .filter((h) => h.totalCount >= 3)
    .sort((a, b) => b.stornoRate - a.stornoRate)
    .slice(0, 5);

  // Top zones by storno rate (min 5 orders)
  const topZones = [...data.byZone]
    .filter((z) => z.totalCount >= 5)
    .slice(0, 5);

  const rateLabel = data.overallRate >= 10 ? 'Kritisch' : data.overallRate >= 5 ? 'Erhöht' : 'Normal';
  const rateBadge =
    data.overallRate >= 10
      ? 'bg-red-100 text-red-700'
      : data.overallRate >= 5
      ? 'bg-amber-100 text-amber-700'
      : 'bg-matcha-100 text-matcha-700';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-stone-100 hover:bg-stone-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600">
          <XCircle className="h-4 w-4" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-stone-900">Storno-Analyse · 30 Tage</div>
          <div className="text-xs text-stone-400">
            {data.totalStornos} Stornos von {data.totalOrders} Bestellungen
          </div>
        </div>
        <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5', rateBadge)}>
          {data.overallRate.toFixed(1)}% · {rateLabel}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-stone-400 shrink-0" />}
      </button>

      {/* KPI tiles */}
      <div className="grid grid-cols-3 divide-x border-b">
        <div className="p-4 text-center">
          <div className={cn('text-xl font-black tabular-nums', rateTextColor(data.overallRate))}>
            {data.overallRate.toFixed(1)}%
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">Gesamt-Rate</div>
        </div>
        <div className="p-4 text-center">
          <div className="text-xl font-black text-stone-800 tabular-nums">
            {data.peakStornoHour !== null ? `${String(data.peakStornoHour).padStart(2, '0')}:00` : '–'}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5 flex items-center justify-center gap-1">
            <Clock className="h-2.5 w-2.5" /> Peak-Stunde
          </div>
        </div>
        <div className="p-4 text-center">
          <div className="text-xl font-black text-stone-800 truncate">{data.worstZone ?? '–'}</div>
          <div className="text-[10px] text-stone-400 mt-0.5 flex items-center justify-center gap-1">
            <MapPin className="h-2.5 w-2.5" /> Schlechteste Zone
          </div>
        </div>
      </div>

      {/* Expandable detail */}
      {open && (
        <div className="p-5 space-y-5">
          {/* By hour */}
          {topHours.length > 0 && (
            <div>
              <div className="text-xs font-bold text-stone-600 mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Top Storno-Stunden
              </div>
              <div className="space-y-1.5">
                {topHours.map((h) => (
                  <div key={h.hour} className="flex items-center gap-2">
                    <span className="text-xs font-mono w-12 shrink-0 text-stone-500">
                      {String(h.hour).padStart(2, '0')}:00
                    </span>
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', rateColor(h.stornoRate))}
                        style={{ width: `${Math.min(100, h.stornoRate * 4)}%` }}
                      />
                    </div>
                    <span className={cn('text-xs w-16 text-right shrink-0', rateTextColor(h.stornoRate))}>
                      {h.stornoRate.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-stone-400 shrink-0">
                      ({h.stornoCount}/{h.totalCount})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By zone */}
          {topZones.length > 0 && (
            <div>
              <div className="text-xs font-bold text-stone-600 mb-2 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Storno-Rate je Zone
              </div>
              <div className="space-y-1.5">
                {topZones.map((z) => (
                  <div key={z.zone} className="flex items-center gap-2">
                    <span className="text-xs font-bold w-20 shrink-0 text-stone-700 truncate">
                      {z.zone}
                    </span>
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', rateColor(z.stornoRate))}
                        style={{ width: `${Math.min(100, z.stornoRate * 4)}%` }}
                      />
                    </div>
                    <span className={cn('text-xs w-16 text-right shrink-0', rateTextColor(z.stornoRate))}>
                      {z.stornoRate.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-stone-400 shrink-0">
                      ({z.stornoCount}/{z.totalCount})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
