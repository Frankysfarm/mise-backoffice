'use client';

import * as React from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type PhotonFeature = {
  properties: {
    osm_id: number;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    type?: string;
  };
  geometry: {
    coordinates: [number, number]; // [lng, lat]
  };
};

export type AddressValue = {
  strasse: string;
  plz: string;
  stadt: string;
  lat: number | null;
  lng: number | null;
};

type Props = {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  /** Fokus-Stadt/Filial-Koordinaten — priorisiert nahe Treffer */
  bias?: { lat: number; lng: number };
  countryCode?: string; // default 'de'
  autoFocus?: boolean;
};

const PHOTON_URL = 'https://photon.komoot.io/api/';

export function AddressAutocomplete({ value, onChange, bias, countryCode = 'de', autoFocus }: Props) {
  const [query, setQuery] = React.useState(value.strasse || '');
  const [results, setResults] = React.useState<PhotonFeature[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const [picked, setPicked] = React.useState<boolean>(!!value.lat);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = React.useRef<AbortController | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Sync: wenn value extern geändert wird (z.B. geleert), update query
  React.useEffect(() => {
    if (value.strasse !== query && !open) setQuery(value.strasse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.strasse]);

  // Close on outside click
  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function runSearch(q: string) {
    if (q.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    abort.current?.abort();
    abort.current = new AbortController();
    const params = new URLSearchParams({
      q,
      limit: '6',
      lang: 'de',
      layer: 'house',
    });
    // OSM-Tag für Adresse priorisieren
    params.append('osm_tag', '!place');
    if (bias) {
      params.set('lat', String(bias.lat));
      params.set('lon', String(bias.lng));
    }
    setLoading(true);
    fetch(`${PHOTON_URL}?${params.toString()}`, { signal: abort.current.signal })
      .then((r) => r.json())
      .then((json) => {
        const features: PhotonFeature[] = (json?.features ?? []).filter((f: PhotonFeature) => {
          const cc = f.properties.country?.toLowerCase();
          return !countryCode || !cc || cc.startsWith(countryCode) || cc.includes('german');
        });
        setResults(features);
        setHighlight(0);
        setOpen(features.length > 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function onType(v: string) {
    setQuery(v);
    setPicked(false);
    // Wenn Nutzer tippt, lat/lng entwerten
    onChange({ ...value, strasse: v, lat: null, lng: null });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(v), 220);
  }

  function pick(f: PhotonFeature) {
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    const strasse = [p.street ?? p.name, p.housenumber].filter(Boolean).join(' ').trim();
    const v: AddressValue = {
      strasse: strasse || query,
      plz: p.postcode ?? value.plz,
      stadt: p.city ?? p.district ?? value.stadt,
      lat,
      lng,
    };
    onChange(v);
    setQuery(v.strasse);
    setResults([]);
    setOpen(false);
    setPicked(true);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-600">
        Lieferadresse
      </label>
      <div className="relative mt-1.5">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-matcha-700/60">
          {picked ? <MapPin className="h-4 w-4 text-matcha-700" /> : <Search className="h-4 w-4" />}
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Straße Hausnummer, Stadt …"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-autocomplete="list"
          aria-expanded={open}
          className="w-full rounded-xl border border-black/10 bg-white py-3 pl-10 pr-10 text-base outline-none transition focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
        />
        {loading && (
          <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-matcha-700/60" />
        )}
        {!loading && picked && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full bg-matcha-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-matcha-700"
            title="Adresse verifiziert"
          >
            ✓ Verifiziert
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1.5 max-h-72 overflow-auto rounded-xl border border-black/10 bg-white shadow-strong"
        >
          {results.map((f, i) => {
            const p = f.properties;
            const primary = [p.street ?? p.name, p.housenumber].filter(Boolean).join(' ');
            const secondary = [p.postcode, p.city ?? p.district, p.country].filter(Boolean).join(', ');
            const active = i === highlight;
            return (
              <li key={`${p.osm_id}-${i}`} role="option" aria-selected={active}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(f)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-2.5 text-left transition',
                    active ? 'bg-matcha-50' : 'hover:bg-black/[0.03]',
                  )}
                >
                  <MapPin className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'text-matcha-700' : 'text-matcha-700/60')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-matcha-900">{primary || p.name || 'Adresse'}</span>
                    <span className="block truncate text-xs text-matcha-700/60">{secondary}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Manueller Fallback: PLZ + Stadt nur sichtbar falls Suche umgangen wird */}
      {(value.strasse && (!value.plz || !value.stadt)) && (
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-2 text-xs">
          <input
            type="text"
            inputMode="numeric"
            value={value.plz}
            onChange={(e) => onChange({ ...value, plz: e.target.value })}
            placeholder="PLZ"
            className="w-20 rounded-lg border border-black/10 bg-white px-2.5 py-2 outline-none focus:border-matcha-700"
          />
          <input
            type="text"
            value={value.stadt}
            onChange={(e) => onChange({ ...value, stadt: e.target.value })}
            placeholder="Stadt"
            className="rounded-lg border border-black/10 bg-white px-2.5 py-2 outline-none focus:border-matcha-700"
          />
        </div>
      )}
    </div>
  );
}
