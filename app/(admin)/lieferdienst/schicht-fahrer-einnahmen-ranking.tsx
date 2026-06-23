'use client';

/**
 * SchichtFahrerEinnahmenRanking — Phase 489
 * Top-5 Fahrer nach Umsatz-Beitrag der heutigen Schicht.
 *
 * Metriken: Abgeschlossene Stops × Ø-Liefergebühr (4,90 €)
 * Farb-Codierung: Gold/Silber/Bronze für Rang 1–3
 * API: GET /api/delivery/admin/fahrer-schicht-ranking?location_id=X
 * Fallback: Mock-Daten
 * Refresh: 60s
 */

import { useEffect, useState } from 'react';
import { Trophy, RefreshCw, Euro, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';

type FahrerRankEntry = {
  rank: number;
  name: string;
  bestellungen: number;
  umsatzCents: number;
};

const MOCK_RANKING: FahrerRankEntry[] = [
  { rank: 1, name: 'Lucas B.', bestellungen: 18, umsatzCents: 8820 },
  { rank: 2, name: 'Ahmad K.', bestellungen: 15, umsatzCents: 7350 },
  { rank: 3, name: 'Marco S.', bestellungen: 13, umsatzCents: 6370 },
  { rank: 4, name: 'Tim W.',   bestellungen: 11, umsatzCents: 5390 },
  { rank: 5, name: 'Kemal D.', bestellungen:  9, umsatzCents: 4410 },
];

function fmtEur(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

const RANK_STYLE: Record<number, { badge: string; text: string; icon: string }> = {
  1: { badge: 'bg-yellow-400 text-yellow-900', text: 'text-yellow-700', icon: '🥇' },
  2: { badge: 'bg-stone-300 text-stone-700',   text: 'text-stone-600',  icon: '🥈' },
  3: { badge: 'bg-amber-600 text-amber-50',    text: 'text-amber-700',  icon: '🥉' },
};

function RankRow({ entry, max }: { entry: FahrerRankEntry; max: number }) {
  const style = RANK_STYLE[entry.rank];
  const barWidth = max > 0 ? Math.round((entry.umsatzCents / max) * 100) : 0;

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Rank Badge */}
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black',
          style ? style.badge : 'bg-stone-100 text-stone-500',
        )}
      >
        {style ? style.icon : entry.rank}
      </div>

      {/* Name + Bar */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-sm font-bold truncate', style ? style.text : 'text-stone-700')}>
            {entry.name}
          </span>
          <span className="shrink-0 text-xs font-black tabular-nums text-stone-900">
            {fmtEur(entry.umsatzCents)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-stone-100 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                entry.rank === 1 ? 'bg-yellow-400' : entry.rank === 2 ? 'bg-stone-400' : entry.rank === 3 ? 'bg-amber-600' : 'bg-matcha-400',
              )}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <span className="shrink-0 text-[9px] text-stone-400 tabular-nums">
            {entry.bestellungen} Stops
          </span>
        </div>
      </div>
    </div>
  );
}

export function SchichtFahrerEinnahmenRanking({ locationId }: { locationId?: string | null }) {
  const [ranking, setRanking] = useState<FahrerRankEntry[]>(MOCK_RANKING);
  const [loading, setLoading] = useState(false);
  const [ts, setTs] = useState(new Date());

  useEffect(() => {
    async function load() {
      if (!locationId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-schicht-ranking?location_id=${locationId}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.ranking) && data.ranking.length > 0) {
            setRanking(data.ranking);
          }
        }
      } catch {
        // Mock bleibt
      } finally {
        setLoading(false);
        setTs(new Date());
      }
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const maxUmsatz = Math.max(...ranking.map((r) => r.umsatzCents), 1);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-2.5 bg-stone-50">
        <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider text-stone-800">
          Top-Fahrer · Schicht-Umsatz
        </span>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-stone-400">
          {loading && <RefreshCw className="h-3 w-3 animate-spin" />}
          <Euro className="h-3 w-3" />
          <span>{ts.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Ranking */}
      <div className="divide-y divide-stone-50 px-4">
        {ranking.slice(0, 5).map((entry) => (
          <RankRow key={entry.rank} entry={entry} max={maxUmsatz} />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-stone-100 px-4 py-2 bg-stone-50">
        <p className="text-[9px] text-stone-400">
          Umsatz-Beitrag = Abgeschl. Stops × Ø-Liefergebühr · Heute
        </p>
      </div>
    </div>
  );
}
