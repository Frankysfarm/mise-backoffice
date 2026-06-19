'use client';

import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';

// ─── Typen ────────────────────────────────────────────────────────────────────

interface ReadyOrder {
  id: string;
  bestellnummer: string;
  delivery_zone: string | null;
  fertig_am: string | null;
  status: string;
}

interface BatchStop {
  geliefert_am: string | null;
  angekommen_am?: string | null;
}

interface Batch {
  id: string;
  status: string;
  zone: string | null;
  total_eta_min: number | null;
  total_distance_km: number | null;
  stops?: BatchStop[];
}

interface Props {
  orders: ReadyOrder[];
  batches: Batch[];
}

// ─── Konstanten ───────────────────────────────────────────────────────────────

const ACTIVE_BATCH_STATUSES = new Set([
  'unterwegs',
  'on_route',
  'aktiv',
  'assigned',
  'in_delivery',
]);

interface MockZone {
  zone: string;
  activeDeliveries: number;
  avgEtaMin: number;
  avgDistanceKm: number;
}

const MOCK_ZONES: MockZone[] = [
  { zone: 'Nord',  activeDeliveries: 3, avgEtaMin: 18, avgDistanceKm: 2.1 },
  { zone: 'Süd',   activeDeliveries: 5, avgEtaMin: 28, avgDistanceKm: 3.4 },
  { zone: 'Mitte', activeDeliveries: 7, avgEtaMin: 12, avgDistanceKm: 1.3 },
  { zone: 'Ost',   activeDeliveries: 2, avgEtaMin: 38, avgDistanceKm: 4.7 },
];

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

type EtaGrade = 'fast' | 'moderate' | 'slow';

function etaGrade(avgEtaMin: number): EtaGrade {
  if (avgEtaMin <= 20) return 'fast';
  if (avgEtaMin <= 35) return 'moderate';
  return 'slow';
}

const ETA_GRADE_CONFIG: Record<
  EtaGrade,
  { cardBg: string; cardBorder: string; etaText: string; badgeBg: string; badgeText: string }
> = {
  fast: {
    cardBg: 'bg-matcha-50',
    cardBorder: 'border-matcha-200',
    etaText: 'text-matcha-700',
    badgeBg: 'bg-matcha-100',
    badgeText: 'text-matcha-700',
  },
  moderate: {
    cardBg: 'bg-amber-50',
    cardBorder: 'border-amber-200',
    etaText: 'text-amber-700',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
  slow: {
    cardBg: 'bg-red-50',
    cardBorder: 'border-red-200',
    etaText: 'text-red-700',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
  },
};

// ─── Datenaggregation ─────────────────────────────────────────────────────────

interface ZoneSummary {
  zone: string;
  activeDeliveries: number;
  avgEtaMin: number;
  avgDistanceKm: number;
}

function aggregateZones(batches: Batch[]): ZoneSummary[] {
  const activeBatches = batches.filter((b) => ACTIVE_BATCH_STATUSES.has(b.status));

  if (activeBatches.length === 0) return [];

  const zoneMap = new Map<
    string,
    { count: number; totalEta: number; etaCount: number; totalDist: number; distCount: number }
  >();

  for (const batch of activeBatches) {
    const zoneName = batch.zone ?? 'Unbekannt';
    const existing = zoneMap.get(zoneName) ?? {
      count: 0,
      totalEta: 0,
      etaCount: 0,
      totalDist: 0,
      distCount: 0,
    };

    existing.count += 1;

    if (batch.total_eta_min != null) {
      existing.totalEta += batch.total_eta_min;
      existing.etaCount += 1;
    }
    if (batch.total_distance_km != null) {
      existing.totalDist += batch.total_distance_km;
      existing.distCount += 1;
    }

    zoneMap.set(zoneName, existing);
  }

  const summaries: ZoneSummary[] = [];
  for (const [zone, agg] of zoneMap) {
    summaries.push({
      zone,
      activeDeliveries: agg.count,
      avgEtaMin: agg.etaCount > 0 ? Math.round(agg.totalEta / agg.etaCount) : 25,
      avgDistanceKm:
        agg.distCount > 0
          ? Math.round((agg.totalDist / agg.distCount) * 10) / 10
          : 0,
    });
  }

  return summaries.sort((a, b) => b.activeDeliveries - a.activeDeliveries);
}

// ─── Zonen-Karte ──────────────────────────────────────────────────────────────

function ZoneCard({ summary }: { summary: ZoneSummary }) {
  const grade = etaGrade(summary.avgEtaMin);
  const cfg = ETA_GRADE_CONFIG[grade];

  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2 transition-colors duration-300',
        cfg.cardBg,
        cfg.cardBorder,
      )}
    >
      {/* Zone name + active badge */}
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0">
          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="text-xs font-black text-foreground truncate">{summary.zone}</span>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums',
            cfg.badgeBg,
            cfg.badgeText,
          )}
        >
          {summary.activeDeliveries}&nbsp;aktiv
        </span>
      </div>

      {/* ETA */}
      <div className="flex items-baseline gap-1">
        <span className={cn('text-xl font-black tabular-nums leading-none', cfg.etaText)}>
          {summary.avgEtaMin}
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground">Min&nbsp;ETA</span>
      </div>

      {/* Distance */}
      {summary.avgDistanceKm > 0 && (
        <div className="text-[10px] text-muted-foreground tabular-nums">
          Ø&nbsp;{summary.avgDistanceKm.toFixed(1)}&nbsp;km
        </div>
      )}
    </div>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export function DispatchZoneEffizienzMatrix({ orders: _orders, batches }: Props) {
  const liveZones = aggregateZones(batches);
  const useMock = liveZones.length === 0;
  const zones: ZoneSummary[] = useMock ? MOCK_ZONES : liveZones;

  const totalActive = zones.reduce((s, z) => s + z.activeDeliveries, 0);
  const avgEta =
    zones.length > 0
      ? Math.round(zones.reduce((s, z) => s + z.avgEtaMin, 0) / zones.length)
      : 0;
  const overallGrade = etaGrade(avgEta);
  const overallCfg = ETA_GRADE_CONFIG[overallGrade];

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <MapPin className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-foreground/80">
          Zonen-Effizienz-Matrix
        </span>

        {/* Summary chips */}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground tabular-nums">
            {totalActive}&nbsp;aktiv
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums',
              overallCfg.badgeBg,
              overallCfg.badgeText,
            )}
          >
            Ø&nbsp;{avgEta}&nbsp;Min
          </span>
        </div>
      </div>

      {/* ── Zone Grid ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {zones.map((z) => (
          <ZoneCard key={z.zone} summary={z} />
        ))}
      </div>

      {/* ── Legende + mock hint ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">ETA:</span>
        <span className="flex items-center gap-1 text-[9px] text-matcha-600">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-matcha-400" />
          ≤ 20 Min
        </span>
        <span className="flex items-center gap-1 text-[9px] text-amber-600">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
          21–35 Min
        </span>
        <span className="flex items-center gap-1 text-[9px] text-red-600">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
          &gt; 35 Min
        </span>
        {useMock && (
          <span className="ml-auto text-[9px] text-muted-foreground">
            Demo-Daten
          </span>
        )}
      </div>
    </div>
  );
}
