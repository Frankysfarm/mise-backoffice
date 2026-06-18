'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, RefreshCw, TrendingUp, Clock, BarChart3, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ShiftPredictionDashboard } from '@/lib/delivery/shift-performance-prediction';

// ─── constants ────────────────────────────────────────────────────────────────

const DOW_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DOW_LABELS_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// ─── helpers ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 items-start shadow-sm">
      <div className={cn('p-2 rounded-lg', color)}>{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-2xl font-bold text-slate-800 leading-tight">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return 'bg-emerald-500';
  if (score >= 0.5) return 'bg-amber-400';
  if (score >= 0.2) return 'bg-orange-400';
  return 'bg-slate-200';
}

function orderHeatColor(value: number, maxVal: number): string {
  if (maxVal === 0) return 'bg-slate-100';
  const ratio = value / maxVal;
  if (ratio >= 0.8) return 'bg-indigo-700';
  if (ratio >= 0.6) return 'bg-indigo-500';
  if (ratio >= 0.4) return 'bg-indigo-300';
  if (ratio >= 0.2) return 'bg-indigo-100';
  return 'bg-slate-50';
}

// ─── main component ───────────────────────────────────────────────────────────

export function ShiftPredictionClient() {
  const [data, setData] = useState<ShiftPredictionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);
  const [tab, setTab] = useState<'heatmap' | 'tophours'>('heatmap');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/shift-performance-prediction?action=dashboard');
      if (res.ok) setData(await res.json() as ShiftPredictionDashboard);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    await fetch('/api/delivery/admin/shift-performance-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snapshot' }),
    });
    setSnapshotting(false);
    await load();
  };

  // Compute max order count for heatmap color scale
  const heatmapMax = data
    ? Math.max(...(data.heatmap.flatMap(row => row)), 0.01)
    : 1;

  if (loading && !data) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="animate-spin mx-auto mb-2 text-slate-400" size={20} />
        <p className="text-slate-400 text-sm">Lade Prognose-Daten…</p>
      </div>
    );
  }

  const topHour = data?.topHours[0];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Calendar className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Schicht-Performance-Prognose</h1>
            <p className="text-sm text-slate-500">7×24 Slot-Vorhersage · Historische Bestelldaten · Fahrerbedarf</p>
          </div>
        </div>
        <button
          onClick={handleSnapshot}
          disabled={snapshotting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={cn(snapshotting && 'animate-spin')} />
          {snapshotting ? 'Berechne…' : 'Neu berechnen'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Ø Konfidenz"
          value={data ? `${(data.avgConfidence * 100).toFixed(0)}%` : '—'}
          sub="Datenbasis (0–100%)"
          icon={<Target size={18} className="text-indigo-600" />}
          color="bg-indigo-50"
        />
        <KpiCard
          label="Spitzenstunde"
          value={topHour ? `${DOW_LABELS[topHour.dayOfWeek]} ${String(topHour.hourBucket).padStart(2, '0')}:00` : '—'}
          sub={topHour ? `Ø ${topHour.predictedOrders.toFixed(1)} Bestellungen` : undefined}
          icon={<Clock size={18} className="text-amber-600" />}
          color="bg-amber-50"
        />
        <KpiCard
          label="Slots berechnet"
          value={data?.totalSlots ?? 0}
          sub="7 Tage × 24 Stunden"
          icon={<BarChart3 size={18} className="text-emerald-600" />}
          color="bg-emerald-50"
        />
        <KpiCard
          label="Prognose-Genauigkeit"
          value={
            data?.accuracy?.filledActuals
              ? `${(100 - Math.min(100, (data.accuracy.avgOrderError / Math.max(1, data.accuracy.avgOrderError)) * 100)).toFixed(0)}%`
              : 'Noch keine Ist-Daten'
          }
          sub={data?.accuracy ? `${data.accuracy.filledActuals} von ${data.accuracy.totalSlots} Slots` : undefined}
          icon={<TrendingUp size={18} className="text-blue-600" />}
          color="bg-blue-50"
        />
      </div>

      {/* tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {([
          { key: 'heatmap' as const, label: 'Wochenheatmap' },
          { key: 'tophours' as const, label: 'Top-5 Spitzenstunden' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* tab: heatmap */}
      {tab === 'heatmap' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm overflow-x-auto">
          <div className="text-sm font-medium text-slate-700 mb-4">
            Prognostizierte Bestellungen pro Wochentag + Stunde
          </div>
          {!data || data.totalSlots === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Calendar size={32} className="mx-auto mb-2" />
              <p>Noch keine Prognose-Daten. Klicke auf &quot;Neu berechnen&quot;.</p>
            </div>
          ) : (
            <div className="min-w-[600px]">
              {/* hour axis */}
              <div className="flex mb-1">
                <div className="w-10 shrink-0" />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="flex-1 text-center text-[9px] text-slate-400">
                    {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
                  </div>
                ))}
              </div>
              {/* rows: dow */}
              {Array.from({ length: 7 }, (_, dow) => (
                <div key={dow} className="flex items-center mb-0.5">
                  <div className="w-10 shrink-0 text-xs text-slate-500 font-medium">
                    {DOW_LABELS[dow]}
                  </div>
                  {data.heatmap[dow].map((val, hour) => (
                    <div
                      key={hour}
                      className={cn(
                        'flex-1 h-5 mx-px rounded-sm transition-colors',
                        orderHeatColor(val, heatmapMax),
                      )}
                      title={`${DOW_LABELS_FULL[dow]} ${String(hour).padStart(2, '0')}:00 — ${val.toFixed(1)} Bestellungen`}
                    />
                  ))}
                </div>
              ))}
              {/* legend */}
              <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                <span>Wenig</span>
                {['bg-slate-50', 'bg-indigo-100', 'bg-indigo-300', 'bg-indigo-500', 'bg-indigo-700'].map(c => (
                  <div key={c} className={cn('h-3 w-6 rounded', c)} />
                ))}
                <span>Viel</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* tab: top hours */}
      {tab === 'tophours' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {!data?.topHours.length ? (
            <div className="text-center py-8 text-slate-400">
              <Clock size={28} className="mx-auto mb-2" />
              <p>Noch keine Prognose-Daten vorhanden.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3">Rang</th>
                  <th className="text-left px-4 py-3">Zeitslot</th>
                  <th className="text-right px-4 py-3">Ø Bestellungen</th>
                  <th className="text-right px-4 py-3">Ø Umsatz</th>
                  <th className="text-right px-4 py-3">Konfidenz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topHours.map((slot, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-400">#{idx + 1}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">
                        {DOW_LABELS_FULL[slot.dayOfWeek]}
                      </span>
                      <span className="text-slate-500 ml-2">
                        {String(slot.hourBucket).padStart(2, '0')}:00–{String(slot.hourBucket + 1).padStart(2, '0')}:00
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">
                      {slot.predictedOrders.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      €{slot.predictedRevenue.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', confidenceColor(slot.confidence))}
                            style={{ width: `${slot.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">
                          {(slot.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
