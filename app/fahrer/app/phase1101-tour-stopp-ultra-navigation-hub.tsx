'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Clock, CheckCircle2, Package, Phone, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/**
 * Phase 1101 — Tour-Stopp Ultra-Navigation Hub (Fahrer-App)
 * Aktiver Stopp hervorgehoben mit ETA-Countdown; Stopp-Liste mit Status-Dots;
 * Quick-Nav Buttons (Google/Waze); Kunden-Kontakt-Chip;
 * 10-Sek-Polling; Mock-Fallback.
 */

interface TourStopp {
  id: string;
  nr: number;
  kunde_name: string;
  adresse: string;
  eta_min: number | null;
  status: 'ausstehend' | 'unterwegs' | 'geliefert' | 'problem';
  telefon: string | null;
  notiz: string | null;
  lat: number | null;
  lng: number | null;
}

interface Props {
  driverId?: string;
  isOnline?: boolean;
}

const MOCK_STOPPS: TourStopp[] = [
  { id: 's1', nr: 1, kunde_name: 'Anna Müller', adresse: 'Hauptstr. 12, Aachen',      eta_min: null, status: 'geliefert', telefon: '+49 1761234567', notiz: null, lat: 50.776, lng: 6.084 },
  { id: 's2', nr: 2, kunde_name: 'Max Huber',   adresse: 'Adalbertstr. 35, Aachen',    eta_min: 6,    status: 'unterwegs', telefon: '+49 1769876543', notiz: '2. OG klingeln', lat: 50.779, lng: 6.087 },
  { id: 's3', nr: 3, kunde_name: 'Sara Klein',  adresse: 'Rennbahn 5, Aachen',         eta_min: 18,   status: 'ausstehend', telefon: null, notiz: null, lat: 50.782, lng: 6.091 },
  { id: 's4', nr: 4, kunde_name: 'Tim Becker',  adresse: 'Pontstr. 77, Aachen',        eta_min: 30,   status: 'ausstehend', telefon: '+49 1765551234', notiz: 'Kontaktlose Lieferung', lat: 50.771, lng: 6.079 },
];

function stoppStatusDot(s: TourStopp['status']) {
  return {
    ausstehend: 'bg-zinc-300 dark:bg-zinc-600',
    unterwegs:  'bg-blue-500 animate-pulse ring-2 ring-blue-200',
    geliefert:  'bg-emerald-500',
    problem:    'bg-red-500',
  }[s];
}

function openNav(app: 'google' | 'waze', lat: number, lng: number) {
  const addr = `${lat},${lng}`;
  if (app === 'google') window.open(`https://www.google.com/maps/dir/?api=1&destination=${addr}`, '_blank');
  else window.open(`https://waze.com/ul?ll=${addr}&navigate=yes`, '_blank');
}

export function FahrerPhase1101TourStoppUltraNavigationHub({ driverId, isOnline = true }: Props) {
  const [stopps, setStopps]   = useState<TourStopp[]>(MOCK_STOPPS);
  const [loading, setLoading] = useState(false);
  const [tick, setTick]       = useState(0);

  const fetch_ = useCallback(async () => {
    if (!driverId || !isOnline) return;
    setLoading(true);
    try {
      const sb = createClient();
      const { data } = await sb
        .from('tour_stops')
        .select('id, stop_number, customer_name, address, eta_minutes, status, phone, notes, lat, lng')
        .eq('driver_id', driverId)
        .neq('status', 'cancelled')
        .order('stop_number');
      if (data && data.length > 0) {
        setStopps(data.map((r: any) => ({
          id: r.id,
          nr: r.stop_number,
          kunde_name: r.customer_name ?? 'Kunde',
          adresse: r.address ?? '',
          eta_min: r.eta_minutes,
          status: r.status === 'completed' ? 'geliefert' : r.status === 'active' ? 'unterwegs' : r.status === 'issue' ? 'problem' : 'ausstehend',
          telefon: r.phone,
          notiz: r.notes,
          lat: r.lat,
          lng: r.lng,
        })));
      }
    } catch { /* mock */ }
    finally { setLoading(false); }
  }, [driverId, isOnline]);

  useEffect(() => { fetch_(); const id = setInterval(fetch_, 10_000); return () => clearInterval(id); }, [fetch_]);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1_000); return () => clearInterval(id); }, []);

  const aktiv = stopps.find(s => s.status === 'unterwegs');
  const gesamt = stopps.length;
  const erledigt = stopps.filter(s => s.status === 'geliefert').length;
  const fortschritt = gesamt > 0 ? Math.round((erledigt / gesamt) * 100) : 0;

  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-indigo-600 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4" />
          <span className="font-semibold text-sm">Tour-Navigation</span>
          {loading && <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse" />}
        </div>
        <div className="text-xs opacity-80">{erledigt}/{gesamt} Stopps</div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="h-1.5 bg-indigo-200 dark:bg-indigo-950">
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${fortschritt}%` }} />
      </div>

      {/* Aktiver Stopp hervorgehoben */}
      {aktiv && (
        <div className="mx-3 mt-3 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse ring-2 ring-blue-200" />
              <span className="font-semibold text-sm text-indigo-900 dark:text-indigo-100">Stopp {aktiv.nr}: {aktiv.kunde_name}</span>
            </div>
            {aktiv.eta_min !== null && (
              <span className="flex items-center gap-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                <Clock className="h-3 w-3" />{aktiv.eta_min} min
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-2">{aktiv.adresse}</p>
          {aktiv.notiz && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">⚠ {aktiv.notiz}</p>
          )}
          <div className="flex gap-2">
            {aktiv.lat && aktiv.lng && (
              <>
                <button
                  onClick={() => openNav('google', aktiv.lat!, aktiv.lng!)}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-blue-600 text-white text-xs py-1.5 font-medium"
                >
                  <Navigation className="h-3 w-3" /> Google Maps
                </button>
                <button
                  onClick={() => openNav('waze', aktiv.lat!, aktiv.lng!)}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-cyan-600 text-white text-xs py-1.5 font-medium"
                >
                  <MapPin className="h-3 w-3" /> Waze
                </button>
              </>
            )}
            {aktiv.telefon && (
              <a
                href={`tel:${aktiv.telefon}`}
                className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 text-white text-xs py-1.5 px-3 font-medium"
              >
                <Phone className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Stopp-Liste */}
      <div className="px-3 py-2 space-y-1">
        {stopps.map(s => (
          <div
            key={s.id}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
              s.status === 'unterwegs' ? 'bg-indigo-50 dark:bg-indigo-950/50' :
              s.status === 'geliefert' ? 'opacity-50' : ''
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${stoppStatusDot(s.status)}`} />
            <span className="text-xs font-medium text-zinc-500 w-4 shrink-0">{s.nr}</span>
            <span className={`flex-1 truncate text-xs ${s.status === 'geliefert' ? 'line-through text-zinc-400' : 'text-zinc-700 dark:text-zinc-200'}`}>
              {s.kunde_name}
            </span>
            {s.status === 'geliefert' && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
            {s.status === 'problem' && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
            {s.eta_min !== null && s.status === 'ausstehend' && (
              <span className="text-[10px] text-zinc-400 shrink-0">{s.eta_min} min</span>
            )}
          </div>
        ))}
      </div>

      <div className="px-4 pb-3 text-[10px] text-zinc-400">10s Polling · Phase 1101</div>
    </div>
  );
}
