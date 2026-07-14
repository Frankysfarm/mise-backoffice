'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Navigation2, Clock, MapPin, ChevronRight, ExternalLink } from 'lucide-react';

// Phase 1469 — Smart-Navigations-Ziel-Cockpit (Fahrer-App)
// Zeigt nächstes Lieferziel mit ETA + Distanz + Navi-Deep-Link;
// Props-basiert; nach Phase1468.

interface Stop {
  id: string;
  order_id?: string | null;
  reihenfolge?: number | null;
  sequence?: number | null;
  geliefert_am?: string | null;
  completed_at?: string | null;
  kunde_name?: string | null;
  adresse?: string | null;
  address?: string | null;
  eta_min?: number | null;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  stops: Stop[];
  isOnline: boolean;
  currentLat?: number | null;
  currentLng?: number | null;
}

function getSeq(s: Stop): number {
  return s.reihenfolge ?? s.sequence ?? 0;
}

function isDone(s: Stop): boolean {
  return !!(s.geliefert_am ?? s.completed_at);
}

export function FahrerPhase1469SmartNaviZielCockpit({ stops, isOnline, currentLat, currentLng }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const nextStop = useMemo(() => {
    return [...stops]
      .filter((s) => !isDone(s))
      .sort((a, b) => getSeq(a) - getSeq(b))[0] ?? null;
  }, [stops]);

  const completedCount = useMemo(() => stops.filter(isDone).length, [stops]);
  const totalCount = stops.length;

  if (!isOnline || !nextStop) return null;

  const addr = nextStop.adresse ?? nextStop.address ?? 'Adresse unbekannt';
  const name = nextStop.kunde_name ?? 'Kunde';
  const etaMin = nextStop.eta_min ?? null;

  function openNavi() {
    const dest = (nextStop!.lat && nextStop!.lng)
      ? `${nextStop!.lat},${nextStop!.lng}`
      : encodeURIComponent(addr);
    const url = `https://maps.google.com/?daddr=${dest}&dirflg=d`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="rounded-2xl border border-matcha-200 dark:border-matcha-800 bg-gradient-to-br from-matcha-50 to-white dark:from-matcha-950/30 dark:to-background overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-matcha-100 dark:border-matcha-800">
        <Navigation2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-matcha-700 dark:text-matcha-300">
          Nächstes Ziel
        </span>
        <span className="ml-auto text-[10px] font-bold text-muted-foreground tabular-nums">
          {completedCount}/{totalCount} Stopps
        </span>
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-2">
        {/* Customer + address */}
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-matcha-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold leading-snug">{name}</div>
            <div className="text-xs text-muted-foreground truncate">{addr}</div>
          </div>
        </div>

        {/* ETA + sequence */}
        <div className="flex items-center gap-3">
          {etaMin !== null && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-matcha-500" />
              <span className="text-sm font-black tabular-nums text-matcha-700 dark:text-matcha-300">
                ~{etaMin} Min
              </span>
            </div>
          )}
          <span className="text-[10px] rounded-full bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300 font-bold px-2 py-0.5">
            Stopp {getSeq(nextStop) + 1} von {totalCount}
          </span>
        </div>

        {/* Navi button */}
        <button
          onClick={openNavi}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-matcha-600 hover:bg-matcha-700 active:scale-95 transition text-white font-bold text-sm py-2.5 mt-1 shadow-sm"
        >
          <Navigation2 className="h-4 w-4" />
          Navigation starten
          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-700"
            style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
          />
        </div>
      </div>
    </div>
  );
}
