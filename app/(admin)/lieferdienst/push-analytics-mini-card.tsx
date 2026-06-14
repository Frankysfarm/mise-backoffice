'use client';

import React, { useEffect, useState } from 'react';
import { Bell, TrendingUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChannelSummary = {
  channel: string;
  sent7d: number;
  delivered7d: number;
  failed7d: number;
  deliveryRatePct: number;
};

type PushDashboard = {
  totalSent7d: number;
  totalDelivered7d: number;
  overallDeliveryRatePct: number;
  waReadRatePct: number;
  vapidActiveSubs: number;
  channels: ChannelSummary[];
};

const CHANNEL_LABELS: Record<string, string> = {
  vapid: 'Browser Push',
  whatsapp: 'WhatsApp',
  driver: 'Fahrer Push',
};

/* ──────────────────────────────────────────────────────────────
   PushAnalyticsMiniCard
   Kompakte Push-Notification Leistungsübersicht (7 Tage).
   Nutzt Phase 175 API: GET /api/delivery/admin/push-analytics
   ────────────────────────────────────────────────────────────── */
export function PushAnalyticsMiniCard() {
  const [data, setData] = useState<PushDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/delivery/admin/push-analytics?action=dashboard&days=7')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 flex items-center gap-3 text-stone-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Lade Push-Statistiken…</span>
      </div>
    );
  }

  if (error || !data) return null;
  if (data.totalSent7d === 0 && data.vapidActiveSubs === 0) return null;

  const deliveryColor =
    data.overallDeliveryRatePct >= 80 ? 'text-matcha-700' :
    data.overallDeliveryRatePct >= 50 ? 'text-amber-600' :
    'text-red-600';

  const waColor =
    data.waReadRatePct >= 60 ? 'text-matcha-700' :
    data.waReadRatePct >= 30 ? 'text-amber-600' :
    'text-red-600';

  const kpis = [
    {
      label: 'Versendet (7T)',
      value: data.totalSent7d.toLocaleString('de-DE'),
      color: 'text-blue-700',
      bg: 'bg-blue-50',
    },
    {
      label: 'Zustellrate',
      value: `${data.overallDeliveryRatePct.toFixed(1)} %`,
      color: deliveryColor,
      bg: data.overallDeliveryRatePct >= 80 ? 'bg-matcha-50' : data.overallDeliveryRatePct >= 50 ? 'bg-amber-50' : 'bg-red-50',
    },
    {
      label: 'WA-Leserate',
      value: `${data.waReadRatePct.toFixed(1)} %`,
      color: waColor,
      bg: data.waReadRatePct >= 60 ? 'bg-matcha-50' : data.waReadRatePct >= 30 ? 'bg-amber-50' : 'bg-red-50',
    },
    {
      label: 'VAPID-Abos',
      value: data.vapidActiveSubs.toLocaleString('de-DE'),
      color: 'text-purple-700',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <Bell className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-char">Push-Benachrichtigungen</div>
          <div className="text-xs text-stone-400">Letzte 7 Tage · {data.channels.length} Kanäle</div>
        </div>
        <a
          href="/delivery/push-analytics"
          className="ml-auto flex items-center gap-1 text-[11px] font-bold text-matcha-600 hover:underline"
        >
          <TrendingUp className="h-3 w-3" />
          Details
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={cn('rounded-xl p-3', kpi.bg)}>
            <div className={cn('text-lg font-black tabular-nums', kpi.color)}>{kpi.value}</div>
            <div className="text-[10px] font-semibold text-stone-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Kanal-Zeilen */}
      {data.channels.length > 0 && (
        <div className="border-t border-stone-100 divide-y divide-stone-50">
          {data.channels.map((ch) => (
            <div key={ch.channel} className="flex items-center gap-3 px-5 py-2">
              <span className="w-28 shrink-0 text-[11px] font-semibold text-stone-600">
                {CHANNEL_LABELS[ch.channel] ?? ch.channel}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    ch.deliveryRatePct >= 80 ? 'bg-matcha-500' :
                    ch.deliveryRatePct >= 50 ? 'bg-amber-400' :
                    'bg-red-400',
                  )}
                  style={{ width: `${Math.min(100, ch.deliveryRatePct)}%` }}
                />
              </div>
              <span className={cn(
                'w-12 shrink-0 text-right text-[11px] font-bold tabular-nums',
                ch.deliveryRatePct >= 80 ? 'text-matcha-700' :
                ch.deliveryRatePct >= 50 ? 'text-amber-600' :
                'text-red-600',
              )}>
                {ch.deliveryRatePct.toFixed(0)} %
              </span>
              <span className="w-16 shrink-0 text-right text-[10px] text-stone-400 tabular-nums">
                {ch.sent7d.toLocaleString('de-DE')} versendet
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
