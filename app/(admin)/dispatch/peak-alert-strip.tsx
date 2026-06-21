'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, ChefHat, Loader2, Users, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type RiskLevel = 'elevated' | 'high' | 'extreme';

type PeakAlert = {
  id: string;
  alertDate: string;
  peakScore: number;
  riskLevel: RiskLevel;
  predictedOrders: number | null;
  extraDriversRec: number;
  kitchenEarlierMin: number;
  weekdayName: string;
  daysUntil: number;
  eventTitle: string | null;
};

type PeakDashboard = {
  summary: {
    openAlerts: number;
    nextPeakDate: string | null;
    nextPeakDaysUntil: number | null;
    nextPeakScore: number | null;
  };
  upcomingAlerts: PeakAlert[];
};

const RISK_CONFIG: Record<RiskLevel, { label: string; bg: string; border: string; badge: string; dot: string }> = {
  elevated: {
    label: 'Erhöht',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700 border-amber-300',
    dot: 'bg-amber-400',
  },
  high: {
    label: 'Hoch',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700 border-orange-300',
    dot: 'bg-orange-500',
  },
  extreme: {
    label: 'Extrem',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700 border-red-300',
    dot: 'bg-red-500',
  },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  } catch {
    return iso;
  }
}

export function DispatchPeakAlertStrip() {
  const [data, setData] = useState<PeakDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetch('/api/delivery/admin/peak-intelligence')
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && (d.upcomingAlerts !== undefined || d.summary)) {
            setData(d as PeakDashboard);
          }
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    load();
    const iv = setInterval(load, 15 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-stone-100 bg-white px-4 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Spitzentag-Prognose wird geladen…</span>
      </div>
    );
  }

  const alerts = (data?.upcomingAlerts ?? [])
    .filter((a) => !dismissed.has(a.id) && a.daysUntil <= 7)
    .slice(0, 3);

  if (alerts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100">
          <Zap className="h-4 w-4 text-amber-600" />
        </div>
        <span className="text-sm font-bold text-stone-800">Spitzentag-Vorschau</span>
        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
          {alerts.length} Alert{alerts.length !== 1 ? 's' : ''} aktiv
        </span>
      </div>

      <div className="space-y-2">
        {alerts.map((alert) => {
          const cfg = RISK_CONFIG[alert.riskLevel];
          return (
            <div
              key={alert.id}
              className={cn('relative rounded-xl border p-3', cfg.bg, cfg.border)}
            >
              <button
                onClick={() => setDismissed((prev) => new Set([...prev, alert.id]))}
                className="absolute right-2 top-2 text-stone-300 hover:text-stone-500"
              >
                <X className="h-3 w-3" />
              </button>

              <div className="flex items-start gap-3 pr-4">
                {/* Date column */}
                <div className="shrink-0 text-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-stone-200">
                    <CalendarDays className="h-4 w-4 text-stone-500" />
                  </div>
                  <div className="mt-1 text-[9px] font-bold text-stone-500 whitespace-nowrap">
                    {alert.daysUntil === 0 ? 'Heute' : alert.daysUntil === 1 ? 'Morgen' : `in ${alert.daysUntil}d`}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold text-stone-800">
                      {alert.weekdayName}, {formatDate(alert.alertDate)}
                    </span>
                    <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-bold', cfg.badge)}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px] font-bold text-stone-500 tabular-nums">
                      Score {alert.peakScore}
                    </span>
                  </div>

                  {alert.eventTitle && (
                    <div className="text-[10px] text-stone-500 mb-1 truncate">📅 {alert.eventTitle}</div>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
                    {alert.extraDriversRec > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-stone-700">
                        <Users className="h-3 w-3 text-blue-500" />
                        <span>+{alert.extraDriversRec} Fahrer empfohlen</span>
                      </div>
                    )}
                    {alert.kitchenEarlierMin > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-stone-700">
                        <ChefHat className="h-3 w-3 text-matcha-600" />
                        <span>Küche {alert.kitchenEarlierMin} Min früher</span>
                      </div>
                    )}
                    {alert.predictedOrders !== null && (
                      <div className="text-[10px] text-stone-500">
                        ~{alert.predictedOrders} Bestellungen erwartet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
