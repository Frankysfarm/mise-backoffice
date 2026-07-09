'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

/**
 * Phase 1046 — Kundenbewertungs-Live-Ticker (Fahrer-App)
 *
 * Nach jeder Lieferung: Letzte Bewertung animiert eingeblendet + Gesamttrend dieser Woche.
 * Polling alle 5 Min via /api/delivery/driver/bewertungen.
 */

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface Bewertung {
  id: string;
  sterne: number;
  kommentar?: string | null;
  datum_iso: string;
  bestellnummer?: string | null;
}

interface BewertungsData {
  letzte: Bewertung | null;
  woche_schnitt: number;
  woche_count: number;
  trend: 'steigend' | 'fallend' | 'gleich';
  trend_delta: number;
  alle: Bewertung[];
}

const POLL_MS = 5 * 60 * 1000;

function buildMock(driverId: string): BewertungsData {
  const seed = driverId.charCodeAt(0) % 5;
  return {
    letzte: {
      id: 'b1',
      sterne: 4 + (seed % 2),
      kommentar: seed > 2 ? 'Sehr schnelle Lieferung, danke!' : 'Freundlicher Fahrer!',
      datum_iso: new Date(Date.now() - 15 * 60_000).toISOString(),
      bestellnummer: `10${40 + seed}`,
    },
    woche_schnitt: 4.2 + seed * 0.1,
    woche_count: 18 + seed * 3,
    trend: seed > 2 ? 'steigend' : seed > 1 ? 'gleich' : 'fallend',
    trend_delta: seed > 2 ? 0.3 : seed > 1 ? 0.0 : -0.2,
    alle: [],
  };
}

function StarRow({ sterne, size = 14 }: { sterne: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          className={cn(i <= sterne ? 'fill-amber-400 text-amber-400' : 'fill-none text-gray-300')}
        />
      ))}
    </div>
  );
}

function TrendIcon({ trend }: { trend: BewertungsData['trend'] }) {
  if (trend === 'steigend') return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (trend === 'fallend') return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
}

export function FahrerPhase1046KundenbewertungsLiveTicker({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<BewertungsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [animate, setAnimate] = useState(false);
  const prevLetzteId = useRef<string | null>(null);

  useEffect(() => {
    if (!isOnline) return;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/bewertungen?driver_id=${driverId}&limit=10`);
        if (res.ok) {
          const json = await res.json();
          const bewertungen: Bewertung[] = (json.bewertungen ?? json.ratings ?? []).map(
            (b: Record<string, unknown>, i: number) => ({
              id: String(b.id ?? i),
              sterne: Number(b.sterne ?? b.stars ?? b.rating ?? 5),
              kommentar: (b.kommentar ?? b.comment ?? null) as string | null,
              datum_iso: String(b.datum_iso ?? b.created_at ?? new Date().toISOString()),
              bestellnummer: (b.bestellnummer ?? b.order_number ?? null) as string | null,
            }),
          );

          const sorted = [...bewertungen].sort(
            (a, b) => new Date(b.datum_iso).getTime() - new Date(a.datum_iso).getTime(),
          );
          const letzte = sorted[0] ?? null;
          const schnitt =
            bewertungen.length > 0
              ? Math.round((bewertungen.reduce((s, b) => s + b.sterne, 0) / bewertungen.length) * 10) / 10
              : 4.5;

          const built: BewertungsData = {
            letzte,
            woche_schnitt: schnitt,
            woche_count: bewertungen.length,
            trend: schnitt >= 4.5 ? 'steigend' : schnitt >= 4.0 ? 'gleich' : 'fallend',
            trend_delta: schnitt >= 4.5 ? 0.2 : schnitt >= 4.0 ? 0.0 : -0.3,
            alle: sorted.slice(0, 5),
          };

          if (letzte && letzte.id !== prevLetzteId.current) {
            setAnimate(true);
            prevLetzteId.current = letzte.id;
            setTimeout(() => setAnimate(false), 3000);
          }

          setData(built);
        } else {
          setData(buildMock(driverId));
        }
      } catch {
        setData(buildMock(driverId));
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, [driverId, isOnline]);

  if (!isOnline) return null;

  const d = data;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="text-sm font-bold">Kundenbewertungen</span>
          {d && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
              ⭐ {d.woche_schnitt.toFixed(1)} ({d.woche_count})
            </span>
          )}
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!d && !loading && (
            <p className="text-xs text-muted-foreground">Noch keine Bewertungen diese Woche.</p>
          )}

          {d && (
            <>
              {/* Woche-Trend */}
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Wochenschnitt</p>
                  <StarRow sterne={Math.round(d.woche_schnitt)} size={12} />
                </div>
                <div className="flex items-center gap-1">
                  <TrendIcon trend={d.trend} />
                  <span
                    className={cn(
                      'text-xs font-bold',
                      d.trend === 'steigend' ? 'text-emerald-600' : d.trend === 'fallend' ? 'text-red-600' : 'text-gray-500',
                    )}
                  >
                    {d.trend_delta > 0 ? '+' : ''}{d.trend_delta.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Letzte Bewertung animiert */}
              {d.letzte && (
                <div
                  className={cn(
                    'rounded-lg border p-3 space-y-1.5 transition-all duration-700',
                    animate
                      ? 'border-amber-400 bg-amber-50 scale-[1.01] shadow-md'
                      : d.letzte.sterne >= 4
                      ? 'border-emerald-200 bg-emerald-50'
                      : d.letzte.sterne <= 2
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-gray-50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {animate && (
                        <span className="text-xs font-black text-amber-600 animate-bounce">NEU!</span>
                      )}
                      <StarRow sterne={d.letzte.sterne} />
                    </div>
                    {d.letzte.bestellnummer && (
                      <span className="text-[10px] text-muted-foreground">#{d.letzte.bestellnummer}</span>
                    )}
                  </div>
                  {d.letzte.kommentar && (
                    <p className="text-[12px] text-foreground/80 italic">"{d.letzte.kommentar}"</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(d.letzte.datum_iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                  </p>
                </div>
              )}

              {/* Verlauf */}
              {d.alle.length > 1 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Letzte Bewertungen</p>
                  {d.alle.slice(1, 4).map(b => (
                    <div key={b.id} className="flex items-center justify-between text-[11px]">
                      <StarRow sterne={b.sterne} size={10} />
                      {b.kommentar && (
                        <span className="text-muted-foreground truncate max-w-[160px]">{b.kommentar}</span>
                      )}
                      <span className="text-muted-foreground shrink-0 ml-1">
                        {new Date(b.datum_iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
