'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, CheckCircle2, Clock, Navigation2, Package, ChevronDown, ChevronUp, Phone } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    kunde_notiz?: string | null;
    kunde_telefon?: string | null;
  };
}

interface Props {
  stops: Stop[];
  batchId?: string;
  totalEtaMin?: number | null;
  startedAt?: string | null;
  isOnline?: boolean;
}

function openNavi(lat: number | null, lng: number | null, address: string | null) {
  if (!lat || !lng) {
    if (address) window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank');
    return;
  }
  const ua = navigator.userAgent;
  if (/iPhone|iPad/i.test(ua)) {
    window.open(`maps://maps.apple.com/?daddr=${lat},${lng}`, '_blank');
  } else {
    window.open(`https://maps.google.com/?daddr=${lat},${lng}`, '_blank');
  }
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
}

export function FahrerPhase1710SmartTourStoppNavigationUltra({
  stops,
  totalEtaMin,
  startedAt,
  isOnline = true,
}: Props) {
  const [open, setOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const enriched = useMemo(() => {
    const now = Date.now();
    const startMs = startedAt ? new Date(startedAt).getTime() : now;
    const elapsedMin = (now - startMs) / 60_000;
    const remaining = stops.filter((s) => !s.geliefert_am);
    const perStopMin = totalEtaMin && remaining.length > 0 ? totalEtaMin / remaining.length : 10;
    let cumulativeMin = elapsedMin;
    return stops
      .slice()
      .sort((a, b) => a.reihenfolge - b.reihenfolge)
      .map((s) => {
        const done = !!s.geliefert_am;
        const arrived = !!s.angekommen_am;
        let etaMin: number | null = null;
        if (!done) {
          etaMin = Math.max(0, Math.round(cumulativeMin + perStopMin - elapsedMin));
          cumulativeMin += perStopMin;
        }
        return { s, done, arrived, etaMin };
      });
  }, [stops, totalEtaMin, startedAt]);

  const completedCount = enriched.filter((e) => e.done).length;
  const nextStop = enriched.find((e) => !e.done);

  if (stops.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-background">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-matcha-900/90 text-white hover:bg-matcha-900 transition"
      >
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-matcha-300" />
          <span className="text-sm font-bold">Tour-Stops</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">
            {completedCount}/{stops.length}
          </span>
          {nextStop && nextStop.etaMin !== null && (
            <span className="text-[11px] text-matcha-300 font-bold">
              · nächster in ~{nextStop.etaMin} Min
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-matcha-300 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-matcha-300 shrink-0" />
        }
      </button>

      {open && (
        <div className="divide-y divide-border">
          {enriched.map(({ s, done, arrived, etaMin }, idx) => {
            const isNext = !done && idx === enriched.findIndex((e) => !e.done);
            const expanded = expandedId === s.id;
            return (
              <div
                key={s.id}
                className={cn(
                  'transition-colors',
                  done ? 'bg-muted/30' : isNext ? 'bg-matcha-50' : 'bg-background',
                )}
              >
                <button
                  className="w-full text-left px-4 py-3"
                  onClick={() => setExpandedId(expanded ? null : s.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Stop number / icon */}
                    <div className={cn(
                      'h-7 w-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 border-2',
                      done
                        ? 'bg-matcha-500 border-matcha-500 text-white'
                        : isNext
                          ? 'bg-white border-matcha-500 text-matcha-700 shadow-sm'
                          : 'bg-muted border-border text-muted-foreground',
                    )}>
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.reihenfolge}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'text-sm font-bold truncate',
                          done ? 'text-muted-foreground line-through' : isNext ? 'text-matcha-900' : 'text-foreground',
                        )}>
                          {s.order.kunde_name}
                        </span>
                        {isNext && (
                          <span className="rounded-full bg-matcha-100 text-matcha-700 text-[10px] font-black px-2 py-0.5 shrink-0">
                            Nächster
                          </span>
                        )}
                        {done && (
                          <span className="rounded-full bg-matcha-100 text-matcha-700 text-[10px] font-bold px-2 py-0.5 shrink-0">
                            Geliefert
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {s.order.kunde_adresse}
                        {s.order.kunde_plz && ` · ${s.order.kunde_plz}`}
                      </div>
                    </div>

                    {/* ETA / amount */}
                    <div className="shrink-0 text-right">
                      {!done && etaMin !== null && (
                        <div className={cn(
                          'text-[11px] font-bold flex items-center gap-0.5 justify-end',
                          isNext ? 'text-matcha-700' : 'text-muted-foreground',
                        )}>
                          <Clock className="h-3 w-3" />
                          ~{etaMin}m
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground font-medium">
                        {fmtEur(s.order.gesamtbetrag)}
                      </div>
                    </div>

                    <ChevronDown className={cn(
                      'h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform',
                      expanded && 'rotate-180',
                    )} />
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-3 pt-0 space-y-2">
                    {s.order.kunde_notiz && (
                      <div className="text-[11px] rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800">
                        📝 {s.order.kunde_notiz}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {(s.order.kunde_lat || s.order.kunde_adresse) && (
                        <button
                          onClick={() => openNavi(s.order.kunde_lat, s.order.kunde_lng, s.order.kunde_adresse)}
                          className="flex-1 min-w-[120px] py-2.5 bg-matcha-600 hover:bg-matcha-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                        >
                          <Navigation2 className="h-4 w-4" />
                          Navigieren
                        </button>
                      )}
                      {s.order.kunde_telefon && (
                        <a
                          href={`tel:${s.order.kunde_telefon}`}
                          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          Anrufen
                        </a>
                      )}
                    </div>
                    {done && s.geliefert_am && (
                      <div className="text-[10px] text-muted-foreground">
                        Geliefert: {new Date(s.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
