'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Route, Zap } from 'lucide-react';

interface TourRow {
  id: string;
  zone: string | null;
  driverName: string | null;
  state: string;
  stopCount: number;
  pendingStops: number;
  createdMinAgo: number;
}

interface ApiData {
  ok: boolean;
  alertLevel: 'ok' | 'warning' | 'critical';
  activeTours: number;
  tourThreshold: number;
  tourPct: number;
  avgStopsPerTour: number;
  stopsThreshold: number;
  totalPendingStops: number;
  warnings: string[];
  tours: TourRow[];
}

interface Props {
  locationId: string | null;
}

const LEVEL_STYLE = {
  ok: {
    banner: 'bg-matcha-50 border-matcha-300 text-matcha-800',
    badge: 'bg-matcha-500 text-white',
    bar: 'bg-matcha-500',
    icon: 'text-matcha-600',
    label: 'OK',
  },
  warning: {
    banner: 'bg-amber-50 border-amber-300 text-amber-800',
    badge: 'bg-amber-500 text-white',
    bar: 'bg-amber-500',
    icon: 'text-amber-600',
    label: 'Warnung',
  },
  critical: {
    banner: 'bg-red-50 border-red-300 text-red-800',
    badge: 'bg-red-600 text-white',
    bar: 'bg-red-600',
    icon: 'text-red-600',
    label: 'Kritisch',
  },
};

export function DispatchTourKapazitaetsWarnung({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  function load() {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/tour-capacity-warning?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.ok) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data || data.alertLevel === 'ok') return null;

  const s = LEVEL_STYLE[data.alertLevel];

  return (
    <Card className={cn('border rounded-xl overflow-hidden', s.banner.split(' ')[1])}>
      {/* Banner */}
      <div className={cn('flex items-center gap-3 px-4 py-3 border-b', s.banner)}>
        <AlertTriangle className={cn('h-4 w-4 shrink-0', s.icon)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">Tour-Kapazitätswarnung</span>
            <Badge className={cn('text-[9px] font-black px-1.5 py-0.5', s.badge)}>
              {s.label}
            </Badge>
            <span className="text-xs font-medium">
              {data.activeTours}/{data.tourThreshold} Touren
              {' · '}
              Ø {data.avgStopsPerTour} Stopps/Tour
            </span>
          </div>
          {data.warnings.length > 0 && (
            <p className="text-[11px] mt-0.5 opacity-80 line-clamp-1">
              {data.warnings[0]}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={load}
            disabled={loading}
            className="opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Aktualisieren"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => setExpanded((p) => !p)}
            className="opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Details"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Kapazitäts-Balken */}
      <div className="px-4 py-2 bg-white/60 flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', s.bar)}
            style={{ width: `${Math.min(100, data.tourPct)}%` }}
          />
        </div>
        <span className={cn('text-xs font-black tabular-nums shrink-0', s.icon)}>
          {data.tourPct}%
        </span>
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-3 divide-x bg-white/40">
        {[
          { label: 'Aktive Touren', value: `${data.activeTours}/${data.tourThreshold}` },
          { label: 'Ø Stopps/Tour', value: `${data.avgStopsPerTour}/${data.stopsThreshold}` },
          { label: 'Offene Stopps', value: String(data.totalPendingStops) },
        ].map((kpi) => (
          <div key={kpi.label} className="py-2 px-3 text-center">
            <div className="font-black text-sm tabular-nums">{kpi.value}</div>
            <div className="text-[9px] text-muted-foreground font-medium mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Erweiterter Tour-Detail */}
      {expanded && data.tours.length > 0 && (
        <div className="border-t">
          <div className="px-4 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-wide bg-muted/20">
            Aktive Touren ({data.tours.length})
          </div>
          <div className="divide-y">
            {data.tours.map((tour) => {
              const overload = tour.pendingStops > data.stopsThreshold;
              return (
                <div
                  key={tour.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5',
                    overload ? 'bg-red-50/60' : 'bg-white/30',
                  )}
                >
                  <Route className={cn('h-3.5 w-3.5 shrink-0', overload ? 'text-red-500' : 'text-muted-foreground')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold truncate">
                        {tour.driverName ?? 'Unbekannt'}
                      </span>
                      {tour.zone && (
                        <span className="text-[9px] bg-white/70 border rounded-full px-1.5 py-0.5 font-bold">
                          Zone {tour.zone}
                        </span>
                      )}
                      {overload && (
                        <span className="text-[9px] bg-red-100 text-red-700 border border-red-200 rounded-full px-1.5 py-0.5 font-bold flex items-center gap-0.5">
                          <Zap className="h-2.5 w-2.5" />
                          Überlastet
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {tour.pendingStops} offene · {tour.stopCount} gesamt · vor {tour.createdMinAgo} Min gestartet
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn(
                      'font-black text-sm tabular-nums',
                      overload ? 'text-red-600' : 'text-foreground',
                    )}>
                      {tour.pendingStops}
                    </div>
                    <div className="text-[9px] text-muted-foreground">Stopps</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Extra Warnings */}
      {expanded && data.warnings.length > 1 && (
        <div className="border-t px-4 py-2 bg-muted/10">
          {data.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 py-0.5">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
              <span className="text-[11px] text-muted-foreground">{w}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
