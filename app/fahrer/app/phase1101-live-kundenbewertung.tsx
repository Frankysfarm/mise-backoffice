'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1101 — Live-Kundenbewertung-Vorschau (Fahrer-App)
// Zeigt letzte 3 Kunden-Bewertungen der aktuellen Schicht + Trend

interface Props {
  driverId: string;
  isOnline: boolean;
}

type Bewertung = {
  id: string;
  sterne: number; // 1–5
  kommentar: string | null;
  zeit_label: string;
  bestell_id: string;
};

type ApiData = {
  fahrer_id: string;
  schicht_durchschnitt: number;
  anzahl_bewertungen: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  letzte_bewertungen: Bewertung[];
  generiert_am: string;
};

const MOCK: ApiData = {
  fahrer_id: 'mock',
  schicht_durchschnitt: 4.7,
  anzahl_bewertungen: 9,
  trend: 'besser',
  letzte_bewertungen: [
    { id: 'b1', sterne: 5, kommentar: 'Super schnell, sehr freundlich!', zeit_label: 'vor 12 Min', bestell_id: 'A3F1' },
    { id: 'b2', sterne: 4, kommentar: null, zeit_label: 'vor 38 Min', bestell_id: 'B7C2' },
    { id: 'b3', sterne: 5, kommentar: 'Essen noch warm, danke!', zeit_label: 'vor 1 Std', bestell_id: 'D2E9' },
  ],
  generiert_am: new Date().toISOString(),
};

function StarRow({ sterne, max = 5 }: { sterne: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i < sterne ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted-foreground/30',
          )}
        />
      ))}
    </div>
  );
}

export function FahrerPhase1101LiveKundenbewertung({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/driver/live-kundenbewertung?driver_id=${driverId}`,
      );
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    void load();
    const id = setInterval(load, 3 * 60_000); // 3-min polling
    return () => clearInterval(id);
  }, [load]);

  const displayed = data ?? MOCK;
  const avg = displayed.schicht_durchschnitt;

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Meine Bewertungen
          </span>
          <span className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-bold',
            avg >= 4.5
              ? 'bg-green-100 text-green-700 border-green-300'
              : avg >= 3.5
                ? 'bg-amber-100 text-amber-700 border-amber-300'
                : 'bg-red-100 text-red-700 border-red-300',
          )}>
            {avg.toFixed(1)} ★ · {displayed.anzahl_bewertungen} heute
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-3">
          {/* Summary */}
          <div className="flex items-center gap-4 rounded-xl bg-muted/40 p-3">
            <div className="text-center">
              <div className={cn(
                'text-3xl font-display font-black',
                avg >= 4.5 ? 'text-green-600' : avg >= 3.5 ? 'text-amber-600' : 'text-red-600',
              )}>
                {avg.toFixed(1)}
              </div>
              <div className="text-[10px] text-muted-foreground">Ø Schicht</div>
            </div>
            <div className="flex-1 space-y-1">
              <StarRow sterne={Math.round(avg)} />
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {displayed.trend === 'besser' && (
                  <><TrendingUp className="h-3 w-3 text-green-500" /> Trend: besser</>
                )}
                {displayed.trend === 'schlechter' && (
                  <><TrendingDown className="h-3 w-3 text-red-500" /> Trend: schlechter</>
                )}
                {displayed.trend === 'gleich' && (
                  <span>Trend: stabil</span>
                )}
              </div>
            </div>
          </div>

          {/* Last 3 reviews */}
          {displayed.letzte_bewertungen.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Noch keine Bewertungen in dieser Schicht.
            </p>
          )}

          <div className="space-y-2">
            {displayed.letzte_bewertungen.map(b => (
              <div key={b.id} className="rounded-xl border bg-muted/20 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <StarRow sterne={b.sterne} />
                  <span className="text-[10px] text-muted-foreground">{b.zeit_label}</span>
                </div>
                {b.kommentar && (
                  <p className="text-xs text-foreground italic">„{b.kommentar}"</p>
                )}
                {!b.kommentar && (
                  <p className="text-[11px] text-muted-foreground">Keine Kommentar</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Bestellung #{b.bestell_id}
                </p>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            Aktualisiert: {new Date(displayed.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · 3-Min
          </p>
        </div>
      )}
    </div>
  );
}
