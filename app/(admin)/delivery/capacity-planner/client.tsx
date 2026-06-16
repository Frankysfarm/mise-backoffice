'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Loader2, AlertTriangle, CheckCircle, Users, CalendarRange, TrendingUp, Clock } from 'lucide-react';
import type {
  CapacityDashboard,
  CapacityDayCell,
  CapacitySummary,
  CapacitySlotStatus,
} from '@/lib/delivery/capacity-planner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  locationId: string;
}

interface ApiResponse extends CapacityDashboard {
  ok: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WEEKDAY_FULL  = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function statusBg(status: CapacitySlotStatus, isPeak: boolean): string {
  if (status === 'uncovered') return 'bg-red-500';
  if (status === 'understaffed') return isPeak ? 'bg-orange-400' : 'bg-amber-300';
  return isPeak ? 'bg-emerald-400' : 'bg-emerald-100';
}

function statusBorder(status: CapacitySlotStatus): string {
  if (status === 'uncovered') return 'border-red-600';
  if (status === 'understaffed') return 'border-amber-500';
  return 'border-transparent';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon,
  color = 'text-gray-800',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-3 items-start">
      <div className="mt-0.5 text-gray-400">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Weekly Heatmap Grid ───────────────────────────────────────────────────────

function WeeklyHeatmap({ weekGrid }: { weekGrid: CapacityDayCell[] }) {
  const dates = [...new Set(weekGrid.map((c) => c.date))].sort();
  const hours = [...new Set(weekGrid.map((c) => c.hourOfDay))].sort((a, b) => a - b);

  // Build lookup: "date|hour" → cell
  const lookup = new Map(weekGrid.map((c) => [`${c.date}|${c.hourOfDay}`, c]));

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="text-gray-400 font-normal text-right pr-2 pb-1 w-12">Uhr</th>
            {dates.map((d) => (
              <th key={d} className="text-center font-medium text-gray-600 pb-1 px-0.5 min-w-[52px]">
                {formatDate(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((h) => (
            <tr key={h}>
              <td className="text-gray-400 text-right pr-2 py-0.5 leading-none">{hourLabel(h)}</td>
              {dates.map((d) => {
                const cell = lookup.get(`${d}|${h}`);
                if (!cell) {
                  return <td key={d} className="px-0.5 py-0.5"><div className="w-full h-7 rounded bg-gray-50" /></td>;
                }
                const bg = statusBg(cell.status, cell.isPeak);
                const border = statusBorder(cell.status);
                return (
                  <td key={d} className="px-0.5 py-0.5">
                    <div
                      title={`${d} ${hourLabel(h)} — ${cell.expectedOrders} Best. · ${cell.scheduledDrivers}/${cell.recommendedDrivers} Fahrer`}
                      className={`w-full h-7 rounded border ${bg} ${border} flex items-center justify-center cursor-default transition-opacity hover:opacity-80`}
                    >
                      {cell.recommendedDrivers > 0 && (
                        <span className={`font-semibold text-[10px] ${cell.status === 'uncovered' ? 'text-white' : cell.status === 'understaffed' ? 'text-amber-900' : 'text-emerald-900'}`}>
                          {cell.scheduledDrivers}/{cell.recommendedDrivers}
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-100" /> Abgedeckt</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-400" /> Peak abgedeckt</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-300" /> Zu wenig</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-400" /> Peak zu wenig</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-500" /> Kein Fahrer</span>
      </div>
    </div>
  );
}

// ── Gaps Table ────────────────────────────────────────────────────────────────

function GapsTable({ gaps }: { gaps: CapacityDashboard['gaps'] }) {
  if (gaps.length === 0) {
    return (
      <div className="flex items-center gap-2 text-emerald-600 text-sm py-4">
        <CheckCircle className="h-4 w-4" />
        Keine Lücken heute — alle Slots abgedeckt.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-100">
            <th className="text-left py-2 font-medium">Uhrzeit</th>
            <th className="text-right py-2 font-medium">Erwartet</th>
            <th className="text-right py-2 font-medium">Empfohlen</th>
            <th className="text-right py-2 font-medium">Geplant</th>
            <th className="text-right py-2 font-medium">Fehlend</th>
            <th className="text-right py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {gaps.map((g) => (
            <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2 font-mono">{hourLabel(g.hourOfDay)}</td>
              <td className="py-2 text-right text-gray-600">{g.expectedOrders} Best.</td>
              <td className="py-2 text-right font-medium">{g.recommendedDrivers}</td>
              <td className="py-2 text-right">{g.scheduledDrivers}</td>
              <td className="py-2 text-right font-bold text-red-600">−{g.coverageGap}</td>
              <td className="py-2 text-right">
                {g.scheduledDrivers === 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">Unbesetzt</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">Unterbesetzt</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Summary Badges ────────────────────────────────────────────────────────────

function SummaryBadges({ summary }: { summary: CapacitySummary }) {
  const worstDay = summary.worstDate
    ? new Date(summary.worstDate + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })
    : null;

  if (summary.uncoveredSlots === 0 && summary.understaffedSlots === 0) {
    return (
      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
        <CheckCircle className="h-4 w-4" />
        <span>Alle {summary.totalSlots} Slots der nächsten 7 Tage sind abgedeckt. Sehr gut!</span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          {summary.uncoveredSlots > 0 && (
            <p><strong>{summary.uncoveredSlots} Slots komplett unbesetzt</strong> — kein Fahrer geplant.</p>
          )}
          {summary.understaffedSlots > 0 && (
            <p><strong>{summary.understaffedSlots} Slots unterbesetzt</strong> — weniger Fahrer als empfohlen.</p>
          )}
          {worstDay && (
            <p className="text-amber-600 text-xs">Schlechtester Tag: {worstDay} (max. Lücke: {summary.maxGap} Fahrer)</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Client ───────────────────────────────────────────────────────────────

export function CapacityPlannerClient({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<'grid' | 'gaps'>('grid');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/capacity-planner?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json() as ApiResponse;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await fetch(`/api/delivery/admin/capacity-planner?location_id=${locationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });
      await load();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('grid')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'grid' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            7-Tage-Raster
          </button>
          <button
            onClick={() => setTab('gaps')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'gaps' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Lücken heute
            {(data?.gaps.length ?? 0) > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-red-500 text-white">
                {data!.gaps.length}
              </span>
            )}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void handleGenerate()}
            disabled={generating || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
            Plan aktualisieren
          </button>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lade Kapazitätsplan…
        </div>
      ) : data ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Abdeckungsrate (7 Tage)"
              value={`${data.summary.coveragePct}%`}
              sub={`${data.summary.coveredSlots}/${data.summary.totalSlots} Slots`}
              icon={<CheckCircle className="h-5 w-5" />}
              color={data.summary.coveragePct >= 80 ? 'text-emerald-600' : data.summary.coveragePct >= 50 ? 'text-amber-600' : 'text-red-600'}
            />
            <KpiCard
              label="Lücken heute"
              value={data.gaps.length}
              sub={data.gaps.length > 0 ? `${data.gaps.filter((g) => g.scheduledDrivers === 0).length} unbesetzt` : 'Alles abgedeckt'}
              icon={<AlertTriangle className="h-5 w-5" />}
              color={data.gaps.length === 0 ? 'text-emerald-600' : 'text-red-600'}
            />
            <KpiCard
              label="Peak-Slots (7 Tage)"
              value={data.summary.peakSlots}
              sub="Hohe Nachfrage-Stunden"
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <KpiCard
              label="Max. Fahrer-Lücke"
              value={data.summary.maxGap}
              sub={data.summary.worstDate ? `Schlechtester Tag: ${formatDate(data.summary.worstDate)}` : 'Keine Lücken'}
              icon={<Users className="h-5 w-5" />}
              color={data.summary.maxGap === 0 ? 'text-emerald-600' : data.summary.maxGap <= 2 ? 'text-amber-600' : 'text-red-600'}
            />
          </div>

          {/* Status Banner */}
          <SummaryBadges summary={data.summary} />

          {/* Tab Content */}
          {tab === 'grid' ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <CalendarRange className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Wochenraster — Fahrerbedarf vs. Besetzung</h3>
              </div>
              <WeeklyHeatmap weekGrid={data.weekGrid} />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Heutige Lücken — ab jetzt</h3>
              </div>
              <GapsTable gaps={data.gaps} />
            </div>
          )}

          {/* Info Box */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-1">
            <p><strong>Formel:</strong> Empfohlene Fahrer = ⌈Erwartete Bestellungen ÷ 2,5⌉ (2,5 Lieferungen/Fahrer/Stunde)</p>
            <p><strong>Datenquelle:</strong> Historisches Nachfragemuster (v_hourly_demand_pattern) × geplante Schichten (driver_shifts)</p>
            <p><strong>Peak-Slot:</strong> Erwartete Bestellungen ≥ 75 % des historischen Maximums der Stunde</p>
            <p><strong>Aktualisierung:</strong> Täglich automatisch um 02:30 UTC (Cron) + manuell per Schaltfläche</p>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <CalendarRange className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Kein Plan verfügbar. Klicke auf <em>Plan aktualisieren</em>.</p>
        </div>
      )}
    </div>
  );
}
