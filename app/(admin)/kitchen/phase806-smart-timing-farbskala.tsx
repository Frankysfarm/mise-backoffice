'use client';

import { useEffect, useState } from 'react';
import { Palette, Clock } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface TimingFarbe {
  label: string;
  minuten: number;
  farbe: string;
  bgFarbe: string;
  borderFarbe: string;
  anzahl: number;
}

interface FarbskalaData {
  eintraege: TimingFarbe[];
  gesamt: number;
  aktualisiert: string;
}

const MOCK: FarbskalaData = {
  gesamt: 14,
  aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  eintraege: [
    { label: 'Pünktlich', minuten: 0, farbe: 'text-emerald-700 dark:text-emerald-400', bgFarbe: 'bg-emerald-100 dark:bg-emerald-900/30', borderFarbe: 'border-emerald-300 dark:border-emerald-700', anzahl: 6 },
    { label: 'Leicht spät', minuten: 5, farbe: 'text-amber-700 dark:text-amber-400', bgFarbe: 'bg-amber-100 dark:bg-amber-900/30', borderFarbe: 'border-amber-300 dark:border-amber-700', anzahl: 4 },
    { label: 'Kritisch', minuten: 10, farbe: 'text-orange-700 dark:text-orange-400', bgFarbe: 'bg-orange-100 dark:bg-orange-900/30', borderFarbe: 'border-orange-300 dark:border-orange-700', anzahl: 3 },
    { label: 'Überfällig', minuten: 15, farbe: 'text-red-700 dark:text-red-400', bgFarbe: 'bg-red-100 dark:bg-red-900/30', borderFarbe: 'border-red-300 dark:border-red-700', anzahl: 1 },
  ],
};

export function KitchenPhase806SmartTimingFarbskala({ locationId }: Props) {
  const [data, setData] = useState<FarbskalaData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/delivery/kitchen/queue?location_id=${locationId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch');
      const json = await res.json();
      const orders = Array.isArray(json.orders) ? json.orders : [];
      const gesamt = orders.length;
      const puenktlich = orders.filter((o: { delay_min?: number }) => (o.delay_min ?? 0) <= 0).length;
      const leichtSpaet = orders.filter((o: { delay_min?: number }) => (o.delay_min ?? 0) > 0 && (o.delay_min ?? 0) <= 5).length;
      const kritisch = orders.filter((o: { delay_min?: number }) => (o.delay_min ?? 0) > 5 && (o.delay_min ?? 0) <= 10).length;
      const ueberfaellig = orders.filter((o: { delay_min?: number }) => (o.delay_min ?? 0) > 10).length;
      setData({
        gesamt,
        aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        eintraege: [
          { ...MOCK.eintraege[0], anzahl: puenktlich },
          { ...MOCK.eintraege[1], anzahl: leichtSpaet },
          { ...MOCK.eintraege[2], anzahl: kritisch },
          { ...MOCK.eintraege[3], anzahl: ueberfaellig },
        ],
      });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 20_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="h-20 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold">Smart-Timing Farbskala</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          {data.aktualisiert}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {data.eintraege.map((e) => (
          <div
            key={e.label}
            className={`rounded-lg border px-2 py-2 text-center ${e.bgFarbe} ${e.borderFarbe}`}
          >
            <div className={`text-xl font-black tabular-nums ${e.farbe}`}>{e.anzahl}</div>
            <div className={`text-[9px] font-medium mt-0.5 ${e.farbe}`}>{e.label}</div>
            {e.minuten > 0 && (
              <div className="text-[8px] text-muted-foreground mt-0.5">+{e.minuten}m</div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">
          {data.gesamt} Bestellungen gesamt
        </span>
        <div className="flex items-center gap-1">
          {data.eintraege.map((e) => (
            <div
              key={e.label}
              className={`h-2 rounded-full ${e.bgFarbe.split(' ')[0]} border ${e.borderFarbe.split(' ')[0]}`}
              style={{ width: `${Math.max(4, data.gesamt > 0 ? (e.anzahl / data.gesamt) * 60 : 0)}px` }}
              title={`${e.label}: ${e.anzahl}`}
            />
          ))}
        </div>
      </div>
      <p className="mt-1 text-[9px] text-muted-foreground">20s-Update · Farbcodierung nach Zeitverzug</p>
    </div>
  );
}
