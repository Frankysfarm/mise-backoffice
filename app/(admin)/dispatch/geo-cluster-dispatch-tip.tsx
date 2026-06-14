'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, TrendingUp, Loader2, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

type Hotspot = {
  cluster_idx: number;
  center_lat: number;
  center_lng: number;
  order_count: number;
  label: string | null;
  demand_score: number;
};

/* ──────────────────────────────────────────────────────────────
   GeoClusterDispatchTip
   Zeigt die Top-Demand-Cluster aus Phase 173 (K-Means Geo-
   Clustering) als Dispatch-Zonen-Empfehlung. Hilft dem
   Dispatcher zu entscheiden, in welche Zone der nächste
   freie Fahrer geschickt werden sollte.
   Nutzt GET /api/delivery/admin/geo-clustering?action=hotspots
   ────────────────────────────────────────────────────────────── */
export function GeoClusterDispatchTip({
  locationId,
  freeDriverCount = 0,
}: {
  locationId: string | null;
  freeDriverCount?: number;
}) {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    const url = `/api/delivery/admin/geo-clustering?action=hotspots&limit=3&location_id=${encodeURIComponent(locationId)}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.hotspots) setHotspots(d.hotspots);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    if (!locationId) return;
    const iv = setInterval(() => {
      const url = `/api/delivery/admin/geo-clustering?action=hotspots&limit=3&location_id=${encodeURIComponent(locationId)}`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.hotspots) setHotspots(d.hotspots); })
        .catch(() => {});
    }, 5 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading && hotspots.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        Lade Nachfrage-Cluster…
      </div>
    );
  }

  if (hotspots.length === 0) return null;

  const top = hotspots[0];
  const topLabel = top.label ?? `Cluster ${top.cluster_idx + 1}`;

  const demandColor = (score: number) =>
    score >= 80 ? 'text-red-700'
    : score >= 60 ? 'text-orange-600'
    : score >= 40 ? 'text-amber-600'
    : 'text-matcha-700';

  const demandBg = (score: number) =>
    score >= 80 ? 'bg-red-50 border-red-200'
    : score >= 60 ? 'bg-orange-50 border-orange-200'
    : score >= 40 ? 'bg-amber-50 border-amber-200'
    : 'bg-matcha-50 border-matcha-200';

  const demandLabel = (score: number) =>
    score >= 80 ? 'Sehr hohe Nachfrage'
    : score >= 60 ? 'Hohe Nachfrage'
    : score >= 40 ? 'Mittlere Nachfrage'
    : 'Geringe Nachfrage';

  const mapsUrl = (lat: number, lng: number) =>
    `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return (
    <div className={cn('rounded-xl border overflow-hidden', demandBg(top.demand_score))}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-current/10">
        <MapPin className={cn('h-4 w-4 shrink-0', demandColor(top.demand_score))} />
        <span className={cn('text-xs font-bold uppercase tracking-wider', demandColor(top.demand_score))}>
          Nachfrage-Hotspots (Geo-Clustering)
        </span>
        {freeDriverCount > 0 && (
          <span className="ml-auto rounded-full bg-white/70 border border-current/20 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {freeDriverCount} freier Fahrer
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Top-Hotspot Empfehlung */}
        <div className="flex items-start gap-3">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-lg',
            top.demand_score >= 80 ? 'bg-red-500/20 text-red-700' :
            top.demand_score >= 60 ? 'bg-orange-500/20 text-orange-700' :
            top.demand_score >= 40 ? 'bg-amber-500/20 text-amber-700' :
            'bg-matcha-500/20 text-matcha-700',
          )}>
            {Math.round(top.demand_score)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-foreground truncate">{topLabel}</span>
              <span className={cn('text-[10px] font-bold uppercase rounded-full px-1.5 py-0.5 bg-white/70', demandColor(top.demand_score))}>
                {demandLabel(top.demand_score)}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {top.order_count} Bestellungen in diesem Cluster · Score {Math.round(top.demand_score)}/100
            </div>
            {freeDriverCount > 0 && (
              <div className="mt-1 text-[11px] font-semibold text-foreground">
                → Freien Fahrer in Zone <strong>{topLabel}</strong> einsetzen
              </div>
            )}
          </div>
          <a
            href={mapsUrl(top.center_lat, top.center_lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 rounded-lg bg-white/70 border border-current/20 px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-white transition"
          >
            <Navigation className="h-3 w-3" />
            Maps
          </a>
        </div>

        {/* Weitere Hotspots kompakt */}
        {hotspots.length > 1 && (
          <div className="grid grid-cols-2 gap-2">
            {hotspots.slice(1).map((h) => {
              const label = h.label ?? `Cluster ${h.cluster_idx + 1}`;
              return (
                <a
                  key={h.cluster_idx}
                  href={mapsUrl(h.center_lat, h.center_lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-white/60 border border-white/50 px-3 py-2 hover:bg-white/80 transition"
                >
                  <TrendingUp className={cn('h-3 w-3 shrink-0', demandColor(h.demand_score))} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold truncate">{label}</div>
                    <div className={cn('text-[9px] font-bold tabular-nums', demandColor(h.demand_score))}>
                      Score {Math.round(h.demand_score)}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
