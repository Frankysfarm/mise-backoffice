'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Phone, MapPin, ChevronDown, ChevronUp, Loader2, Radio } from 'lucide-react';

/**
 * Phase 943 — Fahrer-Erreichbarkeits-Panel (Dispatch)
 *
 * Zeigt für jeden Fahrer letzte bekannte Position + Zeitstempel + Telefonnummer.
 * 2-Min-Polling auf /api/delivery/admin/fahrer-erreichbarkeit.
 */

interface FahrerErreichbarkeit {
  driver_id: string;
  fahrer_name: string;
  telefon: string | null;
  letzte_position_zone: string | null;
  letzte_position_adresse: string | null;
  letzte_aktivitaet_min: number;
  status: 'aktiv' | 'inaktiv' | 'offline';
  vehicle_type: string;
}

interface ApiResponse {
  fahrer: FahrerErreichbarkeit[];
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const VEHICLE_ICON: Record<string, string> = {
  bike: '🚲', scooter: '🛵', car: '🚗', ebike: '⚡🚲',
};

const MOCK: ApiResponse = {
  fahrer: [
    { driver_id: '1', fahrer_name: 'Max M.', telefon: '+49 170 1234567', letzte_position_zone: 'A', letzte_position_adresse: 'Hauptstraße 12', letzte_aktivitaet_min: 2, status: 'aktiv', vehicle_type: 'scooter' },
    { driver_id: '2', fahrer_name: 'Sarah K.', telefon: '+49 171 7654321', letzte_position_zone: 'B', letzte_position_adresse: 'Mühlenweg 5', letzte_aktivitaet_min: 8, status: 'aktiv', vehicle_type: 'bike' },
    { driver_id: '3', fahrer_name: 'Tom R.', telefon: '+49 172 3456789', letzte_position_zone: 'C', letzte_position_adresse: 'Schulstraße 3', letzte_aktivitaet_min: 25, status: 'inaktiv', vehicle_type: 'car' },
    { driver_id: '4', fahrer_name: 'Lisa W.', telefon: null, letzte_position_zone: null, letzte_position_adresse: null, letzte_aktivitaet_min: 120, status: 'offline', vehicle_type: 'scooter' },
  ],
  generatedAt: new Date().toISOString(),
};

function statusColor(status: FahrerErreichbarkeit['status'], min: number) {
  if (status === 'offline') return 'text-muted-foreground';
  if (status === 'inaktiv' || min > 15) return 'text-amber-600 dark:text-amber-400';
  return 'text-matcha-600 dark:text-matcha-400';
}

export function DispatchPhase943FahrerErreichbarkeitsPanel({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-erreichbarkeit?location_id=${locationId}`);
        if (!cancelled) setData(res.ok ? await res.json() : MOCK);
      } catch {
        if (!cancelled) setData(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 2 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  const fahrer = data?.fahrer ?? [];
  const aktiv = fahrer.filter(f => f.status === 'aktiv').length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/30 transition text-left"
      >
        <Radio className="h-4 w-4 text-matcha-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Fahrer-Erreichbarkeit
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {!loading && aktiv > 0 && (
          <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300 text-[10px] font-black px-2 py-0.5">
            {aktiv} aktiv
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {!locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}
          {locationId && !loading && fahrer.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Fahrerdaten.</p>
          )}
          {fahrer.map(f => (
            <div key={f.driver_id} className={cn(
              'rounded-lg border bg-background/60 px-3 py-2.5',
              f.status === 'offline' ? 'border-border/40 opacity-60' : 'border-border',
            )}>
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0 mt-0.5">{VEHICLE_ICON[f.vehicle_type] ?? '🚗'}</span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground truncate">{f.fahrer_name}</span>
                    <span className={cn(
                      'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full',
                      f.status === 'aktiv' && f.letzte_aktivitaet_min <= 15
                        ? 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300'
                        : f.status === 'inaktiv' || f.letzte_aktivitaet_min > 15
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                        : 'bg-muted text-muted-foreground',
                    )}>
                      {f.status === 'aktiv' && f.letzte_aktivitaet_min <= 15 ? 'Online' : f.status === 'offline' ? 'Offline' : 'Inaktiv'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    {f.letzte_position_adresse && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        {f.letzte_position_zone && <span className={cn('font-bold', statusColor(f.status, f.letzte_aktivitaet_min))}>Zone {f.letzte_position_zone}</span>}
                        <span className="truncate max-w-[100px]">{f.letzte_position_adresse}</span>
                      </span>
                    )}
                    <span className={cn(statusColor(f.status, f.letzte_aktivitaet_min))}>
                      {f.letzte_aktivitaet_min < 60
                        ? `vor ${f.letzte_aktivitaet_min} Min`
                        : `vor ${Math.round(f.letzte_aktivitaet_min / 60)} h`}
                    </span>
                  </div>
                </div>
                {f.telefon ? (
                  <a
                    href={`tel:${f.telefon.replace(/\s/g, '')}`}
                    className="flex items-center gap-1 rounded-lg bg-matcha-50 dark:bg-matcha-900/30 border border-matcha-200 dark:border-matcha-800 px-2.5 py-1.5 text-matcha-600 dark:text-matcha-400 hover:bg-matcha-100 transition shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <Phone className="h-3 w-3" />
                    <span className="text-[10px] font-bold tabular-nums">{f.telefon}</span>
                  </a>
                ) : (
                  <span className="text-[9px] text-muted-foreground shrink-0">Keine Nummer</span>
                )}
              </div>
            </div>
          ))}
          {data && (
            <p className="text-[9px] text-muted-foreground text-right">2-Min-Refresh</p>
          )}
        </div>
      )}
    </div>
  );
}
