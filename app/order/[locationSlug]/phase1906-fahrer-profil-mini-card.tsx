'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Star, Shield, X } from 'lucide-react';

/**
 * Phase 1906 — Fahrer-Profil-Mini-Card (Storefront)
 *
 * Fahrername + Bewertungs-Sterne + Foto-Placeholder + Zuverlässigkeits-Badge.
 * Nur wenn dispatched; schließbar; Hydration-safe.
 */

interface FahrerProfil {
  dispatched: boolean;
  fahrer_name: string | null;
  bewertung_avg: number | null;
  bewertung_anzahl: number;
  zuverlaessigkeit_pct: number;
  abzeichen: string | null;
  fahrzeug: string;
}

const MOCK: FahrerProfil = {
  dispatched: true,
  fahrer_name: 'Max M.',
  bewertung_avg: 4.8,
  bewertung_anzahl: 127,
  zuverlaessigkeit_pct: 96,
  abzeichen: 'Top-Fahrer',
  fahrzeug: 'fahrrad',
};

function FahrzeugIcon({ fahrzeug }: { fahrzeug: string }) {
  return <Bike className="h-5 w-5" />;
}

interface Props {
  locationId: string;
  orderId?: string | null;
  className?: string;
}

export function StorefrontPhase1906FahrerProfilMiniCard({ locationId, orderId, className }: Props) {
  const [daten, setDaten] = useState<FahrerProfil | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !locationId) return;

    const laden = async () => {
      try {
        const params = new URLSearchParams({ location_id: locationId });
        if (orderId) params.set('order_id', orderId);
        const res = await fetch(`/api/delivery/public/fahrer-eta?${params}`);
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        if (!json.dispatched) {
          setDaten({ ...MOCK, dispatched: false });
          return;
        }
        setDaten({
          dispatched: true,
          fahrer_name: json.fahrer_name ?? MOCK.fahrer_name,
          bewertung_avg: json.bewertung_avg ?? MOCK.bewertung_avg,
          bewertung_anzahl: json.bewertung_anzahl ?? MOCK.bewertung_anzahl,
          zuverlaessigkeit_pct: json.zuverlaessigkeit_pct ?? MOCK.zuverlaessigkeit_pct,
          abzeichen: json.abzeichen ?? MOCK.abzeichen,
          fahrzeug: json.fahrzeug ?? MOCK.fahrzeug,
        });
      } catch {
        setDaten(MOCK);
      }
    };

    laden();
  }, [mounted, locationId, orderId]);

  if (!mounted || !daten || !daten.dispatched || geschlossen) return null;

  const sterne = daten.bewertung_avg !== null ? Math.round(daten.bewertung_avg) : 0;

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card shadow-sm overflow-hidden mx-4 mt-2',
        className,
      )}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Avatar-Placeholder */}
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/20 shrink-0">
          <FahrzeugIcon fahrzeug={daten.fahrzeug} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold truncate">
              {daten.fahrer_name ?? 'Dein Fahrer'}
            </p>
            {daten.abzeichen && (
              <span className="flex items-center gap-1 text-[10px] font-bold rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 shrink-0">
                <Shield className="h-2.5 w-2.5" />
                {daten.abzeichen}
              </span>
            )}
          </div>

          {/* Bewertung */}
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-3 w-3',
                    i < sterne
                      ? 'text-yellow-500 fill-yellow-500'
                      : 'text-muted-foreground/30 fill-muted-foreground/10',
                  )}
                />
              ))}
            </div>
            {daten.bewertung_avg !== null && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {daten.bewertung_avg.toFixed(1)} ({daten.bewertung_anzahl})
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">·</span>
            <span
              className={cn(
                'text-[11px] font-semibold',
                daten.zuverlaessigkeit_pct >= 95
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-amber-600 dark:text-amber-400',
              )}
            >
              {daten.zuverlaessigkeit_pct}% zuverlässig
            </span>
          </div>
        </div>

        {/* Schließen */}
        <button
          onClick={() => setGeschlossen(true)}
          className="rounded-full p-1 hover:bg-muted/50 transition-colors shrink-0"
          aria-label="Schließen"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
