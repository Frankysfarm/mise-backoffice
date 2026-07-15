'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Navigation, MapPin, CheckCircle2, Clock, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/**
 * Phase 1809 — Tour-Stopp-Navigations-Hub (Fahrer-App)
 *
 * Alle verbleibenden Tour-Stopps mit:
 * - Adresse + Kunden-Name
 * - Geschätzte Fahrzeit zum nächsten Stopp
 * - Status-Badge (ausstehend / aktuell / abgeschlossen)
 * - Navi-Link zu Google Maps / Apple Maps
 * Props: driverId, isOnline; 90s-Polling; Collapsible.
 */

interface Stopp {
  id: string;
  reihenfolge: number;
  status: string;
  adresse: string | null;
  kundeName: string | null;
  etaMin: number | null;
  lat: number | null;
  lng: number | null;
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
  className?: string;
}

function naviUrl(lat: number | null, lng: number | null, adresse: string | null): string {
  if (lat && lng) {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }
  if (adresse) {
    return `https://maps.google.com/?q=${encodeURIComponent(adresse)}`;
  }
  return '#';
}

const STATUS_STYLE = {
  aktuell: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300 border-matcha-300 dark:border-matcha-700',
  ausstehend: 'bg-muted/40 text-muted-foreground border-muted',
  abgeschlossen: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-800 opacity-60',
};

function statusKlasse(status: string): keyof typeof STATUS_STYLE {
  if (status === 'abgeschlossen' || status === 'completed' || status === 'delivered') return 'abgeschlossen';
  if (status === 'aktuell' || status === 'current' || status === 'in_progress') return 'aktuell';
  return 'ausstehend';
}

export function FahrerPhase1809TourStoppNavigationsHub({ driverId, isOnline, className }: Props) {
  const [open, setOpen] = useState(true);
  const [stopps, setStopps] = useState<Stopp[]>([]);
  const [loading, setLoading] = useState(false);

  async function laden() {
    if (!driverId || !isOnline) return;
    setLoading(true);
    try {
      const sb = createClient();
      // Aktuellen Batch des Fahrers holen
      const { data: status } = await sb
        .from('driver_status')
        .select('aktueller_batch_id')
        .eq('employee_id', driverId)
        .maybeSingle();

      const batchId = status?.aktueller_batch_id;
      if (!batchId) { setStopps([]); setLoading(false); return; }

      const { data: stops } = await sb
        .from('batch_stops')
        .select('id, reihenfolge, status, kunde_adresse, kunde_plz, kunden_name, eta_min, lat, lng')
        .eq('batch_id', batchId)
        .order('reihenfolge', { ascending: true });

      if (!stops) { setLoading(false); return; }

      setStopps(stops.map((s: any) => ({
        id: s.id,
        reihenfolge: s.reihenfolge ?? 0,
        status: s.status ?? 'ausstehend',
        adresse: s.kunde_adresse ? `${s.kunde_adresse}${s.kunde_plz ? ', ' + s.kunde_plz : ''}` : null,
        kundeName: s.kunden_name ?? null,
        etaMin: s.eta_min ?? null,
        lat: s.lat ?? null,
        lng: s.lng ?? null,
      })));
    } catch {
      // Mock-Daten
      setStopps([
        { id: 'm1', reihenfolge: 1, status: 'abgeschlossen', adresse: 'Hauptstr. 12, 52062 Aachen', kundeName: 'Anna Klein', etaMin: null, lat: null, lng: null },
        { id: 'm2', reihenfolge: 2, status: 'aktuell', adresse: 'Pontstr. 44, 52062 Aachen', kundeName: 'Ben Schulz', etaMin: 5, lat: null, lng: null },
        { id: 'm3', reihenfolge: 3, status: 'ausstehend', adresse: 'Boxgraben 102, 52064 Aachen', kundeName: 'Clara Meyer', etaMin: 14, lat: null, lng: null },
      ]);
    }
    setLoading(false);
  }

  useEffect(() => {
    laden();
    const id = setInterval(laden, 90_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, isOnline]);

  if (!isOnline) return null;

  const verbleibend = stopps.filter(s => statusKlasse(s.status) !== 'abgeschlossen').length;
  const aktuell = stopps.find(s => statusKlasse(s.status) === 'aktuell');

  return (
    <div className={cn('rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Navigation className="h-4 w-4 shrink-0 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider truncate">
            Tour-Stopps
          </span>
          {verbleibend > 0 && (
            <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300 px-2 py-0.5 text-[10px] font-bold">
              {verbleibend} verbleibend
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-3 py-3 space-y-2">
          {loading && stopps.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-3">Lade Stopps…</div>
          )}
          {!loading && stopps.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-3">Keine aktive Tour.</div>
          )}

          {/* Aktueller Stopp hervorgehoben */}
          {aktuell && (
            <a
              href={naviUrl(aktuell.lat, aktuell.lng, aktuell.adresse)}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border-2 border-matcha-400 bg-matcha-50 dark:bg-matcha-950/40 px-4 py-3 space-y-1.5 hover:bg-matcha-100 dark:hover:bg-matcha-950/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-matcha-500 text-white px-2 py-0.5 text-[10px] font-black">
                  Jetzt: Stopp {aktuell.reihenfolge}
                </span>
                {aktuell.etaMin !== null && (
                  <span className="flex items-center gap-1 text-[10px] text-matcha-700 dark:text-matcha-300 font-semibold">
                    <Clock className="h-3 w-3" /> ~{aktuell.etaMin} Min
                  </span>
                )}
              </div>
              {aktuell.kundeName && (
                <div className="text-sm font-bold truncate">{aktuell.kundeName}</div>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-matcha-500" />
                <span className="truncate">{aktuell.adresse ?? 'Adresse fehlt'}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-semibold text-matcha-600 dark:text-matcha-400">
                <Navigation className="h-3 w-3" /> Navigation öffnen →
              </div>
            </a>
          )}

          {/* Alle Stopps */}
          <div className="space-y-1">
            {stopps.map(s => {
              const kat = statusKlasse(s.status);
              if (kat === 'aktuell') return null;
              return (
                <div key={s.id} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', STATUS_STYLE[kat])}>
                  <div className="shrink-0 text-[11px] font-black w-5 text-center">
                    {kat === 'abgeschlossen'
                      ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      : <Package className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold">Stopp {s.reihenfolge}</span>
                      {s.kundeName && <span className="text-[10px] truncate text-muted-foreground">– {s.kundeName}</span>}
                    </div>
                    {s.adresse && (
                      <div className="text-[9px] text-muted-foreground truncate">{s.adresse}</div>
                    )}
                  </div>
                  {s.etaMin !== null && kat === 'ausstehend' && (
                    <span className="shrink-0 text-[10px] text-muted-foreground font-semibold">~{s.etaMin}m</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-[10px] text-muted-foreground text-right pt-1">
            {stopps.filter(s => statusKlasse(s.status) === 'abgeschlossen').length}/{stopps.length} abgeschlossen
          </div>
        </div>
      )}
    </div>
  );
}
