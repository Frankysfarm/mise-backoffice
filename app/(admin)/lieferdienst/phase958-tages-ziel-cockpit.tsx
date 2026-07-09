'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, Clock, Loader2 } from 'lucide-react';

type Props = { locationId: string | null };

type Data = {
  umsatzHeute: number;
  umsatzZiel: number;
  bestellungenHeute: number;
  bestellungenZiel: number;
  topStunde: string;
  topStundeUmsatz: number;
  stundenVerlauf: { stunde: string; umsatz: number }[];
};

const MOCK: Data = {
  umsatzHeute: 1247.5,
  umsatzZiel: 2000,
  bestellungenHeute: 43,
  bestellungenZiel: 70,
  topStunde: '12:00',
  topStundeUmsatz: 312.0,
  stundenVerlauf: [
    { stunde: '10', umsatz: 85 },
    { stunde: '11', umsatz: 180 },
    { stunde: '12', umsatz: 312 },
    { stunde: '13', umsatz: 275 },
    { stunde: '14', umsatz: 160 },
    { stunde: '15', umsatz: 95 },
    { stunde: '16', umsatz: 140 },
  ],
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function LieferdienstPhase958TagesZielCockpit({ locationId }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/delivery/admin/tages-ziel-cockpit?locationId=${locationId}`)
      .then(r => r.json())
      .then(d => setData(d?.umsatzHeute != null ? d : MOCK))
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, [locationId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 justify-center py-5 text-[11px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade Tages-Ziel…
      </div>
    );
  }

  if (!data) return null;

  const umsatzPct = Math.min(100, Math.round((data.umsatzHeute / data.umsatzZiel) * 100));
  const bestellPct = Math.min(100, Math.round((data.bestellungenHeute / data.bestellungenZiel) * 100));
  const maxUmsatz = Math.max(...data.stundenVerlauf.map(s => s.umsatz), 1);

  const barColor = umsatzPct >= 90 ? 'bg-matcha-500' : umsatzPct >= 60 ? 'bg-amber-400' : 'bg-red-400';
  const pctColor = umsatzPct >= 90 ? 'text-matcha-700' : umsatzPct >= 60 ? 'text-amber-700' : 'text-red-600';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <Target className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-foreground">Tages-Ziel-Cockpit</div>
          <div className="text-[10px] text-muted-foreground">Umsatz & Bestellungen vs. Tagesziel</div>
        </div>
        <div className={cn('ml-auto text-sm font-black tabular-nums', pctColor)}>
          {umsatzPct}%
        </div>
      </div>

      {/* Umsatz progress */}
      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1 font-semibold">
          <span>Umsatz heute</span>
          <span>{fmtEur(data.umsatzHeute)} / {fmtEur(data.umsatzZiel)}</span>
        </div>
        <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', barColor)}
            style={{ width: `${umsatzPct}%` }}
          />
        </div>
      </div>

      {/* Bestellungen progress */}
      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1 font-semibold">
          <span>Bestellungen</span>
          <span>{data.bestellungenHeute} / {data.bestellungenZiel}</span>
        </div>
        <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              bestellPct >= 90 ? 'bg-matcha-400' : bestellPct >= 60 ? 'bg-amber-300' : 'bg-red-300',
            )}
            style={{ width: `${bestellPct}%` }}
          />
        </div>
      </div>

      {/* Stunden-Verlauf mini-chart */}
      <div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2 font-semibold">
          <Clock className="h-3 w-3" /> Stunden-Verlauf
        </div>
        <div className="flex items-end gap-1 h-10">
          {data.stundenVerlauf.map(s => {
            const h = Math.max(Math.round((s.umsatz / maxUmsatz) * 100), 8);
            const isTop = s.stunde === data.topStunde;
            return (
              <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className={cn(
                    'w-full rounded-t-sm transition-all duration-500',
                    isTop ? 'bg-matcha-500' : 'bg-stone-200',
                  )}
                  style={{ height: `${h}%` }}
                />
                <div className={cn('text-[8px] tabular-nums', isTop ? 'font-black text-matcha-600' : 'text-stone-400')}>
                  {s.stunde}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top stunde callout */}
      <div className="rounded-lg bg-matcha-50 border border-matcha-200 px-3 py-2 flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
        <div className="text-[10px] text-matcha-800 font-medium">
          Stärkstes Stunden-Intervall: <strong>{data.topStunde} Uhr</strong> — {fmtEur(data.topStundeUmsatz)}
        </div>
      </div>
    </div>
  );
}
