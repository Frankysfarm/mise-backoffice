'use client';

/**
 * DispatchZonenScoreRing — Phase 300
 *
 * Zeigt Lieferperformance pro Zone als SVG-Score-Ringe:
 * - Durchschnittliche Lieferzeit vs. SLA-Ziel
 * - Pünktlichkeitsquote
 * - Aktive Touren in dieser Zone
 *
 * Farbkodierung: Grün (<90% SLA-Zeit), Amber (90–110%), Rot (>110%)
 */

import { useEffect, useState } from 'react';
import { MapPin, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoneData {
  zone: string;
  activeTours: number;
  avgDeliveryMin: number;
  slaTarget: number; // Ziel-Lieferzeit in Min
  onTimePct: number; // 0–100
  pendingOrders: number;
}

interface Props {
  batches?: {
    id: string;
    status: string;
    zone?: string | null;
    started_at: string | null;
    total_eta_min: number | null;
    stops?: { geliefert_am: string | null; angekommen_am: string | null }[];
  }[];
  readyOrders?: {
    delivery_zone?: string | null;
    fertig_am: string | null;
    status: string;
  }[];
}

const ZONE_LABELS: Record<string, string> = {
  nord: 'Nord', sued: 'Süd', ost: 'Ost', west: 'West',
  mitte: 'Mitte', stadtrand: 'Stadtrand', zentrum: 'Zentrum', innenstadt: 'Innenstadt',
};

function zoneLabel(z: string): string {
  return ZONE_LABELS[z.toLowerCase()] ?? z;
}

function scoreMeta(pct: number): { color: string; trackColor: string; label: string } {
  if (pct >= 85) return { color: '#22c55e', trackColor: '#dcfce7', label: 'Sehr gut' };
  if (pct >= 70) return { color: '#f59e0b', trackColor: '#fef3c7', label: 'OK' };
  return { color: '#ef4444', trackColor: '#fee2e2', label: 'Kritisch' };
}

function ScoreRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const meta = scoreMeta(pct);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={meta.trackColor} strokeWidth={7} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={meta.color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize="11" fontWeight="700" fill={meta.color}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

function computeZones(batches: Props['batches'] = [], readyOrders: Props['readyOrders'] = []): ZoneData[] {
  const zoneMap = new Map<string, {
    totalDeliveryMin: number; count: number; onTime: number; activeTours: number; pending: number;
  }>();

  for (const b of batches) {
    const z = b.zone || 'unbekannt';
    if (!zoneMap.has(z)) zoneMap.set(z, { totalDeliveryMin: 0, count: 0, onTime: 0, activeTours: 0, pending: 0 });
    const entry = zoneMap.get(z)!;
    if (b.status === 'unterwegs' || b.status === 'on_route') {
      entry.activeTours++;
    }
    if (b.started_at && b.total_eta_min) {
      const elapsedMin = (Date.now() - new Date(b.started_at).getTime()) / 60_000;
      entry.totalDeliveryMin += elapsedMin;
      entry.count++;
      if (elapsedMin <= b.total_eta_min) entry.onTime++;
    }
  }

  for (const o of readyOrders) {
    const z = o.delivery_zone || 'unbekannt';
    if (!zoneMap.has(z)) zoneMap.set(z, { totalDeliveryMin: 0, count: 0, onTime: 0, activeTours: 0, pending: 0 });
    if (o.status === 'fertig' || o.status === 'bestätigt' || o.status === 'in_zubereitung') {
      zoneMap.get(z)!.pending++;
    }
  }

  const SLA_DEFAULT = 35;
  return Array.from(zoneMap.entries())
    .map(([zone, d]) => ({
      zone,
      activeTours: d.activeTours,
      avgDeliveryMin: d.count > 0 ? d.totalDeliveryMin / d.count : 0,
      slaTarget: SLA_DEFAULT,
      onTimePct: d.count > 0 ? (d.onTime / d.count) * 100 : 100,
      pendingOrders: d.pending,
    }))
    .filter(z => z.activeTours > 0 || z.pendingOrders > 0)
    .sort((a, b) => a.onTimePct - b.onTimePct);
}

export function DispatchZonenScoreRing({ batches = [], readyOrders = [] }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const zones = computeZones(batches, readyOrders);
  if (zones.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin size={14} className="text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Zonen-Performance
        </span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {zones.length} Zonen
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {zones.map(z => {
          const meta = scoreMeta(z.onTimePct);
          const TrendIcon = z.onTimePct >= 80 ? TrendingUp : z.onTimePct >= 60 ? Minus : TrendingDown;
          return (
            <div
              key={z.zone}
              className="flex flex-col items-center gap-1 rounded-lg border p-3 bg-muted/30"
              style={{ borderColor: meta.color + '40' }}
            >
              <ScoreRing pct={z.onTimePct} />
              <div className="text-xs font-bold truncate max-w-full">{zoneLabel(z.zone)}</div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <TrendIcon size={10} style={{ color: meta.color }} />
                <span style={{ color: meta.color }}>{meta.label}</span>
              </div>
              <div className="flex gap-2 text-[10px] text-muted-foreground">
                {z.activeTours > 0 && <span>🛵 {z.activeTours}</span>}
                {z.pendingOrders > 0 && <span>📦 {z.pendingOrders}</span>}
                {z.avgDeliveryMin > 0 && <span>⏱ ∅{Math.round(z.avgDeliveryMin)}m</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
