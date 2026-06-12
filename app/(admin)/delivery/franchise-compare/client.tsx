'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { FranchiseCompareResponse, LocationCompareRow } from '@/app/api/delivery/admin/franchise-compare/route';

const REFRESH_INTERVAL = 30;

function healthColor(health: string) {
  if (health === 'critical') return 'text-red-500';
  if (health === 'warning') return 'text-amber-400';
  return 'text-emerald-400';
}
function healthBg(health: string) {
  if (health === 'critical') return 'bg-red-500/10 border-red-500/20';
  if (health === 'warning') return 'bg-amber-400/10 border-amber-400/20';
  return 'bg-emerald-500/5 border-white/5';
}
function onTimeColor(rate: number | null) {
  if (rate === null) return 'text-gray-400';
  if (rate >= 90) return 'text-emerald-400';
  if (rate >= 75) return 'text-amber-400';
  return 'text-red-400';
}
function ratingColor(r: number | null) {
  if (r === null) return 'text-gray-400';
  if (r >= 4.5) return 'text-emerald-400';
  if (r >= 3.5) return 'text-amber-400';
  return 'text-red-400';
}
function rankBadge(rank: number) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-sm font-bold text-gray-500">#{rank}</span>;
}
function fmt(v: number | null, unit: string) {
  if (v === null) return <span className="text-gray-500">—</span>;
  return <>{v.toFixed(unit === '€' ? 2 : 1)}{unit === '%' ? '%' : unit === '★' ? '★' : ` ${unit}`}</>;
}

export function FranchiseCompareClient() {
  const [data, setData] = useState<FranchiseCompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/franchise-compare');
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        setError(j.error ?? 'Fehler beim Laden');
        return;
      }
      const d = await res.json() as FranchiseCompareResponse;
      setData(d);
      setError(null);
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, REFRESH_INTERVAL * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm animate-pulse">
        Lade Vergleichsdaten…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-red-400 text-sm">
        {error}
        <button onClick={load} className="ml-3 underline text-xs">Neu laden</button>
      </div>
    );
  }
  if (!data || !data.locations.length) {
    return (
      <div className="rounded-xl border border-white/5 bg-white/2 p-8 text-center text-gray-400 text-sm">
        Keine Standortdaten verfügbar. Bitte prüfe die Franchise-Konfiguration.
      </div>
    );
  }

  const { locations, totals } = data;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Refresh-Ticker */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{locations.length} Standort{locations.length !== 1 ? 'e' : ''} · Tenant {data.tenant_id.slice(0, 8)}…</span>
        <span>Aktualisierung in {countdown}s</span>
      </div>

      {/* Gesamt-KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Standorte',          value: totals.locations,       unit: '' },
          { label: 'Queue gesamt',        value: totals.queue_total,     unit: ' Bestellungen' },
          { label: 'Geliefert heute',     value: totals.completed_today, unit: ' gesamt' },
          { label: 'Kritische Alarme',    value: totals.critical_alerts, unit: '', warn: totals.critical_alerts > 0 },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.warn ? 'border-red-500/30 bg-red-500/5' : 'border-white/5 bg-white/2'}`}>
            <div className={`text-xl font-bold ${k.warn ? 'text-red-400' : 'text-white'}`}>
              {k.value}{k.unit}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Location-Tabelle */}
      <div className="space-y-3">
        {locations.map((loc) => (
          <LocationRow key={loc.location_id} loc={loc} />
        ))}
      </div>

      <div className="text-xs text-gray-600 text-center">
        Zuletzt aktualisiert: {new Date(data.generated_at).toLocaleTimeString('de-DE')}
      </div>
    </div>
  );
}

function LocationRow({ loc }: { loc: LocationCompareRow }) {
  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${healthBg(loc.health)}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-shrink-0 w-8 flex justify-center">
          {rankBadge(loc.rank)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm truncate">{loc.location_name}</div>
          <div className={`text-xs font-medium ${healthColor(loc.health)} capitalize`}>
            {loc.health === 'critical' ? 'Kritisch' : loc.health === 'warning' ? 'Warnung' : 'Betrieb ok'}
            {loc.critical_alerts > 0 && (
              <span className="ml-2 bg-red-500/20 text-red-400 rounded px-1">{loc.critical_alerts} kritisch</span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-base font-bold text-white">
            €{loc.revenue_today.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">Umsatz heute</div>
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
        <KpiCell label="Queue" value={loc.queue_depth.toString()} warn={loc.queue_depth >= 5} />
        <KpiCell label="Touren aktiv" value={loc.active_tours.toString()} />
        <KpiCell label="In Küche" value={loc.cooking_now.toString()} warn={loc.cooking_now >= 8} />
        <KpiCell label="Geliefert heute" value={loc.completed_today.toString()} positive />
        <KpiCell
          label="On-Time"
          value={loc.on_time_rate !== null ? `${loc.on_time_rate}%` : '—'}
          colorClass={onTimeColor(loc.on_time_rate)}
        />
        <KpiCell
          label={`Ø Rating (${loc.total_ratings})`}
          value={loc.avg_rating !== null ? `${loc.avg_rating.toFixed(1)}★` : '—'}
          colorClass={ratingColor(loc.avg_rating)}
        />
      </div>

      {loc.oldest_queued_min !== null && loc.oldest_queued_min > 5 && (
        <div className="mt-2 text-xs text-amber-400">
          ⚠️ Älteste wartende Bestellung seit {loc.oldest_queued_min} Min ohne Fahrer
        </div>
      )}
    </div>
  );
}

function KpiCell({
  label,
  value,
  warn,
  positive,
  colorClass,
}: {
  label: string;
  value: string;
  warn?: boolean;
  positive?: boolean;
  colorClass?: string;
}) {
  const vc = colorClass ?? (warn ? 'text-red-400' : positive ? 'text-emerald-400' : 'text-white');
  return (
    <div className="rounded-lg bg-white/3 px-2 py-2">
      <div className={`text-sm font-bold ${vc}`}>{value}</div>
      <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{label}</div>
    </div>
  );
}
