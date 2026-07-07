'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Clock, ChefHat } from 'lucide-react';

interface Order {
  id: string;
  order_number?: string | number;
  status: string;
  created_at: string;
  confirmed_at?: string | null;
  prep_started_at?: string | null;
  customer?: { vorname?: string; nachname?: string } | null;
  items?: { name?: string }[];
}

interface AlarmOrder {
  id: string;
  nummer: string;
  status: string;
  vergangenMinuten: number;
  slaGrenze: number;
  kundenName: string;
}

const SLA_GRENZEN: Record<string, number> = {
  bestätigt: 10,
  in_zubereitung: 20,
  fertig: 30,
};

const STATUS_LABEL: Record<string, string> = {
  bestätigt: 'Warten auf Start',
  in_zubereitung: 'In Zubereitung',
  fertig: 'Wartet auf Abholung',
};

function minSeit(ts: string | null | undefined): number {
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
}

export function KitchenPhase606DringendeBestellungenAlarm({
  orders,
}: {
  orders: Order[];
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const alarmOrders: AlarmOrder[] = orders
    .filter((o) => ['bestätigt', 'in_zubereitung', 'fertig'].includes(o.status))
    .map((o) => {
      const grenze = SLA_GRENZEN[o.status] ?? 15;
      const refTs =
        o.status === 'bestätigt'
          ? o.confirmed_at ?? o.created_at
          : o.status === 'in_zubereitung'
          ? o.prep_started_at ?? o.confirmed_at ?? o.created_at
          : o.created_at;
      const min = minSeit(refTs);
      return {
        id: o.id,
        nummer: String(o.order_number ?? o.id.slice(-6)),
        status: o.status,
        vergangenMinuten: min,
        slaGrenze: grenze,
        kundenName: o.customer
          ? `${o.customer.vorname ?? ''} ${o.customer.nachname ?? ''}`.trim()
          : '–',
      };
    })
    .filter((o) => o.vergangenMinuten >= o.slaGrenze - 3)
    .sort((a, b) => b.vergangenMinuten - a.vergangenMinuten);

  if (alarmOrders.length === 0) return null;

  const kritisch = alarmOrders.filter((o) => o.vergangenMinuten >= o.slaGrenze);
  const beinahe = alarmOrders.filter((o) => o.vergangenMinuten < o.slaGrenze);

  return (
    <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 shadow-sm mb-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 animate-pulse" />
        <h3 className="text-sm font-bold text-red-800 dark:text-red-300">
          SLA-Alarm — {alarmOrders.length} Bestellung{alarmOrders.length !== 1 ? 'en' : ''} kritisch
        </h3>
      </div>

      <div className="space-y-2">
        {kritisch.map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between rounded-lg bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-red-700 dark:text-red-300">🚨</span>
              <div>
                <span className="text-xs font-bold text-red-800 dark:text-red-200">
                  #{o.nummer}
                </span>
                {o.kundenName !== '–' && (
                  <span className="ml-1 text-xs text-red-600 dark:text-red-400">
                    {o.kundenName}
                  </span>
                )}
                <div className="text-xs text-red-600 dark:text-red-400">
                  {STATUS_LABEL[o.status] ?? o.status}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-red-700 dark:text-red-300 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {o.vergangenMinuten} Min
              </div>
              <div className="text-xs text-red-500 dark:text-red-400">
                +{o.vergangenMinuten - o.slaGrenze} Min überzogen
              </div>
            </div>
          </div>
        ))}

        {beinahe.map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="text-xs font-bold text-amber-800 dark:text-amber-200">
                  #{o.nummer}
                </span>
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  {STATUS_LABEL[o.status] ?? o.status} — {o.slaGrenze - o.vergangenMinuten} Min verbleibend
                </div>
              </div>
            </div>
            <div className="text-sm font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {o.vergangenMinuten} Min
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
