'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

const SLA_MINUTEN = 20;
const WARN_SCHWELLE = 0.25;

type OrderItem = {
  name: string;
  category?: string;
};

type Order = {
  id: string;
  bestellnummer?: string;
  items: OrderItem[] | string;
  status?: string;
  created_at?: string;
  promised_at?: string;
};

type StationStats = {
  station: string;
  gesamt: number;
  ueberschritten: number;
  rate: number;
  ø_wartezeit: number;
};

const STATION_KEYWORDS: Record<string, string> = {
  pizza: 'Ofen',
  flammkuchen: 'Ofen',
  auflauf: 'Ofen',
  burger: 'Grill',
  steak: 'Grill',
  schnitzel: 'Grill',
  pasta: 'Herd',
  suppe: 'Herd',
  curry: 'Herd',
  risotto: 'Herd',
  salat: 'Kalt',
  bowl: 'Kalt',
  wrap: 'Kalt',
  pommes: 'Friteuse',
  nuggets: 'Friteuse',
  chicken: 'Friteuse',
};

function getStation(items: OrderItem[] | string): string {
  const text = Array.isArray(items)
    ? items.map((i) => i.name.toLowerCase()).join(' ')
    : String(items).toLowerCase();
  for (const [kw, station] of Object.entries(STATION_KEYWORDS)) {
    if (text.includes(kw)) return station;
  }
  return 'Küche';
}

function getWartezeit(order: Order): number {
  const ref = order.created_at ? new Date(order.created_at).getTime() : Date.now();
  return Math.round((Date.now() - ref) / 60000);
}

export function KitchenPhase1054WartezeItSlaMonitor({ orders }: { orders: Order[] }) {
  const [open, setOpen] = useState(true);

  const { stationStats, gesamtRate, kritischeOrders } = useMemo(() => {
    const aktiv = orders.filter((o) =>
      ['neu', 'angenommen', 'wartend', 'in_zubereitung', 'pending'].includes(o.status ?? '')
    );

    const stationsMap = new Map<string, { gesamt: number; ueberschritten: number; wartezeiten: number[] }>();

    for (const o of aktiv) {
      const station = getStation(o.items);
      const warte = getWartezeit(o);
      const prev = stationsMap.get(station) ?? { gesamt: 0, ueberschritten: 0, wartezeiten: [] };
      stationsMap.set(station, {
        gesamt: prev.gesamt + 1,
        ueberschritten: prev.ueberschritten + (warte > SLA_MINUTEN ? 1 : 0),
        wartezeiten: [...prev.wartezeiten, warte],
      });
    }

    const stats: StationStats[] = [...stationsMap.entries()]
      .map(([station, d]) => ({
        station,
        gesamt: d.gesamt,
        ueberschritten: d.ueberschritten,
        rate: d.gesamt > 0 ? d.ueberschritten / d.gesamt : 0,
        ø_wartezeit: d.wartezeiten.length > 0
          ? Math.round(d.wartezeiten.reduce((s, v) => s + v, 0) / d.wartezeiten.length)
          : 0,
      }))
      .sort((a, b) => b.rate - a.rate);

    const gesamt = aktiv.length;
    const ueberschritten = aktiv.filter((o) => getWartezeit(o) > SLA_MINUTEN).length;
    const rate = gesamt > 0 ? ueberschritten / gesamt : 0;

    const krit = aktiv
      .filter((o) => getWartezeit(o) > SLA_MINUTEN)
      .sort((a, b) => getWartezeit(b) - getWartezeit(a))
      .slice(0, 5);

    return { stationStats: stats, gesamtRate: rate, kritischeOrders: krit };
  }, [orders]);

  if (gesamtRate < WARN_SCHWELLE && kritischeOrders.length === 0) return null;

  const ampel = gesamtRate >= 0.5 ? 'rot' : gesamtRate >= WARN_SCHWELLE ? 'amber' : 'gruen';
  const farben = {
    rot: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', icon: 'text-red-600 dark:text-red-400', badge: 'bg-red-600 text-white', bar: 'bg-red-500' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-500 text-white', bar: 'bg-amber-500' },
    gruen: { bg: 'bg-matcha-50 dark:bg-matcha-950/30', border: 'border-matcha-200 dark:border-matcha-800', icon: 'text-matcha-600 dark:text-matcha-400', badge: 'bg-matcha-600 text-white', bar: 'bg-matcha-500' },
  }[ampel];

  const empfehlungen: string[] = [];
  if (gesamtRate >= 0.5) empfehlungen.push('Sofort zusätzliche Kräfte an überlastete Stationen einsetzen');
  if (stationStats[0]?.rate >= 0.5) empfehlungen.push(`Station "${stationStats[0].station}" priorisieren`);
  if (gesamtRate >= 0.25) empfehlungen.push(`SLA ${SLA_MINUTEN} Min — Bestellungen über Grenze sofort starten`);

  return (
    <div className={cn('rounded-2xl border overflow-hidden', farben.bg, farben.border)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className={farben.icon} />
          <span className={cn('font-semibold text-sm', ampel === 'rot' ? 'text-red-800 dark:text-red-200' : ampel === 'amber' ? 'text-amber-800 dark:text-amber-200' : 'text-matcha-800 dark:text-matcha-200')}>
            SLA-Monitor — {Math.round(gesamtRate * 100)}% über {SLA_MINUTEN} Min
          </span>
          {gesamtRate >= WARN_SCHWELLE && (
            <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5 animate-pulse', farben.badge)}>
              {kritischeOrders.length} kritisch
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} className={farben.icon} /> : <ChevronDown size={14} className={farben.icon} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Station Drill-Down */}
          {stationStats.filter((s) => s.ueberschritten > 0).length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Clock size={10} />
                Wartezeit je Station
              </div>
              <div className="space-y-2">
                {stationStats
                  .filter((s) => s.gesamt > 0)
                  .map((s) => (
                    <div key={s.station} className="rounded-xl bg-white dark:bg-black/20 border border-white/50 p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">{s.station}</span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-muted-foreground">Ø {s.ø_wartezeit} Min</span>
                          <span className={cn(
                            'font-bold rounded px-1',
                            s.rate >= 0.5 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                              : s.rate >= 0.25 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300'
                          )}>
                            {s.ueberschritten}/{s.gesamt}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', s.rate >= 0.5 ? 'bg-red-500' : s.rate >= 0.25 ? 'bg-amber-500' : 'bg-matcha-500')}
                          style={{ width: `${Math.min(100, Math.round(s.rate * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Kritische Bestellungen */}
          {kritischeOrders.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Älteste Überschreitungen
              </div>
              <div className="flex flex-wrap gap-1.5">
                {kritischeOrders.map((o) => (
                  <span
                    key={o.id}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 px-2 py-1 text-[10px] font-bold text-red-700 dark:text-red-300"
                  >
                    #{o.bestellnummer ?? o.id.slice(-6)}
                    <span className="text-red-500 dark:text-red-400">+{getWartezeit(o) - SLA_MINUTEN} Min</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Empfehlungen */}
          {empfehlungen.length > 0 && (
            <div className="rounded-xl bg-white/60 dark:bg-black/20 border border-white/50 p-3 space-y-1">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                <Lightbulb size={10} />
                Empfehlung
              </div>
              {empfehlungen.map((e, i) => (
                <p key={i} className="text-xs text-foreground">→ {e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
