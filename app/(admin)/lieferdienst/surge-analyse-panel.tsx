'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus,
  RefreshCw, Zap, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SurgeAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  window_min: number;
  z_score: number;
  current_rate: number;
  baseline_rate: number;
  detected_at: string;
  resolved_at: string | null;
}

interface SurgeDashboard {
  activeAlerts: SurgeAlert[];
  recentDetections: { detected_at: string; severity: string; z_score: number; window_min: number }[];
  baselineStatus: { last_rebuilt_at: string | null; sample_hours: number } | null;
  currentZScore: number | null;
  trendDirection: 'rising' | 'falling' | 'stable';
}

const SEVERITY_COLOR: Record<string, string> = {
  low:      '#eab308',
  medium:   '#f97316',
  high:     '#ef4444',
  critical: '#7f1d1d',
};

const SEVERITY_LABEL: Record<string, string> = {
  low:      'Leicht',
  medium:   'Mittel',
  high:     'Stark',
  critical: 'Kritisch',
};

interface Props {
  locationId: string;
}

export function SurgeAnalysePanel({ locationId }: Props) {
  const [dashboard, setDashboard] = useState<SurgeDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/delivery/surge?locationId=${locationId}`, { cache: 'no-store' });
      if (res.ok) {
        const body = await res.json() as { ok: boolean; dashboard: SurgeDashboard };
        if (body.ok) {
          setDashboard(body.dashboard);
          setLastUpdated(new Date());
        }
      }
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 120_000);
    return () => clearInterval(iv);
  }, [load]);

  // Rebuild baseline on demand
  async function rebuildBaseline() {
    try {
      await fetch('/api/delivery/surge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, action: 'rebuild_baseline' }),
      });
      await load(true);
    } catch {}
  }

  // Build chart data from recent detections (last 12)
  const chartData = (dashboard?.recentDetections ?? [])
    .slice(-12)
    .map((d) => ({
      time: new Date(d.detected_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      zScore: Math.round(d.z_score * 10) / 10,
      severity: d.severity,
      window: d.window_min,
    }));

  const activeAlerts = dashboard?.activeAlerts ?? [];
  const topAlert = activeAlerts.reduce<SurgeAlert | null>((prev, curr) => {
    if (!prev) return curr;
    const order = ['critical', 'high', 'medium', 'low'];
    return order.indexOf(curr.severity) < order.indexOf(prev.severity) ? curr : prev;
  }, null);

  const trendDir = dashboard?.trendDirection ?? 'stable';
  const currentZ = dashboard?.currentZScore ?? null;

  const TrendIcon = trendDir === 'rising' ? TrendingUp : trendDir === 'falling' ? TrendingDown : Minus;
  const trendColor = trendDir === 'rising' ? 'text-red-600' : trendDir === 'falling' ? 'text-green-600' : 'text-gray-400';

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-2">
        <RefreshCw size={14} className="animate-spin text-gray-400" />
        <span className="text-xs text-gray-400">Surge-Daten laden …</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-matcha-600 shrink-0" />
          <span className="text-sm font-semibold text-gray-800">Nachfrage-Surge Analyse</span>
          {topAlert && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium text-white"
              style={{ backgroundColor: SEVERITY_COLOR[topAlert.severity] }}
            >
              {SEVERITY_LABEL[topAlert.severity]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-gray-400">
              {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => void load(true)}
            disabled={refreshing}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <RefreshCw size={12} className={cn('text-gray-400', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Status & Trend */}
        <div className="flex items-center justify-between">
          <div>
            {activeAlerts.length === 0 ? (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-green-600" />
                <span className="text-sm font-medium text-green-700">Normalbetrieb</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {topAlert?.severity === 'critical' ? (
                  <Zap size={14} className="text-red-700" />
                ) : (
                  <AlertTriangle size={14} className="text-orange-600" />
                )}
                <span className="text-sm font-medium text-gray-800">
                  {activeAlerts.length} aktive{activeAlerts.length > 1 ? ' Alerts' : 'r Alert'}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <TrendIcon size={13} className={trendColor} />
            <span className="text-xs text-gray-600">
              {trendDir === 'rising' ? 'Nachfrage steigt' : trendDir === 'falling' ? 'Nachfrage sinkt' : 'Stabil'}
            </span>
            {currentZ !== null && (
              <span className="text-xs text-gray-400 font-mono">Z={currentZ.toFixed(1)}</span>
            )}
          </div>
        </div>

        {/* Aktive Alert Details */}
        {activeAlerts.length > 0 && (
          <div className="space-y-1.5">
            {activeAlerts.slice(0, 3).map((alert) => {
              const excess = alert.baseline_rate > 0
                ? Math.round(((alert.current_rate - alert.baseline_rate) / alert.baseline_rate) * 100)
                : 0;
              return (
                <div
                  key={alert.id}
                  className="flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5"
                  style={{
                    backgroundColor: `${SEVERITY_COLOR[alert.severity]}15`,
                    borderLeft: `3px solid ${SEVERITY_COLOR[alert.severity]}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">{alert.window_min} Min-Fenster</span>
                    <span className="text-gray-500">+{excess}% über Baseline</span>
                  </div>
                  <span className="font-mono text-gray-500">Z={alert.z_score.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Z-Score Chart */}
        {chartData.length >= 3 && (
          <div>
            <p className="text-[10px] text-gray-400 mb-1.5 uppercase tracking-wide">Z-Score Verlauf (letzte Detektionen)</p>
            <div className="h-20">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={14} margin={{ top: 2, right: 2, bottom: 0, left: -20 }}>
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(v: unknown) => [`${v}`, 'Z-Score']}
                    labelFormatter={(l) => `${l}`}
                  />
                  <Bar dataKey="zScore" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={SEVERITY_COLOR[entry.severity] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Baseline Status */}
        {dashboard?.baselineStatus && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <span className="text-[10px] text-gray-400">
              Baseline: {dashboard.baselineStatus.sample_hours}h Daten
              {dashboard.baselineStatus.last_rebuilt_at && (
                <> · aktualisiert {new Date(dashboard.baselineStatus.last_rebuilt_at).toLocaleDateString('de-DE')}</>
              )}
            </span>
            <button
              onClick={() => void rebuildBaseline()}
              className="text-[10px] text-matcha-600 hover:text-matcha-700 font-medium"
            >
              Baseline aktualisieren
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
