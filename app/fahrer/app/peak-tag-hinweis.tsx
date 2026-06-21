'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, ChefHat, Loader2, TrendingUp, Users, X } from 'lucide-react';
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

const RISK_CONFIG: Record<RiskLevel, {
  label: string;
  bg: string;
  border: string;
  text: string;
  iconBg: string;
  msg: string;
}> = {
  elevated: {
    label: 'Erhöhte Nachfrage',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-800',
    iconBg: 'bg-amber-100',
    msg: 'Etwas mehr Bestellungen als üblich erwartet.',
  },
  high: {
    label: 'Hohe Nachfrage',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-800',
    iconBg: 'bg-orange-100',
    msg: 'Deutlich mehr Bestellungen — früher einloggen lohnt sich!',
  },
  extreme: {
    label: 'Extreme Nachfrage',
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-800',
    iconBg: 'bg-red-100',
    msg: 'Sehr hohe Nachfrage! Unbedingt früh starten für maximale Einnahmen.',
  },
};

function formatDate(iso: string, daysUntil: number): string {
  if (daysUntil === 0) return 'Heute';
  if (daysUntil === 1) return 'Morgen';
  try {
    return new Date(iso).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });
  } catch {
    return iso;
  }
}

export function FahrerPeakTagHinweis() {
  const [alert, setAlert] = useState<PeakAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetch('/api/delivery/admin/peak-intelligence')
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) {
            const alerts: PeakAlert[] = d.upcomingAlerts ?? [];
            const next = alerts.find((a) => a.daysUntil <= 2 && (a.riskLevel === 'high' || a.riskLevel === 'extreme'))
              ?? alerts.find((a) => a.daysUntil <= 3);
            setAlert(next ?? null);
          }
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    load();
    const iv = setInterval(load, 30 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (loading || dismissed || !alert) return null;

  const cfg = RISK_CONFIG[alert.riskLevel];
  const dateLabel = formatDate(alert.alertDate, alert.daysUntil);

  return (
    <div className={cn('mx-4 rounded-2xl border p-4', cfg.bg, cfg.border)}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', cfg.iconBg)}>
          <TrendingUp className={cn('h-5 w-5', cfg.text)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className={cn('text-xs font-black', cfg.text)}>
              {dateLabel}: {cfg.label}
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-stone-300 hover:text-stone-500 ml-2"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {alert.eventTitle && (
            <div className="text-[10px] text-stone-500 mb-1">📅 {alert.eventTitle}</div>
          )}

          <p className={cn('text-[11px] mb-2', cfg.text)}>{cfg.msg}</p>

          <div className="flex flex-wrap gap-3">
            {alert.extraDriversRec > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-stone-600">
                <Users className="h-3 w-3 text-blue-500" />
                <span>Viele Fahrer aktiv (+{alert.extraDriversRec})</span>
              </div>
            )}
            {alert.kitchenEarlierMin > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-stone-600">
                <ChefHat className="h-3 w-3 text-matcha-600" />
                <span>Küche {alert.kitchenEarlierMin} Min früher</span>
              </div>
            )}
            {alert.predictedOrders !== null && (
              <div className="flex items-center gap-1 text-[10px] text-stone-600">
                <CalendarDays className="h-3 w-3 text-stone-400" />
                <span>~{alert.predictedOrders} Bestellungen erwartet</span>
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-white/60 border border-white px-2.5 py-1.5">
            <span className="text-[10px] text-stone-500 font-medium">
              💡 Tipp: Früh einloggen = mehr Touren = mehr Einnahmen!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
