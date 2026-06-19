'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Loader2, Package, TrendingUp, XCircle } from 'lucide-react';

interface DemandAlert {
  itemName: string;
  alertLevel: 'warning' | 'critical';
  currentStock: number;
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

export function LieferdienstItemNachfrageWidget({ locationId, className }: Props) {
  const [alerts, setAlerts] = useState<DemandAlert[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [totalTracked, setTotalTracked] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/item-demand?action=dashboard&location_id=${locationId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.dashboard) {
          setAlerts(j.dashboard.openAlerts ?? []);
          setTopItems(j.dashboard.topDemandItems ?? []);
          setTotalTracked(j.dashboard.totalTrackedItems ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  if (!locationId || (totalTracked === 0 && !loading)) return null;

  const critical = alerts.filter((a) => a.alertLevel === 'critical');
  const warnings = alerts.filter((a) => a.alertLevel === 'warning');
  const allOk = alerts.length === 0 && totalTracked > 0;

  return (
    <div className={cn('rounded-2xl border border-stone-200 bg-white', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <Package className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-char">Artikel-Nachfrage & Lager</div>
          <div className="text-xs text-stone-400">{totalTracked} verfolgte Artikel</div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
      </div>

      {/* Status summary */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-stone-100">
        {allOk && (
          <div className="flex items-center gap-2 text-matcha-700 text-sm">
            <CheckCircle2 className="h-4 w-4 text-matcha-500" />
            <span className="font-semibold">Alle Lager im grünen Bereich</span>
          </div>
        )}
        {critical.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-red-100 text-red-700 px-3 py-1 text-[11px] font-black">
            <XCircle className="h-3.5 w-3.5" />
            {critical.length} kritisch
          </div>
        )}
        {warnings.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-[11px] font-black">
            <AlertTriangle className="h-3.5 w-3.5" />
            {warnings.length} Warnung
          </div>
        )}
      </div>

      {/* Alerts list */}
      {alerts.length > 0 && (
        <div className="divide-y divide-stone-100 max-h-44 overflow-y-auto">
          {alerts.slice(0, 6).map((alert, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-2.5">
              {alert.alertLevel === 'critical'
                ? <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                : <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold truncate">{alert.itemName}</div>
                <div className="text-[10px] text-stone-400">
                  {alert.currentStock} {alert.unit ?? 'Stk'} lagernd
                  {alert.daysUntilDepletion !== null && ` · ~${alert.daysUntilDepletion}d bis leer`}
                </div>
              </div>
              {alert.suggestedOrderQty !== null && (
                <div className="shrink-0 text-right">
                  <div className="text-[11px] font-black text-matcha-700">
                    {alert.suggestedOrderQty} {alert.unit ?? 'Stk'}
                  </div>
                  <div className="text-[9px] text-stone-400">empfohlen</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Top demand */}
      {topItems.length > 0 && (
        <div className="px-5 py-4 border-t border-stone-100">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Top-Nachfrage heute
            </span>
          </div>
          <div className="space-y-2">
            {topItems.slice(0, 4).map((item, i) => {
              const maxD = topItems[0]?.avgDailyDemand ?? 1;
              const pct = Math.round((item.avgDailyDemand / maxD) * 100);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-[11px] text-char font-medium truncate">{item.itemName}</span>
                  <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full bg-matcha-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-[10px] font-bold text-matcha-700 tabular-nums">
                    {item.avgDailyDemand.toFixed(1)}/Tag
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
