'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Gift, Users, TrendingUp, Clock } from 'lucide-react';

type Dashboard = {
  totalPoolEurToday: number;
  approvedEurToday: number;
  pendingEurToday: number;
  activeDriversWithIncentives: number;
  totalEventsToday: number;
  topEarner: { driverName: string | null; bonusEur: number } | null;
};

export function IncentiveTagesUebersicht({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/driver-incentives?action=dashboard&location_id=${encodeURIComponent(locationId)}`,
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.ok) setData(json.dashboard);
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (loading || !data) return null;

  const kpis: { label: string; value: string; sub?: string; icon: React.ReactNode; accent: string }[] = [
    {
      label: 'Bonus-Pool heute',
      value: `${data.totalPoolEurToday.toFixed(2)} €`,
      icon: <Gift className="h-4 w-4" />,
      accent: 'text-emerald-600',
    },
    {
      label: 'Genehmigt',
      value: `${data.approvedEurToday.toFixed(2)} €`,
      icon: <TrendingUp className="h-4 w-4" />,
      accent: 'text-emerald-600',
    },
    {
      label: 'Ausstehend',
      value: `${data.pendingEurToday.toFixed(2)} €`,
      icon: <Clock className="h-4 w-4" />,
      accent: 'text-yellow-600',
    },
    {
      label: 'Fahrer mit Boni',
      value: String(data.activeDriversWithIncentives),
      sub: `${data.totalEventsToday} Ereignisse`,
      icon: <Users className="h-4 w-4" />,
      accent: 'text-blue-600',
    },
  ];

  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold">Fahrer-Incentives</span>
        </div>
        {data.topEarner && (
          <div className="text-xs text-muted-foreground">
            🏆 Top:{' '}
            <span className="font-medium text-foreground">{data.topEarner.driverName}</span>
            {' '}+{data.topEarner.bonusEur.toFixed(2)} €
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-muted/40 rounded-lg p-3 space-y-1">
            <div className={cn('flex items-center gap-1.5', kpi.accent)}>
              {kpi.icon}
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <div className={cn('text-lg font-bold', kpi.accent)}>{kpi.value}</div>
            {kpi.sub && (
              <div className="text-[11px] text-muted-foreground">{kpi.sub}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
