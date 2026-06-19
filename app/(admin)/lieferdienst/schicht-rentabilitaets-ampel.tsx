'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Euro, Gauge } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface ShiftStats {
  revenue: number;
  orders: number;
  activeDrivers: number;
  avgDeliveryCostEur: number;
  estimatedCostEur: number;
}

const MOCK_DATA: ShiftStats = {
  revenue: 1240,
  orders: 28,
  activeDrivers: 4,
  avgDeliveryCostEur: 4.2,
  estimatedCostEur: 470,
};

const ESTIMATED_SHIFT_HOURS = 4;
const POLL_INTERVAL_MS = 60_000;

type TrafficLightStatus = 'green' | 'amber' | 'red';

interface DerivedMetrics {
  profit: number;
  margin: number;
  revenuePerDriverPerHour: number;
  status: TrafficLightStatus;
  statusLabel: string;
}

function deriveMetrics(stats: ShiftStats): DerivedMetrics {
  const profit = stats.revenue - stats.estimatedCostEur;
  const margin = stats.revenue > 0 ? (profit / stats.revenue) * 100 : 0;
  const revenuePerDriverPerHour =
    stats.activeDrivers > 0
      ? stats.revenue / stats.activeDrivers / ESTIMATED_SHIFT_HOURS
      : 0;

  let status: TrafficLightStatus;
  let statusLabel: string;

  if (margin >= 25) {
    status = 'green';
    statusLabel = 'Rentabel';
  } else if (margin >= 10) {
    status = 'amber';
    statusLabel = 'Kostendeckend';
  } else {
    status = 'red';
    statusLabel = 'Verlustbereich';
  }

  return { profit, margin, revenuePerDriverPerHour, status, statusLabel };
}

function formatEur(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.', ',')} %`;
}

const trafficLightColors: Record<TrafficLightStatus, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-400',
  red: 'bg-red-500',
};

const trafficLightRingColors: Record<TrafficLightStatus, string> = {
  green: 'ring-green-200',
  amber: 'ring-amber-200',
  red: 'ring-red-200',
};

const trafficLightTextColors: Record<TrafficLightStatus, string> = {
  green: 'text-green-700',
  amber: 'text-amber-700',
  red: 'text-red-600',
};

const trafficLightBgColors: Record<TrafficLightStatus, string> = {
  green: 'bg-green-50',
  amber: 'bg-amber-50',
  red: 'bg-red-50',
};

export function SchichtRentabilitaetsAmpel({ locationId }: Props) {
  const [stats, setStats] = useState<ShiftStats>(MOCK_DATA);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchStats() {
    if (locationId === null) {
      setStats(MOCK_DATA);
      setLoading(false);
      setLastUpdated(new Date());
      return;
    }

    try {
      const res = await fetch(
        `/api/delivery/stats?locationId=${encodeURIComponent(locationId)}&period=shift`
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: ShiftStats = await res.json() as ShiftStats;
      setStats(data);
      setLastUpdated(new Date());
    } catch {
      // Fall back to mock data on any error
      setStats(MOCK_DATA);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchStats();
    const interval = setInterval(() => {
      void fetchStats();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const metrics = deriveMetrics(stats);
  const { status, statusLabel, profit, margin, revenuePerDriverPerHour } =
    metrics;

  const isProfit = profit >= 0;

  return (
    <div className="w-full rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Gauge className="w-5 h-5 text-matcha-600" />
          <h2 className="text-base font-semibold text-gray-800">
            Schicht-Rentabilität
          </h2>
        </div>
        {lastUpdated !== null && (
          <span className="text-xs text-gray-400">
            {lastUpdated.toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            Uhr
          </span>
        )}
      </div>

      {/* Traffic light + status */}
      <div
        className={`flex flex-col items-center gap-3 px-5 py-6 ${trafficLightBgColors[status]}`}
      >
        {loading ? (
          <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse" />
        ) : (
          <div
            className={`
              w-16 h-16 rounded-full ring-4
              ${trafficLightColors[status]}
              ${trafficLightRingColors[status]}
              shadow-lg
            `}
          />
        )}
        <div className="text-center">
          <p
            className={`text-xl font-bold ${trafficLightTextColors[status]}`}
          >
            {statusLabel}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            Marge: {formatPercent(margin)}
          </p>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-px bg-gray-100 border-t border-gray-100">
        {/* Umsatz */}
        <div className="bg-white px-4 py-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Euro className="w-4 h-4 text-matcha-500" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Umsatz
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900 tabular-nums">
            {formatEur(stats.revenue)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {stats.orders} Bestellungen
          </p>
        </div>

        {/* Geschätzte Kosten */}
        <div className="bg-white px-4 py-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Kosten (ca.)
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900 tabular-nums">
            {formatEur(stats.estimatedCostEur)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Ø {formatEur(stats.avgDeliveryCostEur)}/Lieferung
          </p>
        </div>

        {/* Gewinn */}
        <div className="bg-white px-4 py-4">
          <div className="flex items-center gap-1.5 mb-1">
            {isProfit ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Gewinn
            </span>
          </div>
          <p
            className={`text-xl font-bold tabular-nums ${
              isProfit ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isProfit ? '+' : ''}
            {formatEur(profit)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Marge {formatPercent(margin)}
          </p>
        </div>

        {/* Umsatz/Fahrer/Std */}
        <div className="bg-white px-4 py-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Euro className="w-4 h-4 text-matcha-500" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Umsatz/Fahrer/Std
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900 tabular-nums">
            {formatEur(revenuePerDriverPerHour)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {stats.activeDrivers} aktive Fahrer · {ESTIMATED_SHIFT_HOURS}h
          </p>
        </div>
      </div>

      {/* Footer */}
      {locationId === null && (
        <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
          <p className="text-xs text-amber-700 text-center">
            Kein Standort ausgewählt — Beispieldaten werden angezeigt
          </p>
        </div>
      )}
    </div>
  );
}
