'use client';

/**
 * LieferZonenProfitMatrix — Zonen-Rentabilitäts-Übersicht.
 *
 * Zeigt je Lieferzone (A, B, C, D):
 *   Umsatz · Anzahl Bestellungen · Ø Lieferzeit · Ø Bestellwert · Trend-Chip
 *
 * Datenbasis: /api/delivery/admin/analytics?action=zones (falls vorhanden)
 * Fallback: aggregiert aus den heutigen Bestell-Daten.
 * Polling alle 5 Minuten.
 */

import { useEffect, useState } from 'react';
import { MapPin, TrendingUp, TrendingDown, Minus, Euro, Clock, Loader2, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ZoneData = {
  zone: string;
  orders: number;
  revenueEur: number;
  avgDeliveryMin: number | null;
  avgOrderValueEur: number | null;
  onTimePct: number | null;
};

const ZONE_COLORS: Record<string, { bg: string; border: string; badge: string; text: string }> = {
  A: { bg: 'bg-matcha-50', border: 'border-matcha-200', badge: 'bg-matcha-500 text-white', text: 'text-matcha-700' },
  B: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-500 text-white', text: 'text-blue-700' },
  C: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-500 text-white', text: 'text-amber-700' },
  D: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-500 text-white', text: 'text-red-700' },
};

const DEFAULT_COLORS = { bg: 'bg-muted/30', border: 'border-border', badge: 'bg-foreground text-background', text: 'text-foreground' };

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function LieferZonenProfitMatrix({ locationId }: { locationId: string | null }) {
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) return;

    const load = async () => {
      setLoading(true);
      try {
        // Versuche Zone-Analytics-Endpoint
        const res = await fetch(
          `/api/delivery/admin/analytics?action=zones&location_id=${encodeURIComponent(locationId)}`,
        );
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json?.zones) && json.zones.length > 0) {
            setZones(json.zones);
            setLastUpdated(new Date());
            return;
          }
        }

        // Fallback: Dashboard-Daten aggregieren
        const dashRes = await fetch(
          `/api/delivery/admin/analytics?action=dashboard&location_id=${encodeURIComponent(locationId)}`,
        );
        if (!dashRes.ok) return;
        const dash = await dashRes.json();

        // Zone-Aggregation aus today.byZone falls vorhanden
        const byZone: Record<string, ZoneData> = {};
        const rawZones = dash?.today?.byZone as Record<string, {
          orders?: number; revenue?: number; avgDeliveryMin?: number; onTimePct?: number;
        }> | undefined;

        if (rawZones) {
          for (const [z, v] of Object.entries(rawZones)) {
            byZone[z] = {
              zone: z,
              orders: v.orders ?? 0,
              revenueEur: v.revenue ?? 0,
              avgDeliveryMin: v.avgDeliveryMin ?? null,
              avgOrderValueEur: v.orders && v.revenue ? v.revenue / v.orders : null,
              onTimePct: v.onTimePct ?? null,
            };
          }
          if (Object.keys(byZone).length > 0) {
            setZones(Object.values(byZone).sort((a, b) => a.zone.localeCompare(b.zone)));
            setLastUpdated(new Date());
          }
        }
      } catch {
        // Stille Fehlerbehandlung
      } finally {
        setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!locationId) return null;
  if (!loading && zones.length === 0) return null;

  const totalRevenue = zones.reduce((s, z) => s + z.revenueEur, 0);
  const totalOrders = zones.reduce((s, z) => s + z.orders, 0);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-foreground">Zonen-Rentabilität</div>
          <div className="text-[10px] text-stone-400">
            Heute · {totalOrders} Bestellungen gesamt
          </div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {lastUpdated && !loading && (
          <span className="text-[9px] text-muted-foreground tabular-nums">
            {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Zone-Kacheln */}
      {loading && zones.length === 0 ? (
        <div className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lade Zonen-Daten…
        </div>
      ) : (
        <div className="divide-y divide-stone-100">
          {zones.map((z) => {
            const colors = ZONE_COLORS[z.zone] ?? DEFAULT_COLORS;
            const revShare = totalRevenue > 0 ? (z.revenueEur / totalRevenue) * 100 : 0;

            return (
              <div key={z.zone} className={cn('px-5 py-3.5 flex items-center gap-4', colors.bg)}>
                {/* Zone Badge */}
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black', colors.badge)}>
                  {z.zone}
                </div>

                {/* KPIs */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Umsatz */}
                    <div className="flex items-center gap-0.5">
                      <Euro className="h-3 w-3 text-muted-foreground" />
                      <span className={cn('text-sm font-black tabular-nums', colors.text)}>
                        {fmtEur(z.revenueEur)}
                      </span>
                    </div>
                    {/* Bestellungen */}
                    <span className="text-xs text-muted-foreground">
                      {z.orders} Best.
                    </span>
                    {/* Ø Lieferzeit */}
                    {z.avgDeliveryMin != null && (
                      <div className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className={cn(
                          'text-xs font-bold tabular-nums',
                          z.avgDeliveryMin <= 30 ? 'text-matcha-600' :
                          z.avgDeliveryMin <= 45 ? 'text-amber-600' : 'text-red-600',
                        )}>
                          {Math.round(z.avgDeliveryMin)} Min
                        </span>
                      </div>
                    )}
                    {/* Ø Bestellwert */}
                    {z.avgOrderValueEur != null && (
                      <span className="text-[10px] text-muted-foreground">
                        Ø {fmtEur(z.avgOrderValueEur)}
                      </span>
                    )}
                    {/* SLA */}
                    {z.onTimePct != null && (
                      <div className="flex items-center gap-0.5">
                        {z.onTimePct >= 85 ? (
                          <TrendingUp className="h-3 w-3 text-matcha-600" />
                        ) : z.onTimePct >= 70 ? (
                          <Minus className="h-3 w-3 text-amber-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <span className={cn(
                          'text-[10px] font-bold',
                          z.onTimePct >= 85 ? 'text-matcha-700' :
                          z.onTimePct >= 70 ? 'text-amber-600' : 'text-red-600',
                        )}>
                          {Math.round(z.onTimePct)}% SLA
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Umsatz-Anteil Bar */}
                  <div className="mt-1.5 h-1.5 rounded-full bg-black/5 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700',
                        z.zone === 'A' ? 'bg-matcha-400' :
                        z.zone === 'B' ? 'bg-blue-400' :
                        z.zone === 'C' ? 'bg-amber-400' : 'bg-red-400',
                      )}
                      style={{ width: `${Math.round(revShare)}%` }}
                    />
                  </div>
                  <div className="mt-0.5 text-[9px] text-muted-foreground">
                    {Math.round(revShare)}% des Tagesumsatzes
                  </div>
                </div>

                {/* Geo-Icon */}
                <MapPin className={cn('h-4 w-4 shrink-0', colors.text)} />
              </div>
            );
          })}
        </div>
      )}

      {/* Footer: Gesamt */}
      {zones.length > 0 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-stone-100 bg-stone-50">
          <span className="text-xs font-bold text-muted-foreground">Gesamt heute</span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">{totalOrders} Bestellungen</span>
            <span className="text-sm font-black tabular-nums text-foreground">{fmtEur(totalRevenue)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
