'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, MapPin, Star, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1085 — Fahrerzuteilung-Vorschlag (Dispatch)
// Rangliste verfügbarer Fahrer passend zur nächsten Bestellung

interface FahrerVorschlag {
  fahrer_id: string;
  fahrer_name: string;
  zone: string;
  score: number;
  bewertung: number;
  aktive_touren: number;
  match_level: 'optimal' | 'gut' | 'akzeptabel';
  grund: string;
}

interface ApiData {
  vorschlaege: FahrerVorschlag[];
  offene_bestellungen: number;
  naechste_zone: string | null;
  generiert_am: string;
}

const MATCH_CFG = {
  optimal:    { badge: 'bg-emerald-100 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500', label: 'Optimal' },
  gut:        { badge: 'bg-blue-100 text-blue-700 border-blue-300',          dot: 'bg-blue-500',   label: 'Gut' },
  akzeptabel: { badge: 'bg-amber-100 text-amber-700 border-amber-300',       dot: 'bg-amber-400',  label: 'Akzeptabel' },
} satisfies Record<FahrerVorschlag['match_level'], { badge: string; dot: string; label: string }>;

const RANG_EMOJI = ['🥇', '🥈', '🥉'];

export function DispatchPhase1085FahrerzuteilungVorschlag({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrerzuteilung-vorschlag?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const id = setInterval(load, 90_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="rounded-xl border border-emerald-300 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100/50 transition"
      >
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-bold">Fahrerzuteilung-Vorschlag</span>
          {data && (
            <span className="inline-flex items-center rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              {data.vorschlaege.length} Fahrer · {data.offene_bestellungen} offen
            </span>
          )}
          {data?.naechste_zone && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" />Zone {data.naechste_zone} next
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y divide-border bg-background">
          {!locationId && (
            <p className="px-4 py-3 text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {locationId && !data && !loading && (
            <p className="px-4 py-3 text-sm text-muted-foreground">Keine Daten verfügbar.</p>
          )}

          {data?.vorschlaege.map((f, idx) => {
            const cfg = MATCH_CFG[f.match_level];
            return (
              <div key={f.fahrer_id} className="px-4 py-3 flex items-center gap-3">
                <span className="text-lg w-6 shrink-0 text-center">{RANG_EMOJI[idx] ?? `#${idx + 1}`}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm truncate">{f.fahrer_name}</span>
                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold', cfg.badge)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Zone {f.zone}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{f.grund}</p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <div className="flex items-center gap-0.5 justify-end">
                    <Star className="h-3 w-3 text-amber-500 fill-amber-400" />
                    <span className="text-xs font-bold tabular-nums">{f.bewertung.toFixed(1)}</span>
                  </div>
                  <div className="text-[10px] font-black text-emerald-700 tabular-nums">{f.score}P</div>
                </div>
              </div>
            );
          })}

          {data && data.vorschlaege.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">Keine verfügbaren Fahrer.</p>
          )}

          {data && (
            <div className="px-4 py-2 bg-muted/20">
              <p className="text-[10px] text-muted-foreground">Score = Zone-Match + Bewertung − Auslastung · 90s-Polling</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
