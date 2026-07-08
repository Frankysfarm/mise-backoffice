'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, ShoppingCart, ChevronRight } from 'lucide-react';

interface Props {
  locationId: string;
  userId?: string | null;
}

interface HistorieEintrag {
  id: string;
  bestellnummer: string;
  erstellt_am: string;
  gesamt_eur: number;
  status: string;
}

interface HistorieData {
  anzahl: number;
  letzte: HistorieEintrag | null;
}

function formatDatum(iso: string): string {
  const d = new Date(iso);
  const heute = new Date();
  const gestern = new Date(heute.getTime() - 86_400_000);

  if (d.toDateString() === heute.toDateString()) {
    return `Heute ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (d.toDateString() === gestern.toDateString()) {
    return `Gestern ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function Phase632BestellhistorieKurzansicht({ locationId, userId }: Props) {
  const [data, setData] = useState<HistorieData | null>(null);

  const laden = useCallback(async () => {
    if (!userId) return;
    try {
      const sb = createClient();
      const { data: orders } = await sb
        .from('orders')
        .select('id, bestellnummer, created_at, total_amount, status')
        .eq('location_id', locationId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!orders || orders.length === 0) return;

      const letzte = orders[0];
      setData({
        anzahl: orders.length,
        letzte: {
          id: letzte.id,
          bestellnummer: letzte.bestellnummer ?? `#${letzte.id.slice(0, 6).toUpperCase()}`,
          erstellt_am: letzte.created_at,
          gesamt_eur: Number(letzte.total_amount ?? 0),
          status: letzte.status,
        },
      });
    } catch {
      // silently ignore
    }
  }, [locationId, userId]);

  useEffect(() => {
    laden();
  }, [laden]);

  if (!data || !userId) return null;

  const { anzahl, letzte } = data;

  return (
    <div className="mb-4 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-sky-800 dark:text-sky-200">
            {anzahl === 1
              ? 'Deine erste Bestellung hier!'
              : `Du hast hier schon ${anzahl}× bestellt.`}
          </p>
          {letzte && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock className="h-2.5 w-2.5 text-sky-400 shrink-0" />
              <p className="text-[10px] text-sky-600 dark:text-sky-400 truncate">
                Zuletzt {formatDatum(letzte.erstellt_am)} · {letzte.bestellnummer} · {letzte.gesamt_eur.toFixed(2)} €
              </p>
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-sky-400 shrink-0" />
      </div>
    </div>
  );
}
