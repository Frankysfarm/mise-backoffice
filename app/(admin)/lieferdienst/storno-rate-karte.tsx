'use client';

/**
 * LieferdienstStornoRateKarte — Phase 345
 *
 * Kompaktes Widget für Lieferdienst-Cockpit: Stornierungsrate-Trend.
 * Zeigt Heute-KPIs + Top-Stornierer als Badge.
 */

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { ShieldAlert, ShieldX, Tag } from 'lucide-react';

interface Dashboard {
  todayAttempts: number;
  todayBlocked: number;
  todayVouchersOffered: number;
  blockRate: number;
  topCancellers: Array<{ customerId: string; count: number }>;
}

export function LieferdienstStornoRateKarte({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Dashboard | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    const res = await fetch(
      `/api/delivery/admin/cancellation-guard?action=dashboard&location_id=${locationId}`,
      { cache: 'no-store' },
    ).catch(() => null);
    if (res?.ok) setData(await res.json() as Dashboard);
  }, [locationId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  if (!data) return null;

  const blockRateColor =
    data.blockRate >= 30 ? 'text-red-700' :
    data.blockRate >= 15 ? 'text-amber-700' :
    'text-emerald-700';

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5 text-matcha-700" />
        Stornierungsschutz — Heute
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCell label="Versuche" value={data.todayAttempts} icon={<ShieldAlert className="h-3.5 w-3.5" />} />
        <StatCell label="Gesperrt" value={data.todayBlocked} icon={<ShieldX className="h-3.5 w-3.5" />} color="text-red-700" />
        <StatCell label="Voucher" value={data.todayVouchersOffered} icon={<Tag className="h-3.5 w-3.5" />} color="text-violet-700" />
      </div>

      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-xs text-muted-foreground">Blockierungsrate</span>
        <span className={`text-sm font-bold ${blockRateColor}`}>{data.blockRate}%</span>
      </div>

      {data.topCancellers.length > 0 && (
        <div className="border-t pt-2">
          <div className="text-[10px] text-muted-foreground font-medium mb-1.5">Top Stornierer (24h)</div>
          <div className="flex flex-wrap gap-1.5">
            {data.topCancellers.slice(0, 3).map((c) => (
              <span
                key={c.customerId}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  c.count >= 3 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {c.count}×
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function StatCell({
  label, value, icon, color = 'text-matcha-700',
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="text-center">
      <div className={`flex justify-center mb-0.5 ${color}`}>{icon}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
