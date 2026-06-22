'use client';

import { Navigation, Phone, CheckCircle2, AlertTriangle, MapPin, ExternalLink } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickNavKommandoProps {
  stop: {
    adresse: string | null;
    plz: string | null;
    klingelname?: string | null;
    etage?: string | null;
    notiz?: string | null;
    telefon?: string | null;
    bestellnummer: string;
    kundeName: string;
  };
  onDelivered: () => void;
  onProblem: () => void;
  loading?: boolean;
}

export function QuickNavKommando({ stop, onDelivered, onProblem, loading }: QuickNavKommandoProps) {
  const adresseFull = [stop.adresse, stop.plz].filter(Boolean).join(' ');
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(adresseFull)}`;
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(stop.adresse ?? '')}`;

  return (
    <div className="bg-matcha-900 border border-matcha-700 rounded-2xl overflow-hidden w-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-matcha-700">
        <p className="text-matcha-400 text-xs font-medium uppercase tracking-wider">
          Bestellung #{stop.bestellnummer}
        </p>
        <h2 className="text-white text-xl font-bold leading-tight mt-0.5">{stop.kundeName}</h2>
      </div>

      {/* Address block */}
      <div className="bg-matcha-950/50 px-4 py-3">
        <div className="flex items-start gap-2">
          <MapPin className="text-matcha-400 mt-0.5 shrink-0" size={18} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-base leading-snug">
              {stop.adresse ?? '—'}
            </p>
            {stop.plz && (
              <p className="text-matcha-400 text-sm">{stop.plz}</p>
            )}
          </div>
        </div>

        {(stop.klingelname || stop.etage) && (
          <div className="flex flex-wrap gap-2 mt-2 ml-6">
            {stop.klingelname && (
              <span className="bg-matcha-800 text-matcha-200 text-xs font-medium px-2.5 py-1 rounded-full">
                Klingel: {stop.klingelname}
              </span>
            )}
            {stop.etage && (
              <span className="bg-matcha-800 text-matcha-200 text-xs font-medium px-2.5 py-1 rounded-full">
                Etage: {stop.etage}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Lieferhinweis */}
      {stop.notiz && (
        <div className="mx-4 mt-3 flex gap-2 items-start bg-amber-950/60 border border-amber-700/50 rounded-xl px-3 py-2.5">
          <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={16} />
          <div>
            <p className="text-amber-300 text-xs font-semibold uppercase tracking-wide">Lieferhinweis</p>
            <p className="text-amber-100 text-sm mt-0.5">{stop.notiz}</p>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm rounded-xl px-3 py-3 transition-colors"
        >
          <Navigation size={16} />
          Google Maps
          <ExternalLink size={12} className="opacity-70" />
        </a>
        <a
          href={wazeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white font-semibold text-sm rounded-xl px-3 py-3 transition-colors"
        >
          <Navigation size={16} />
          Waze
          <ExternalLink size={12} className="opacity-70" />
        </a>
      </div>

      {/* Anrufen */}
      {stop.telefon && (
        <div className="px-4 mt-2">
          <a
            href={`tel:${stop.telefon}`}
            className="flex items-center justify-center gap-2 w-full bg-green-800 hover:bg-green-700 active:bg-green-900 text-white font-semibold text-sm rounded-xl px-3 py-3 transition-colors"
          >
            <Phone size={16} />
            Anrufen
          </a>
        </div>
      )}

      {/* Zugestellt */}
      <div className="px-4 mt-3">
        <button
          onClick={onDelivered}
          disabled={loading}
          className={cn(
            'flex items-center justify-center gap-2 w-full rounded-xl px-4 py-4 text-lg font-bold transition-colors',
            'bg-matcha-500 hover:bg-matcha-400 active:bg-matcha-600 text-white',
            loading && 'opacity-70 cursor-not-allowed'
          )}
        >
          {loading ? (
            <Loader2 size={22} className="animate-spin" />
          ) : (
            <CheckCircle2 size={22} />
          )}
          Zugestellt ✓
        </button>
      </div>

      {/* Problem melden */}
      <div className="px-4 py-4 text-center">
        <button
          onClick={onProblem}
          className="text-matcha-500 hover:text-matcha-400 text-sm underline underline-offset-2 transition-colors"
        >
          Problem melden
        </button>
      </div>
    </div>
  );
}
