'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Package, TrendingUp, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface DemandAlert {
  itemName: string;
  alertLevel: 'warning' | 'critical';
  daysUntilDepletion: number | null;
  suggestedOrderQty: number | null;
  unit?: string;
}

interface TopItem {
  itemName: string;
  avgDailyDemand: number;
  unit: string;
}

interface Props {
  locationId?: string;
  className?: string;
}

export function DispatchItemNachfrageHinweis({ locationId, className }: Props) {
  const [alerts, setAlerts] = useState<DemandAlert[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/delivery/admin/item-demand?action=alerts&location_id=${locationId}`)
        .then((r) => r.json()),
      fetch(`/api/delivery/admin/item-demand?action=dashboard&location_id=${locationId}`)
        .then((r) => r.json()),
    ])
      .then(([alertsRes, dashRes]) => {
        if (alertsRes.ok) setAlerts(alertsRes.alerts ?? []);
        if (dashRes.ok) setTopItems(dashRes.dashboard?.topDemandItems ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  if (!locationId) return null;

  const critical = alerts.filter((a) => a.alertLevel === 'critical');
  const warnings = alerts.filter((a) => a.alertLevel === 'warning');
  const hasIssues = alerts.length > 0;

  if (!hasIssues && topItems.length === 0 && !loading) return null;

  return (
    <div className={cn('rounded-xl border bg-white overflow-hidden', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition text-left"
      >
        <Package className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="flex-1 text-xs font-bold uppercase tracking-wider">
          Artikel-Nachfrage
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {critical.length > 0 && (
          <span className="rounded-full bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5">
            {critical.length} Kritisch
          </span>
        )}
        {warnings.length > 0 && (
          <span className="rounded-full bg-amber-400 text-white text-[9px] font-black px-1.5 py-0.5">
            {warnings.length} Warnung
          </span>
        )}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t">
          {/* Critical / Warning Alerts */}
          {alerts.length > 0 && (
            <div className="divide-y">
              {alerts.slice(0, 5).map((alert, i) => (
                <div key={i} className={cn(
                  'flex items-center gap-3 px-4 py-2',
                  alert.alertLevel === 'critical' ? 'bg-red-50/60' : 'bg-amber-50/60',
                )}>
                  <AlertTriangle className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    alert.alertLevel === 'critical' ? 'text-red-500' : 'text-amber-500',
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold truncate">{alert.itemName}</div>
                    {alert.daysUntilDepletion !== null && (
                      <div className={cn(
                        'text-[10px] font-semibold',
                        alert.daysUntilDepletion <= 1 ? 'text-red-600' : 'text-amber-600',
                      )}>
                        ~{alert.daysUntilDepletion}d bis leer
                      </div>
                    )}
                  </div>
                  {alert.suggestedOrderQty !== null && (
                    <span className="text-[10px] font-black text-matcha-700 shrink-0">
                      → {alert.suggestedOrderQty} {alert.unit ?? 'Stk'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Top-demand items */}
          {topItems.length > 0 && (
            <div className="px-4 py-3 border-t">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Höchste Tages-Nachfrage
                </span>
              </div>
              <div className="space-y-1.5">
                {topItems.slice(0, 4).map((item, i) => {
                  const maxDemand = topItems[0]?.avgDailyDemand ?? 1;
                  const pct = Math.round((item.avgDailyDemand / maxDemand) * 100);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-32 shrink-0 text-[11px] font-medium truncate">{item.itemName}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-matcha-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-14 text-right text-[10px] font-bold tabular-nums text-matcha-700 shrink-0">
                        {item.avgDailyDemand.toFixed(1)}/d
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {alerts.length === 0 && topItems.length === 0 && (
            <div className="px-4 py-3 text-[11px] text-muted-foreground">
              Keine Lager-Daten vorhanden.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
