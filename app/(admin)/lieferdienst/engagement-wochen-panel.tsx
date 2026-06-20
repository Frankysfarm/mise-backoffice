'use client';

// Phase 350 — LieferdienstEngagementWochenPanel
// Wöchentliche Engagement-Übersicht im Lieferdienst-Cockpit

import { useEffect, useState } from 'react';
import { Trophy, Users, Zap, Award, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Dashboard {
  weekStart: string;
  topDriver: { driverName: string | null; weeklyPoints: number; deliveries: number; onTimeRate: number | null } | null;
  totalDriversWithPoints: number;
  totalPointsAwarded: number;
  totalBadgesEarned: number;
  avgWeeklyPoints: number;
}

interface Props {
  locationId: string | null;
}

export function LieferdienstEngagementWochenPanel({ locationId }: Props) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let alive = true;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/delivery/admin/driver-engagement?action=dashboard&location_id=${locationId}`,
        );
        if (!res.ok || !alive) return;
        setData(await res.json() as Dashboard);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    const iv = setInterval(load, 300_000);
    return () => { alive = false; clearInterval(iv); };
  }, [locationId]);

  if (!data) return null;

  const kpis = [
    { label: 'Fahrer aktiv', value: data.totalDriversWithPoints, icon: <Users className="h-4 w-4" />, color: 'text-matcha-700', bg: 'bg-matcha-50' },
    { label: 'Punkte vergeben', value: data.totalPointsAwarded.toLocaleString('de-DE'), icon: <Zap className="h-4 w-4" />, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'Abzeichen', value: data.totalBadgesEarned, icon: <Award className="h-4 w-4" />, color: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'Ø Punkte', value: data.avgWeeklyPoints, icon: <Trophy className="h-4 w-4" />, color: 'text-purple-700', bg: 'bg-purple-50' },
  ];

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-amber-500" />
        <span className="font-semibold text-sm">Engagement — KW ab {data.weekStart}</span>
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`rounded-xl p-2 ${kpi.bg}`}>
            <div className={`flex items-center gap-1 mb-0.5 ${kpi.color}`}>
              {kpi.icon}
              <span className="text-lg font-black">{kpi.value}</span>
            </div>
            <div className="text-[10px] text-stone-500">{kpi.label}</div>
          </div>
        ))}
      </div>

      {data.topDriver && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 flex items-center gap-3">
          <span className="text-xl">🥇</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{data.topDriver.driverName ?? 'Fahrer'}</div>
            <div className="text-[11px] text-stone-500">
              {data.topDriver.deliveries} Liefg.
              {data.topDriver.onTimeRate !== null
                ? ` · ${data.topDriver.onTimeRate.toFixed(0)}% pünktlich`
                : ''}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-base font-black text-amber-700">{data.topDriver.weeklyPoints}</div>
            <div className="text-[10px] text-stone-400">Punkte</div>
          </div>
        </div>
      )}
    </Card>
  );
}
