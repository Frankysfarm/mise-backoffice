'use client';

// Phase 1255 — Bewertungs-Karussell (Storefront)
// Letzte 6 Kundenbewertungen als auto-scrollende Karten (Name + Sterne + Kommentar + Datum)
// Props: locationId · auto-scroll alle 4s

import { useEffect, useRef, useState } from 'react';
import { Star, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Bewertung {
  id: string;
  kunden_name: string;
  sterne: number;
  kommentar: string | null;
  datum: string;
}

interface ApiResponse {
  bewertungen: Bewertung[];
  location_id: string;
  generiert_am: string;
}

const MOCK_BEWERTUNGEN: Bewertung[] = [
  { id: 'r1', kunden_name: 'Sarah M.',    sterne: 5, kommentar: 'Superschnelle Lieferung, alles noch heiß angekommen!', datum: new Date(Date.now() - 2*3600000).toISOString() },
  { id: 'r2', kunden_name: 'Markus B.',   sterne: 5, kommentar: 'Wie immer top Qualität. Bestelle hier regelmäßig.', datum: new Date(Date.now() - 5*3600000).toISOString() },
  { id: 'r3', kunden_name: 'Lena K.',     sterne: 4, kommentar: 'Sehr lecker, Fahrer war freundlich.', datum: new Date(Date.now() - 8*3600000).toISOString() },
  { id: 'r4', kunden_name: 'Thomas W.',   sterne: 5, kommentar: 'Pünktlich und frisch. Klare Weiterempfehlung!', datum: new Date(Date.now() - 24*3600000).toISOString() },
  { id: 'r5', kunden_name: 'Julia S.',    sterne: 4, kommentar: 'Gute Portion, faire Preise.', datum: new Date(Date.now() - 30*3600000).toISOString() },
  { id: 'r6', kunden_name: 'Felix H.',    sterne: 5, kommentar: 'Schneller als erwartet, perfekte Temperatur.', datum: new Date(Date.now() - 48*3600000).toISOString() },
];

function formatDatum(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 3600000;
  if (diff < 1) return 'gerade eben';
  if (diff < 24) return `vor ${Math.floor(diff)}h`;
  return `vor ${Math.floor(diff / 24)}d`;
}

function StarRow({ sterne }: { sterne: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={cn('h-3.5 w-3.5', s <= sterne ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
      ))}
    </div>
  );
}

export function Phase1255BewertungsKarussell({ locationId }: { locationId: string }) {
  const [bewertungen, setBewertungen] = useState<Bewertung[]>(MOCK_BEWERTUNGEN);
  const [activeIdx, setActiveIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`/api/delivery/public/bewertungen?location_id=${locationId}&limit=6`)
      .then(r => r.json())
      .then((d: ApiResponse) => {
        if (d.bewertungen && d.bewertungen.length > 0) setBewertungen(d.bewertungen);
      })
      .catch(() => {});
  }, [locationId]);

  // Auto-scroll
  useEffect(() => {
    if (bewertungen.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % bewertungen.length);
    }, 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [bewertungen.length]);

  if (bewertungen.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Section label */}
      <div className="flex items-center gap-1.5 px-1">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Kundenstimmen
        </span>
      </div>

      {/* Active card */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card px-4 py-3 shadow-sm min-h-[90px]">
        {bewertungen.map((b, i) => (
          <div
            key={b.id}
            className={cn(
              'absolute inset-0 px-4 py-3 transition-opacity duration-500',
              i === activeIdx ? 'opacity-100' : 'opacity-0 pointer-events-none',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <StarRow sterne={b.sterne} />
                  <span className="text-[10px] text-muted-foreground">{formatDatum(b.datum)}</span>
                </div>
                {b.kommentar && (
                  <p className="text-sm text-foreground leading-snug line-clamp-2">
                    „{b.kommentar}"
                  </p>
                )}
                <p className="text-[11px] font-semibold text-muted-foreground mt-1">
                  — {b.kunden_name}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5">
        {bewertungen.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setActiveIdx(i);
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = setInterval(() => setActiveIdx(j => (j + 1) % bewertungen.length), 4000);
              }
            }}
            className={cn(
              'w-1.5 h-1.5 rounded-full transition-all duration-300',
              i === activeIdx ? 'bg-foreground w-3' : 'bg-muted-foreground/30',
            )}
          />
        ))}
      </div>
    </div>
  );
}
