'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Home, Navigation, Clock, TrendingUp, MapPin, ExternalLink } from 'lucide-react';

// Phase 1442 — Heimweg-Assistent (Fahrer-App)
// Nach letzter Lieferung: Direktlink zu Maps + geschätzte Heimkehrzeit + Schicht-Bilanz
// isOnline-Guard

interface Stop {
  id: string;
  status?: string | null;
  geliefert_am?: string | null;
  completed_at?: string | null;
  reihenfolge?: number | null;
  trinkgeld?: number | null;
  bestellwert?: number | null;
}

interface Props {
  activeBatch: {
    id: string;
    status: string;
    stops: Stop[];
    started_at?: string | null;
    total_eta_min?: number | null;
    gesamtumsatz?: number | null;
  } | null;
  driverId?: string | null;
  heimatAdresse?: string | null;
  letzteStopp_adresse?: string | null;
  isOnline: boolean;
}

function alleGeliefert(stops: Stop[]): boolean {
  return stops.length > 0 && stops.every(s => s.status === 'geliefert' || s.geliefert_am || s.completed_at);
}

function schichtDauerMin(startedAt?: string | null): number | null {
  if (!startedAt) return null;
  return Math.round((Date.now() - new Date(startedAt).getTime()) / 60_000);
}

function heimkehrEtaMin(letzterStoppAdresse?: string | null): number {
  // Heuristik: 15–20 Min als Standard wenn kein GPS verfügbar
  return 18;
}

function mapsLink(from?: string | null, to?: string | null): string {
  const dest = to ? encodeURIComponent(to) : '';
  const origin = from ? `&origin=${encodeURIComponent(from)}` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${origin}&travelmode=driving`;
}

function wazeLink(to?: string | null): string {
  const dest = to ? encodeURIComponent(to) : '';
  return `https://waze.com/ul?q=${dest}&navigate=yes`;
}

export function FahrerPhase1442HeimwegAssistent({
  activeBatch,
  driverId: _driverId,
  heimatAdresse,
  letzteStopp_adresse,
  isOnline,
}: Props) {
  const [homeAddr, setHomeAddr] = useState(heimatAdresse ?? '');

  useEffect(() => {
    if (!heimatAdresse) {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('fahrer_heimat_adresse') : null;
      if (saved) setHomeAddr(saved);
    }
  }, [heimatAdresse]);

  if (!isOnline) return null;
  if (!activeBatch) return null;
  if (!alleGeliefert(activeBatch.stops)) return null;

  const schichtMin = schichtDauerMin(activeBatch.started_at);
  const etaHeim = heimkehrEtaMin(letzteStopp_adresse);
  const gesamtumsatz = activeBatch.gesamtumsatz ?? 0;
  const trinkgeld = activeBatch.stops.reduce((sum, s) => sum + (s.trinkgeld ?? 0), 0);
  const stops = activeBatch.stops.length;

  return (
    <div className="rounded-xl border border-matcha-300 dark:border-matcha-700 bg-matcha-50 dark:bg-matcha-950/30 shadow-sm p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Home className="w-5 h-5 text-matcha-600 dark:text-matcha-400 shrink-0" />
        <div>
          <div className="text-sm font-bold text-matcha-800 dark:text-matcha-200">Tour abgeschlossen!</div>
          <div className="text-[11px] text-matcha-600 dark:text-matcha-400">Alle {stops} Stopps geliefert</div>
        </div>
      </div>

      {/* Schicht-Bilanz */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-white dark:bg-slate-800 border border-matcha-200 dark:border-matcha-800 px-2 py-2 text-center">
          <div className="text-base font-black tabular-nums text-slate-800 dark:text-slate-100">{stops}</div>
          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-0.5"><MapPin className="w-3 h-3" /> Stopps</div>
        </div>
        {schichtMin !== null && (
          <div className="rounded-lg bg-white dark:bg-slate-800 border border-matcha-200 dark:border-matcha-800 px-2 py-2 text-center">
            <div className="text-base font-black tabular-nums text-slate-800 dark:text-slate-100">
              {schichtMin >= 60 ? `${Math.floor(schichtMin / 60)}h ${schichtMin % 60}m` : `${schichtMin}m`}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-0.5"><Clock className="w-3 h-3" /> Schicht</div>
          </div>
        )}
        {gesamtumsatz > 0 && (
          <div className="rounded-lg bg-white dark:bg-slate-800 border border-matcha-200 dark:border-matcha-800 px-2 py-2 text-center">
            <div className="text-base font-black tabular-nums text-matcha-700 dark:text-matcha-300">
              €{gesamtumsatz.toFixed(0)}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-0.5"><TrendingUp className="w-3 h-3" /> Umsatz</div>
          </div>
        )}
        {trinkgeld > 0 && gesamtumsatz === 0 && (
          <div className="rounded-lg bg-white dark:bg-slate-800 border border-matcha-200 dark:border-matcha-800 px-2 py-2 text-center">
            <div className="text-base font-black tabular-nums text-amber-600 dark:text-amber-400">€{trinkgeld.toFixed(2)}</div>
            <div className="text-[10px] text-slate-500">Trinkgeld</div>
          </div>
        )}
      </div>

      {/* ETA Heimkehr */}
      <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-slate-800 border border-matcha-200 dark:border-matcha-800 px-3 py-2">
        <Clock className="w-4 h-4 text-matcha-600 dark:text-matcha-400 shrink-0" />
        <div className="flex-1">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Geschätzte Heimkehrzeit</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {homeAddr || 'Heimadresse'} · ca. {etaHeim} Min
          </div>
        </div>
        <div className={cn(
          'text-sm font-black tabular-nums text-matcha-700 dark:text-matcha-300',
        )}>
          ~{etaHeim}m
        </div>
      </div>

      {/* Navigation */}
      <div className="grid grid-cols-2 gap-2">
        <a
          href={mapsLink(letzteStopp_adresse, homeAddr || undefined)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold py-2.5 px-3 transition-colors"
        >
          <Navigation className="w-3.5 h-3.5" />
          Google Maps
          <ExternalLink className="w-3 h-3 opacity-70" />
        </a>
        <a
          href={wazeLink(homeAddr || undefined)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white text-xs font-bold py-2.5 px-3 transition-colors"
        >
          <Navigation className="w-3.5 h-3.5" />
          Waze
          <ExternalLink className="w-3 h-3 opacity-70" />
        </a>
      </div>

      {trinkgeld > 0 && (
        <div className="text-center text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
          Trinkgeld heute: €{trinkgeld.toFixed(2)} — Danke für deinen Einsatz!
        </div>
      )}
    </div>
  );
}
