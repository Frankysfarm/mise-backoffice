'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { Calendar, TrendingUp, TrendingDown, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';

interface TagDaten {
  wochentag: string;
  kurz: string;
  bestellungen: number;
  umsatzEur: number;
  pünktlichPct: number;
  fahrer: number;
}

interface WochenBilanz {
  tage: TagDaten[];
  gesamtUmsatz: number;
  gesamtBestellungen: number;
  avgPünktlichPct: number;
  bestTag: string;
  schlechtesterTag: string;
  vsVorwoche: number; // percent delta
}

const MOCK: WochenBilanz = {
  tage: [
    { wochentag: 'Montag',    kurz: 'Mo', bestellungen: 42, umsatzEur: 840,  pünktlichPct: 91, fahrer: 4 },
    { wochentag: 'Dienstag',  kurz: 'Di', bestellungen: 38, umsatzEur: 760,  pünktlichPct: 88, fahrer: 3 },
    { wochentag: 'Mittwoch',  kurz: 'Mi', bestellungen: 55, umsatzEur: 1100, pünktlichPct: 84, fahrer: 5 },
    { wochentag: 'Donnerstag',kurz: 'Do', bestellungen: 61, umsatzEur: 1220, pünktlichPct: 79, fahrer: 5 },
    { wochentag: 'Freitag',   kurz: 'Fr', bestellungen: 88, umsatzEur: 1760, pünktlichPct: 76, fahrer: 7 },
    { wochentag: 'Samstag',   kurz: 'Sa', bestellungen: 102,umsatzEur: 2040, pünktlichPct: 72, fahrer: 8 },
    { wochentag: 'Sonntag',   kurz: 'So', bestellungen: 74, umsatzEur: 1480, pünktlichPct: 85, fahrer: 6 },
  ],
  gesamtUmsatz: 9200,
  gesamtBestellungen: 460,
  avgPünktlichPct: 82,
  bestTag: 'Samstag',
  schlechtesterTag: 'Samstag',
  vsVorwoche: 8.4,
};

function barColor(pct: number) {
  if (pct >= 85) return 'bg-matcha-500';
  if (pct >= 70) return 'bg-amber-400';
  return 'bg-red-400';
}

export function WochenBilanzKarte({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<WochenBilanz | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'umsatz' | 'bestellungen' | 'pünktlichkeit'>('umsatz');

  useEffect(() => {
    if (!locationId) {
      setData(MOCK);
      return;
    }
    setLoading(true);
    fetch(`/api/delivery/admin/weekly-summary?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.tage?.length > 0) setData(d as WochenBilanz);
        else setData(MOCK);
      })
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, [locationId]);

  const d = data ?? MOCK;
  const maxUmsatz = Math.max(...d.tage.map((t) => t.umsatzEur), 1);
  const maxBestellungen = Math.max(...d.tage.map((t) => t.bestellungen), 1);

  function barHeight(tag: TagDaten) {
    if (view === 'umsatz') return (tag.umsatzEur / maxUmsatz) * 100;
    if (view === 'bestellungen') return (tag.bestellungen / maxBestellungen) * 100;
    return tag.pünktlichPct;
  }

  function barLabel(tag: TagDaten) {
    if (view === 'umsatz') return euro(tag.umsatzEur);
    if (view === 'bestellungen') return tag.bestellungen.toString();
    return `${tag.pünktlichPct}%`;
  }

  const today = new Date().getDay(); // 0=Sun, 1=Mon...
  const dayMap: Record<string, number> = { Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 0 };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 shrink-0">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-stone-800">Wochenbilanz</div>
            <div className="text-xs text-stone-400">
              {euro(d.gesamtUmsatz)} · {d.gesamtBestellungen} Bestellungen
              {d.vsVorwoche !== 0 && (
                <span className={cn('ml-2 font-bold', d.vsVorwoche > 0 ? 'text-matcha-600' : 'text-red-500')}>
                  {d.vsVorwoche > 0 ? '+' : ''}{d.vsVorwoche.toFixed(1)}% vs. Vorwoche
                </span>
              )}
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t">
          {/* KPI summary */}
          <div className="grid grid-cols-3 divide-x border-b">
            <div className="px-3 py-2.5 text-center">
              <div className="text-base font-black tabular-nums text-matcha-700">{euro(d.gesamtUmsatz)}</div>
              <div className="text-[9px] text-stone-400">Umsatz</div>
            </div>
            <div className="px-3 py-2.5 text-center">
              <div className="text-base font-black tabular-nums">{d.gesamtBestellungen}</div>
              <div className="text-[9px] text-stone-400">Bestellungen</div>
            </div>
            <div className="px-3 py-2.5 text-center">
              <div className={cn(
                'text-base font-black tabular-nums',
                d.avgPünktlichPct >= 85 ? 'text-matcha-700' : d.avgPünktlichPct >= 70 ? 'text-amber-600' : 'text-red-600',
              )}>
                {d.avgPünktlichPct}%
              </div>
              <div className="text-[9px] text-stone-400">Ø Pünktlich</div>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex gap-1 p-3 border-b bg-muted/20">
            {(['umsatz', 'bestellungen', 'pünktlichkeit'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'flex-1 rounded-lg py-1 text-[10px] font-bold capitalize transition',
                  view === v
                    ? 'bg-matcha-600 text-white'
                    : 'bg-white border text-stone-500 hover:bg-muted/50',
                )}
              >
                {v === 'pünktlichkeit' ? 'Pünktl.' : v === 'bestellungen' ? 'Bestellg.' : 'Umsatz'}
              </button>
            ))}
          </div>

          {/* Bar chart */}
          <div className="px-4 pt-3 pb-4">
            <div className="flex items-end gap-1.5 h-24">
              {d.tage.map((tag) => {
                const h = barHeight(tag);
                const isToday = dayMap[tag.kurz] === today;
                const colorClass = view === 'pünktlichkeit' ? barColor(tag.pünktlichPct) : 'bg-matcha-400';
                return (
                  <div key={tag.kurz} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full flex flex-col items-center justify-end" style={{ height: 72 }}>
                      <div
                        className={cn('w-full rounded-t-md transition-all duration-700', colorClass, isToday && 'ring-2 ring-matcha-600 ring-offset-1')}
                        style={{ height: `${Math.max(4, h * 0.72)}px` }}
                        title={`${tag.wochentag}: ${barLabel(tag)}`}
                      />
                    </div>
                    <div className={cn('text-[9px] font-bold tabular-nums', isToday ? 'text-matcha-700' : 'text-stone-400')}>
                      {tag.kurz}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Best/worst */}
            <div className="mt-3 flex items-center gap-3 text-[10px] text-stone-400">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-matcha-600" />
                <span>Bester Tag: <strong className="text-stone-700">{d.bestTag}</strong></span>
              </div>
              <div className="w-px h-3 bg-stone-200" />
              <div className={cn('flex items-center gap-1', d.vsVorwoche >= 0 ? 'text-matcha-600' : 'text-red-500')}>
                {d.vsVorwoche >= 0
                  ? <TrendingUp className="h-3 w-3" />
                  : <TrendingDown className="h-3 w-3" />}
                <span>{d.vsVorwoche >= 0 ? '+' : ''}{d.vsVorwoche.toFixed(1)}% vs. Vorwoche</span>
              </div>
            </div>
          </div>

          {!locationId && (
            <div className="px-5 py-1.5 bg-muted/20 border-t">
              <span className="text-[10px] text-muted-foreground">⚠ Demo-Daten — Echtdaten über Weekly-Summary-API</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
