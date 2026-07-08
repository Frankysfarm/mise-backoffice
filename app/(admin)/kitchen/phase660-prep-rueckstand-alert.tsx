'use client';

import { useMemo } from 'react';
import { AlertTriangle, Clock, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
};

type Timing = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

interface Props {
  orders: Order[];
  timings?: Timing[];
}

interface RueckstandEntry {
  orderId: string;
  bestellnummer: string;
  kundeName: string;
  sollMin: number;
  verstrichenMin: number;
  ueberschreitungPct: number;
  kategorie: 'leicht' | 'mittel' | 'kritisch';
}

export function KitchenPhase660PrepRueckstandAlert({ orders, timings = [] }: Props) {
  const now = Date.now();

  const rueckstaende = useMemo<RueckstandEntry[]>(() => {
    const timingMap = new Map<string, Timing>();
    for (const t of timings) timingMap.set(t.order_id, t);

    const result: RueckstandEntry[] = [];

    for (const o of orders) {
      if (o.status !== 'in_zubereitung') continue;

      const timing = timingMap.get(o.id);
      const cookStart = timing?.cook_start_at
        ? new Date(timing.cook_start_at).getTime()
        : o.bestellt_am ? new Date(o.bestellt_am).getTime() : null;

      if (!cookStart) continue;

      const sollMin = timing?.prep_min ?? o.geschaetzte_zubereitung_min ?? 12;
      const verstrichenMin = (now - cookStart) / 60_000;
      const schwelleMin = sollMin * 1.2; // +20% Toleranz

      if (verstrichenMin <= schwelleMin) continue;

      const ueberschreitungPct = Math.round(((verstrichenMin - sollMin) / sollMin) * 100);
      const kategorie: RueckstandEntry['kategorie'] =
        ueberschreitungPct >= 60 ? 'kritisch'
        : ueberschreitungPct >= 30 ? 'mittel'
        : 'leicht';

      result.push({
        orderId: o.id,
        bestellnummer: o.bestellnummer,
        kundeName: o.kunde_name,
        sollMin,
        verstrichenMin: Math.round(verstrichenMin),
        ueberschreitungPct,
        kategorie,
      });
    }

    return result.sort((a, b) => b.ueberschreitungPct - a.ueberschreitungPct);
  }, [orders, timings, now]);

  if (rueckstaende.length === 0) return null;

  const kritisch = rueckstaende.filter(r => r.kategorie === 'kritisch').length;
  const mittel = rueckstaende.filter(r => r.kategorie === 'mittel').length;

  const headerBg = kritisch > 0 ? 'bg-red-600' : mittel > 0 ? 'bg-amber-500' : 'bg-yellow-400';

  return (
    <div className="rounded-2xl border border-red-200 overflow-hidden">
      <div className={cn('flex items-center justify-between px-4 py-3', headerBg)}>
        <div className="flex items-center gap-2 text-white">
          <AlertTriangle className="h-4 w-4 animate-pulse" />
          <span className="text-sm font-bold uppercase tracking-wider">
            Prep-Rückstand — {rueckstaende.length} Bestellung{rueckstaende.length !== 1 ? 'en' : ''} überfällig
          </span>
        </div>
        <div className="flex items-center gap-2">
          {kritisch > 0 && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
              {kritisch}× KRITISCH
            </span>
          )}
          {mittel > 0 && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
              {mittel}× MITTEL
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-stone-100 bg-white">
        {rueckstaende.slice(0, 6).map(r => {
          const cardBg = r.kategorie === 'kritisch'
            ? 'bg-red-50'
            : r.kategorie === 'mittel' ? 'bg-amber-50' : 'bg-yellow-50';
          const badgeColor = r.kategorie === 'kritisch'
            ? 'bg-red-100 text-red-700'
            : r.kategorie === 'mittel' ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700';
          const barColor = r.kategorie === 'kritisch'
            ? 'bg-red-500'
            : r.kategorie === 'mittel' ? 'bg-amber-500' : 'bg-yellow-400';

          const barWidth = Math.min(100, (r.verstrichenMin / (r.sollMin * 2)) * 100);

          return (
            <div key={r.orderId} className={cn('flex items-center gap-3 px-4 py-3', cardBg)}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-stone-200">
                <Flame className={cn('h-5 w-5', r.kategorie === 'kritisch' ? 'text-red-600' : 'text-amber-500')} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-stone-800 truncate">#{r.bestellnummer} · {r.kundeName}</span>
                  <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase', badgeColor)}>
                    +{r.ueberschreitungPct}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                    <div className={cn('h-full rounded-full', barColor)} style={{ width: `${barWidth}%` }} />
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-stone-500 shrink-0">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{r.verstrichenMin} / {r.sollMin} Min</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {rueckstaende.length > 6 && (
        <div className="bg-stone-50 px-4 py-2 text-center text-[11px] text-stone-500 border-t border-stone-100">
          +{rueckstaende.length - 6} weitere Bestellungen im Rückstand
        </div>
      )}
    </div>
  );
}
