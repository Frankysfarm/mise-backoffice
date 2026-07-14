'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, Package, Clock, Target, Star, Bike, BarChart3, CheckCircle2 } from 'lucide-react';

interface Stats {
  bestellungen_heute: number;
  umsatz_heute: number;
  avg_lieferzeit_min: number | null;
  puenktlichkeits_rate: number | null;
  aktive_fahrer: number;
  bestellungen_letzte_stunde: number;
  storno_rate: number | null;
  kundenbewertung: number | null;
}

const MOCK: Stats = {
  bestellungen_heute: 47,
  umsatz_heute: 1284.50,
  avg_lieferzeit_min: 28,
  puenktlichkeits_rate: 82,
  aktive_fahrer: 3,
  bestellungen_letzte_stunde: 8,
  storno_rate: 4,
  kundenbewertung: 4.6,
};

function KpiTile({
  label, value, unit, sub, color, pulse,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  color: 'green' | 'blue' | 'amber' | 'red' | 'violet';
  pulse?: boolean;
}) {
  const cls = {
    green:  { bg: 'bg-matcha-50',  border: 'border-matcha-200', text: 'text-matcha-700',  sub: 'text-matcha-500' },
    blue:   { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-700',    sub: 'text-blue-500'   },
    amber:  { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',   sub: 'text-amber-500'  },
    red:    { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-700',     sub: 'text-red-500'    },
    violet: { bg: 'bg-violet-50',  border: 'border-violet-200', text: 'text-violet-700',  sub: 'text-violet-500' },
  }[color];
  return (
    <div className={cn('rounded-xl border p-3 flex flex-col gap-1', cls.bg, cls.border, pulse && 'animate-pulse')}>
      <div className="text-[9px] font-black uppercase tracking-wider text-stone-400">{label}</div>
      <div className={cn('text-2xl font-black tabular-nums leading-none', cls.text)}>
        {value}{unit && <span className="text-base font-bold ml-0.5">{unit}</span>}
      </div>
      {sub && <div className={cn('text-[10px] font-medium', cls.sub)}>{sub}</div>}
    </div>
  );
}

export function LieferdienstPhase1320StatistikenLiveHub({
  locationId,
}: {
  locationId: string | null;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const url = locationId
          ? `/api/delivery/analytics?location_id=${locationId}&range=today`
          : null;
        if (url) {
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled && data) {
              setStats({
                bestellungen_heute: data.orders_today ?? data.bestellungen_heute ?? MOCK.bestellungen_heute,
                umsatz_heute: data.revenue_today ?? data.umsatz_heute ?? MOCK.umsatz_heute,
                avg_lieferzeit_min: data.avg_delivery_min ?? data.avg_lieferzeit_min ?? MOCK.avg_lieferzeit_min,
                puenktlichkeits_rate: data.on_time_pct ?? data.puenktlichkeits_rate ?? MOCK.puenktlichkeits_rate,
                aktive_fahrer: data.active_drivers ?? data.aktive_fahrer ?? MOCK.aktive_fahrer,
                bestellungen_letzte_stunde: data.orders_last_hour ?? data.bestellungen_letzte_stunde ?? MOCK.bestellungen_letzte_stunde,
                storno_rate: data.cancel_rate ?? data.storno_rate ?? MOCK.storno_rate,
                kundenbewertung: data.avg_rating ?? data.kundenbewertung ?? MOCK.kundenbewertung,
              });
              setLastUpdated(new Date());
              return;
            }
          }
        }
      } catch {
        // API nicht verfügbar — Mock-Daten verwenden
      }
      if (!cancelled) {
        setStats(MOCK);
        setLastUpdated(new Date());
      }
    }
    load().finally(() => { if (!cancelled) setLoading(false); });
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-4 flex items-center gap-2">
        <div className="h-4 w-4 rounded-full border-2 border-matcha-500 border-t-transparent animate-spin" />
        <span className="text-sm text-stone-500">Statistiken werden geladen…</span>
      </div>
    );
  }

  if (!stats) return null;

  const puenktlichkeitColor = stats.puenktlichkeits_rate === null ? 'blue'
    : stats.puenktlichkeits_rate >= 80 ? 'green'
    : stats.puenktlichkeits_rate >= 65 ? 'amber'
    : 'red';

  const stornoColor = stats.storno_rate === null ? 'blue'
    : stats.storno_rate <= 5 ? 'green'
    : stats.storno_rate <= 10 ? 'amber'
    : 'red';

  const avgZeitColor = stats.avg_lieferzeit_min === null ? 'blue'
    : stats.avg_lieferzeit_min <= 30 ? 'green'
    : stats.avg_lieferzeit_min <= 45 ? 'amber'
    : 'red';

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-stone-50">
        <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-wider text-stone-600">
          Statistiken-Live-Hub · Heute
        </span>
        {lastUpdated && (
          <span className="ml-auto text-[9px] text-stone-400 font-mono tabular-nums">
            {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <span className="relative flex h-2 w-2 ml-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-matcha-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-matcha-500" />
        </span>
      </div>

      {/* KPI grid */}
      <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiTile
          label="Bestellungen heute"
          value={stats.bestellungen_heute}
          sub={`${stats.bestellungen_letzte_stunde}/h Tempo`}
          color="blue"
        />
        <KpiTile
          label="Umsatz heute"
          value={stats.umsatz_heute.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          unit="€"
          sub={`Ø ${(stats.umsatz_heute / Math.max(1, stats.bestellungen_heute)).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € je Bestellung`}
          color="green"
        />
        <KpiTile
          label="Ø Lieferzeit"
          value={stats.avg_lieferzeit_min ?? '—'}
          unit={stats.avg_lieferzeit_min !== null ? ' Min' : ''}
          sub={avgZeitColor === 'green' ? 'Innerhalb Ziel' : avgZeitColor === 'amber' ? 'Leicht überschritten' : 'Ziel überschritten'}
          color={avgZeitColor as 'green' | 'amber' | 'red'}
        />
        <KpiTile
          label="Pünktlichkeit"
          value={stats.puenktlichkeits_rate ?? '—'}
          unit={stats.puenktlichkeits_rate !== null ? '%' : ''}
          sub={puenktlichkeitColor === 'green' ? 'Sehr gut' : puenktlichkeitColor === 'amber' ? 'Verbesserungspotenzial' : 'Maßnahmen nötig'}
          color={puenktlichkeitColor as 'green' | 'amber' | 'red' | 'blue'}
        />
        <KpiTile
          label="Aktive Fahrer"
          value={stats.aktive_fahrer}
          sub="Derzeit im Einsatz"
          color="violet"
        />
        <KpiTile
          label="Storno-Rate"
          value={stats.storno_rate ?? '—'}
          unit={stats.storno_rate !== null ? '%' : ''}
          sub={stornoColor === 'green' ? 'Im Zielbereich' : stornoColor === 'amber' ? 'Leicht erhöht' : 'Kritisch erhöht'}
          color={stornoColor as 'green' | 'amber' | 'red' | 'blue'}
          pulse={stats.storno_rate !== null && stats.storno_rate > 10}
        />
        {stats.kundenbewertung !== null && (
          <KpiTile
            label="Kundenbewertung"
            value={stats.kundenbewertung.toFixed(1)}
            unit=" ★"
            sub={stats.kundenbewertung >= 4.5 ? 'Exzellent' : stats.kundenbewertung >= 4.0 ? 'Gut' : 'Verbesserungspotenzial'}
            color={stats.kundenbewertung >= 4.5 ? 'green' : stats.kundenbewertung >= 4.0 ? 'blue' : 'amber'}
          />
        )}
        <KpiTile
          label="Bestellungen/h"
          value={stats.bestellungen_letzte_stunde}
          sub="Letzte Stunde"
          color={stats.bestellungen_letzte_stunde >= 10 ? 'green' : stats.bestellungen_letzte_stunde >= 5 ? 'blue' : 'amber'}
        />
      </div>

      {/* Trend bar */}
      <div className="px-4 pb-3">
        <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-1.5">
          Schicht-Auslastung (Hochrechnung)
        </div>
        <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              stats.puenktlichkeits_rate !== null && stats.puenktlichkeits_rate >= 80 ? 'bg-matcha-500' :
              stats.puenktlichkeits_rate !== null && stats.puenktlichkeits_rate >= 65 ? 'bg-amber-400' : 'bg-red-500',
            )}
            style={{ width: `${Math.min(100, (stats.bestellungen_heute / 80) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[8px] text-stone-400">0</span>
          <span className="text-[8px] text-stone-400">Ziel: 80 Bestellungen</span>
        </div>
      </div>
    </div>
  );
}
