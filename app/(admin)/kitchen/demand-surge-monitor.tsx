'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, TrendingUp, Zap, CheckCircle2, RefreshCw, X } from 'lucide-react';
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
  dismissed_at: string | null;
}

interface SurgeDashboard {
  locationId: string;
  activeAlerts: SurgeAlert[];
  recentDetections: { detected_at: string; severity: string; z_score: number }[];
  baselineStatus: { last_rebuilt_at: string | null; sample_hours: number } | null;
  currentZScore: number | null;
  trendDirection: 'rising' | 'falling' | 'stable';
}

const SEVERITY_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  low:      { label: 'Leicht erhöht',  color: 'text-yellow-700',  bg: 'bg-yellow-50 border-yellow-200',  icon: TrendingUp },
  medium:   { label: 'Erhöht',         color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200',  icon: TrendingUp },
  high:     { label: 'Stark erhöht',   color: 'text-red-700',     bg: 'bg-red-50 border-red-200',        icon: AlertTriangle },
  critical: { label: 'KRITISCH',       color: 'text-red-900',     bg: 'bg-red-100 border-red-400',       icon: Zap },
};

const KITCHEN_ACTION: Record<string, string> = {
  low:      'Vorproduktion leicht erhöhen',
  medium:   'Zusätzliche Station aktivieren',
  high:     'Alle Stationen voll besetzen, Prep-Liste abarbeiten',
  critical: 'SOFORT: Alle verfügbaren Kräfte mobilisieren!',
};

interface Props {
  locationId: string;
}

export function KitchenDemandSurgeMonitor({ locationId }: Props) {
  const [dashboard, setDashboard] = useState<SurgeDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/surge?locationId=${locationId}`, { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json() as { ok: boolean; dashboard: SurgeDashboard };
      if (body.ok) setDashboard(body.dashboard);
    } catch {}
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  async function dismiss(alertId: string) {
    setDismissed((s) => new Set([...s, alertId]));
    try {
      await fetch('/api/delivery/surge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, action: 'dismiss', alertId }),
      });
    } catch {}
  }

  if (loading) return null;

  const visibleAlerts = (dashboard?.activeAlerts ?? []).filter((a) => !dismissed.has(a.id));

  if (visibleAlerts.length === 0) return null;

  const topAlert = visibleAlerts.reduce((prev, curr) => {
    const order = ['critical', 'high', 'medium', 'low'];
    return order.indexOf(curr.severity) < order.indexOf(prev.severity) ? curr : prev;
  });

  const meta = SEVERITY_META[topAlert.severity] ?? SEVERITY_META.medium;
  const Icon = meta.icon;
  const action = KITCHEN_ACTION[topAlert.severity] ?? '';
  const excess = topAlert.current_rate > 0
    ? Math.round(((topAlert.current_rate - topAlert.baseline_rate) / topAlert.baseline_rate) * 100)
    : 0;

  return (
    <div className={cn('rounded-xl border p-3 shadow-sm', meta.bg)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className={cn('shrink-0', meta.color)} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-sm font-semibold', meta.color)}>
                Nachfrage-Surge: {meta.label}
              </span>
              <span className="text-xs bg-white/60 rounded px-1.5 py-0.5 font-mono text-gray-600">
                +{excess}% · Z={topAlert.z_score.toFixed(1)}
              </span>
            </div>
            <p className={cn('text-xs mt-0.5', meta.color)}>{action}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={load}
            className="p-1 rounded hover:bg-white/40 transition-colors"
            title="Aktualisieren"
          >
            <RefreshCw size={12} className="text-gray-500" />
          </button>
          <button
            onClick={() => void dismiss(topAlert.id)}
            className="p-1 rounded hover:bg-white/40 transition-colors"
            title="Schließen"
          >
            <X size={12} className="text-gray-500" />
          </button>
        </div>
      </div>

      {visibleAlerts.length > 1 && (
        <div className="mt-1.5 text-xs text-gray-500">
          +{visibleAlerts.length - 1} weitere Zeitfenster betroffen
        </div>
      )}

      {dashboard?.trendDirection === 'rising' && (
        <div className="mt-1.5 flex items-center gap-1">
          <TrendingUp size={11} className="text-red-500" />
          <span className="text-xs text-red-600 font-medium">Trend steigend – bald mehr Bestellungen erwartet</span>
        </div>
      )}
      {dashboard?.trendDirection === 'falling' && (
        <div className="mt-1.5 flex items-center gap-1">
          <CheckCircle2 size={11} className="text-green-600" />
          <span className="text-xs text-green-700">Trend fällt – Spitze klingt ab</span>
        </div>
      )}
    </div>
  );
}
