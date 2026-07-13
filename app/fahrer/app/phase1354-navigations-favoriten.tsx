'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Navigation, Star, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1354 — Navigations-Favoriten (Fahrer-App)
 *
 * Häufige Adressen (aus Tour-Historie) als Schnellauswahl.
 * localStorage-persistiert. 1-Tap-Navigation-Link (Google/Apple/Waze).
 * Nach Phase1350 in fahrer/app/client.tsx.
 */

interface FavoritAdresse {
  id: string;
  adresse: string;
  plz?: string | null;
  lat?: number | null;
  lng?: number | null;
  besuche: number;
  zuletzt: string;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const STORAGE_KEY = 'mise_nav_favoriten';
const MAX_FAVORITEN = 8;

function loadFavoriten(driverId: string): FavoritAdresse[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${driverId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFavoriten(driverId: string, favoriten: FavoritAdresse[]) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${driverId}`, JSON.stringify(favoriten));
  } catch {
    // ignore
  }
}

function buildNavUrl(provider: 'google' | 'apple' | 'waze', fav: FavoritAdresse): string {
  if (fav.lat && fav.lng) {
    const coords = `${fav.lat},${fav.lng}`;
    if (provider === 'google') return `https://www.google.com/maps/dir/?api=1&destination=${coords}`;
    if (provider === 'apple')  return `maps://?daddr=${coords}`;
    if (provider === 'waze')   return `https://waze.com/ul?ll=${coords}&navigate=yes`;
  }
  const q = encodeURIComponent(`${fav.adresse} ${fav.plz ?? ''}`.trim());
  if (provider === 'google') return `https://www.google.com/maps/search/?api=1&query=${q}`;
  if (provider === 'apple')  return `maps://?q=${q}`;
  if (provider === 'waze')   return `https://waze.com/ul?q=${q}`;
  return '#';
}

export function FahrerPhase1354NavigationsFavoriten({ driverId, isOnline }: Props) {
  const [favoriten, setFavoriten] = useState<FavoritAdresse[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [activeNav, setActiveNav] = useState<string | null>(null);

  useEffect(() => {
    setFavoriten(loadFavoriten(driverId));
  }, [driverId]);

  const sorted = useMemo(
    () => [...favoriten].sort((a, b) => b.besuche - a.besuche).slice(0, MAX_FAVORITEN),
    [favoriten]
  );

  const removeFavorit = useCallback((id: string) => {
    setFavoriten(prev => {
      const updated = prev.filter(f => f.id !== id);
      saveFavoriten(driverId, updated);
      return updated;
    });
  }, [driverId]);

  const navigate = useCallback((fav: FavoritAdresse, provider: 'google' | 'apple' | 'waze') => {
    const url = buildNavUrl(provider, fav);
    window.open(url, '_blank', 'noopener');
    setActiveNav(null);
  }, []);

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm font-bold">Navigations-Favoriten</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Noch keine Favoriten. Adressen werden automatisch aus der Tour-Historie gespeichert.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center gap-2 text-left"
      >
        <Star className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-sm font-bold flex-1">Navigations-Favoriten</span>
        <span className="text-[11px] text-muted-foreground">{sorted.length} Adressen</span>
      </button>

      {expanded && (
        <div className="space-y-2">
          {sorted.map(fav => (
            <div key={fav.id} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fav.adresse}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {fav.plz && <span>{fav.plz} · </span>}
                    {fav.besuche}× besucht
                  </p>
                </div>
                <button
                  onClick={() => removeFavorit(fav.id)}
                  className="rounded p-1 hover:bg-red-100 dark:hover:bg-red-900/30 transition"
                  title="Entfernen"
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </button>
              </div>

              {activeNav === fav.id ? (
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <button onClick={() => navigate(fav, 'google')} className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700 transition">Google</button>
                  <button onClick={() => navigate(fav, 'apple')}  className="rounded-md bg-gray-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-gray-800 transition">Apple</button>
                  <button onClick={() => navigate(fav, 'waze')}   className="rounded-md bg-cyan-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-cyan-700 transition">Waze</button>
                  <button onClick={() => setActiveNav(null)} className="rounded-md p-1 hover:bg-muted transition"><X className="h-3 w-3 text-muted-foreground" /></button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveNav(fav.id)}
                  disabled={!isOnline}
                  className={cn(
                    'mt-2 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold transition',
                    isOnline
                      ? 'bg-primary text-primary-foreground hover:opacity-90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  <Navigation className="h-3 w-3" />
                  Navigation starten
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
