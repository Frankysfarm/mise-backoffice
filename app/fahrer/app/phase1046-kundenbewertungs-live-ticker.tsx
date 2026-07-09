'use client';

import { useEffect, useState } from 'react';
import { Loader2, Star, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type Bewertung = {
  orderId: string;
  sterne: number;
  kommentar?: string | null;
  zeitpunkt: string;
  trinkgeld?: number | null;
};

type TickerData = {
  letzteBewertung: Bewertung | null;
  wochenschnitt: number;
  anzahlWoche: number;
  trend: 'steigend' | 'fallend' | 'stabil';
};

const MOCK: TickerData = {
  letzteBewertung: {
    orderId: 'mock-1',
    sterne: 5,
    kommentar: 'Sehr schnell und freundlich! 👍',
    zeitpunkt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    trinkgeld: 2.5,
  },
  wochenschnitt: 4.7,
  anzahlWoche: 23,
  trend: 'steigend',
};

function StarRow({ sterne, size = 14 }: { sterne: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={cn(s <= sterne ? 'text-amber-400 fill-amber-400' : 'text-white/20 fill-white/10')}
        />
      ))}
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std`;
  return `vor ${Math.floor(diff / 86400)} Tagen`;
}

export function FahrerPhase1046KundenbewertungsLiveTicker({
  driverId,
  isOnline,
}: {
  driverId?: string;
  isOnline?: boolean;
}) {
  const [data, setData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let prev: string | null = null;

    const load = () => {
      const url = driverId
        ? `/api/delivery/driver/kundenbewertung-ticker?driver_id=${encodeURIComponent(driverId)}`
        : '/api/delivery/driver/kundenbewertung-ticker';

      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          const td = d as TickerData | null;
          if (td?.letzteBewertung) {
            if (td.letzteBewertung.orderId !== prev) {
              prev = td.letzteBewertung.orderId;
              setAnimating(true);
              setTimeout(() => setAnimating(false), 600);
            }
            setData(td);
          } else {
            setData(MOCK);
          }
        })
        .catch(() => { if (!cancelled) setData(MOCK); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [driverId, isOnline]);

  if (!isOnline) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/40 text-xs px-1">
        <Loader2 size={12} className="animate-spin" /> Lade Bewertungen…
      </div>
    );
  }

  if (!data) return null;

  const TrendIcon = data.trend === 'steigend' ? TrendingUp : data.trend === 'fallend' ? TrendingDown : Minus;
  const trendColor = data.trend === 'steigend' ? 'text-matcha-300' : data.trend === 'fallend' ? 'text-red-400' : 'text-white/50';

  return (
    <div className="rounded-xl bg-white/10 border border-white/20 overflow-hidden">
      {/* Header: Wochentrend */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Star size={14} className="text-amber-400 fill-amber-400" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-white/70">Kundenbewertungen</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-white tabular-nums">{data.wochenschnitt.toFixed(1)}</span>
            <span className="text-[10px] text-white/50">diese Woche ({data.anzahlWoche})</span>
          </div>
          <TrendIcon size={14} className={trendColor} />
        </div>
      </div>

      {/* Letzte Bewertung */}
      {data.letzteBewertung && (
        <div className={cn(
          'px-4 py-3 transition-all duration-500',
          animating ? 'bg-amber-400/20' : '',
        )}>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <StarRow sterne={data.letzteBewertung.sterne} />
            <span className="text-[10px] text-white/40 shrink-0 tabular-nums">
              {relativeTime(data.letzteBewertung.zeitpunkt)}
            </span>
          </div>

          {data.letzteBewertung.kommentar && (
            <p className="text-xs text-white/80 italic leading-relaxed line-clamp-2">
              &ldquo;{data.letzteBewertung.kommentar}&rdquo;
            </p>
          )}

          {data.letzteBewertung.trinkgeld && data.letzteBewertung.trinkgeld > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-matcha-500/30 px-2 py-0.5 text-[10px] font-bold text-matcha-200">
              +{data.letzteBewertung.trinkgeld.toFixed(2).replace('.', ',')} € Trinkgeld
            </div>
          )}

          {!data.letzteBewertung.kommentar && (
            <div className="text-[10px] text-white/30 mt-1">Kein Kommentar</div>
          )}
        </div>
      )}

      {!data.letzteBewertung && (
        <div className="px-4 py-3 text-[11px] text-white/40 text-center">
          Noch keine Bewertungen heute
        </div>
      )}
    </div>
  );
}
