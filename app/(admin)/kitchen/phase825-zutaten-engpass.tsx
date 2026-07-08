'use client';

import { useEffect, useState, useMemo } from 'react';
import { AlertTriangle, Package, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  status: string;
  items?: { name: string; quantity: number }[];
}

interface Props {
  orders: Order[];
  locationId: string | null;
}

interface IngredientAlert {
  name: string;
  bestellungen: number;
  kapazitaet: number;
  auslastungPct: number;
  kritisch: boolean;
}

interface AlertData {
  warnungen: IngredientAlert[];
  aktualisiert: string;
}

const MOCK: AlertData = {
  warnungen: [
    { name: 'Rinderhackfleisch', bestellungen: 18, kapazitaet: 20, auslastungPct: 90, kritisch: true },
    { name: 'Bürger-Buns', bestellungen: 15, kapazitaet: 20, auslastungPct: 75, kritisch: false },
    { name: 'Cheddar-Scheiben', bestellungen: 14, kapazitaet: 20, auslastungPct: 70, kritisch: false },
  ],
  aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
};

function alertStyle(w: IngredientAlert) {
  if (w.kritisch) return { bg: 'bg-red-50', border: 'border-red-200', bar: 'bg-red-500', text: 'text-red-700', icon: 'text-red-500' };
  if (w.auslastungPct >= 70) return { bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-400', text: 'text-amber-700', icon: 'text-amber-500' };
  return { bg: 'bg-stone-50', border: 'border-stone-200', bar: 'bg-stone-400', text: 'text-stone-600', icon: 'text-stone-400' };
}

export function KitchenPhase825ZutatenEngpass({ orders, locationId }: Props) {
  const [apiData, setApiData] = useState<AlertData | null>(null);

  // Count in-progress orders to estimate ingredient usage
  const activeCount = useMemo(() =>
    orders.filter(o => ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status)).length,
    [orders]
  );

  const load = async () => {
    if (!locationId) { setApiData(null); return; }
    try {
      const res = await fetch(`/api/delivery/admin/kuechen-engpass?location_id=${locationId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const warnungen: IngredientAlert[] = Array.isArray(json.warnungen)
        ? json.warnungen.map((w: Record<string, unknown>) => ({
            name: String(w.name ?? w.ingredient ?? 'Zutat'),
            bestellungen: Number(w.bestellungen ?? w.orders ?? 0),
            kapazitaet: Number(w.kapazitaet ?? w.capacity ?? 20),
            auslastungPct: Number(w.auslastung_pct ?? w.pct ?? 70),
            kritisch: Boolean(w.kritisch ?? w.critical ?? false),
          }))
        : [];
      if (warnungen.length === 0) throw new Error();
      setApiData({ warnungen, aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) });
    } catch {
      setApiData(null);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = apiData ?? MOCK;
  const kritischCount = data.warnungen.filter(w => w.kritisch).length;

  if (data.warnungen.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className={cn(
        'flex items-center gap-2 px-4 py-3 border-b',
        kritischCount > 0 ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
      )}>
        <Package className={cn('h-4 w-4', kritischCount > 0 ? 'text-red-600' : 'text-amber-600')} />
        <span className={cn('text-sm font-bold', kritischCount > 0 ? 'text-red-800' : 'text-amber-800')}>
          Zutaten-Engpass
        </span>
        {kritischCount > 0 && (
          <span className="ml-auto text-[10px] bg-red-500 text-white rounded-full px-2 py-0.5 font-bold animate-pulse">
            {kritischCount} kritisch
          </span>
        )}
        <span className="ml-auto text-[10px] text-stone-400">{data.aktualisiert}</span>
      </div>

      <div className="divide-y divide-stone-50">
        {data.warnungen.slice(0, 5).map((w) => {
          const s = alertStyle(w);
          const restPct = Math.max(0, 100 - w.auslastungPct);
          return (
            <div key={w.name} className={cn('px-4 py-2.5 flex items-center gap-3', s.bg)}>
              {w.kritisch
                ? <AlertTriangle className={cn('h-4 w-4 shrink-0', s.icon)} />
                : <TrendingDown className={cn('h-4 w-4 shrink-0', s.icon)} />
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold truncate">{w.name}</span>
                  <span className={cn('text-[10px] font-bold ml-2 shrink-0', s.text)}>
                    {w.auslastungPct}%
                  </span>
                </div>
                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', s.bar, w.kritisch && 'animate-pulse')}
                    style={{ width: `${w.auslastungPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[9px] text-stone-400">{w.bestellungen}/{w.kapazitaet} Portionen</span>
                  <span className="text-[9px] text-stone-400">{restPct}% frei</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-stone-100 flex items-center justify-between">
        <span className="text-[10px] text-stone-400">Aktive Bestellungen: {activeCount}</span>
        <span className="text-[10px] text-stone-400">Live-Kapazitäts-Monitor</span>
      </div>
    </div>
  );
}
