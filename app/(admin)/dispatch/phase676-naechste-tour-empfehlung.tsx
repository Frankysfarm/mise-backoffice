'use client';

/**
 * Phase 676 — Optimale-Nächste-Tour-Empfehlung
 * Zeigt welcher Fahrer die nächste Bestellung übernehmen sollte,
 * basierend auf Verfügbarkeit, Standort und Effizienz-Score.
 * Props: locationId: string | null
 */

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Star, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type FahrerEffizienz = {
  driverId: string;
  name: string;
  score: number;
  stufe: 'top' | 'gut' | 'mittel' | 'niedrig';
  lieferungenProH: number;
  kmProTour: number;
  status: 'verfügbar' | 'unterwegs' | 'pause';
  rueckkehrMin?: number | null;
};

const STUFE_STYLE = {
  top:     { bg: 'bg-matcha-100',  text: 'text-matcha-800',  border: 'border-matcha-300',  label: 'Top'    },
  gut:     { bg: 'bg-blue-50',     text: 'text-blue-800',    border: 'border-blue-200',    label: 'Gut'    },
  mittel:  { bg: 'bg-amber-50',    text: 'text-amber-800',   border: 'border-amber-200',   label: 'Mittel' },
  niedrig: { bg: 'bg-red-50',      text: 'text-red-800',     border: 'border-red-200',     label: 'Niedrig'},
};

export function DispatchPhase676NaechsteTourEmpfehlung({ locationId }: { locationId: string | null }) {
  const [fahrer, setFahrer] = useState<FahrerEffizienz[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;

    const load = async () => {
      setLoading(true);
      try {
        const [effRes, ampelRes] = await Promise.all([
          fetch(`/api/delivery/admin/fahrer-touren-effizienz?location_id=${locationId}`),
          fetch(`/api/delivery/admin/fahrer-verfuegbarkeits-ampel?location_id=${locationId}`).catch(() => null),
        ]);

        type EffData = { ok: boolean; fahrer: Array<{ driverId: string; name: string; score: number; stufe: string; lieferungenProH: number; kmProTour: number }> };
        type AmpelEntry = { driverId: string; status: string; rueckkehrMin?: number | null };

        const effData: EffData = effRes.ok ? await effRes.json() : { ok: false, fahrer: [] };
        const ampelData: { ok: boolean; fahrer: AmpelEntry[] } | null = ampelRes?.ok ? await ampelRes.json() : null;

        const ampelMap = new Map<string, AmpelEntry>(
          (ampelData?.fahrer ?? []).map((f: AmpelEntry) => [f.driverId, f]),
        );

        const merged: FahrerEffizienz[] = (effData.fahrer ?? []).map(f => {
          const a = ampelMap.get(f.driverId);
          return {
            driverId: f.driverId,
            name: f.name,
            score: f.score,
            stufe: f.stufe as FahrerEffizienz['stufe'],
            lieferungenProH: f.lieferungenProH,
            kmProTour: f.kmProTour,
            status: (a?.status as FahrerEffizienz['status']) ?? 'verfügbar',
            rueckkehrMin: a?.rueckkehrMin ?? null,
          };
        });

        // Freie Fahrer nach Score sortiert
        merged.sort((a, b) => {
          if (a.status === 'verfügbar' && b.status !== 'verfügbar') return -1;
          if (b.status === 'verfügbar' && a.status !== 'verfügbar') return 1;
          return b.score - a.score;
        });

        setFahrer(merged);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!locationId) return null;

  const frei = fahrer.filter(f => f.status === 'verfügbar');
  const empfohlen = frei[0] ?? null;

  return (
    <Card className="overflow-hidden border-matcha-200">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-matcha-200/60 hover:bg-muted/30 transition"
      >
        <Zap className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider text-matcha-800">
          Nächste Tour · Empfehlung
        </span>
        {empfohlen && (
          <Badge className="bg-matcha-600 text-white ml-1">
            → {empfohlen.name.split(' ')[0]}
          </Badge>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {frei.length} frei
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y">
          {loading && fahrer.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground animate-pulse">Lade…</div>
          )}

          {!loading && fahrer.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Keine Fahrer verfügbar.</div>
          )}

          {fahrer.slice(0, 6).map((f, idx) => {
            const s = STUFE_STYLE[f.stufe];
            const isBest = idx === 0 && f.status === 'verfügbar';
            return (
              <div
                key={f.driverId}
                className={cn(
                  'px-4 py-3 flex items-center gap-3',
                  isBest ? 'bg-matcha-50' : f.status !== 'verfügbar' ? 'opacity-60' : '',
                )}
              >
                {/* Rang + Empfehlung */}
                <div className="shrink-0 w-6 text-center">
                  {isBest ? (
                    <Star className="h-4 w-4 text-matcha-600 fill-matcha-400" />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">{idx + 1}</span>
                  )}
                </div>

                {/* Name + Status */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold truncate">{f.name}</span>
                    <span className={cn(
                      'text-[9px] font-bold rounded-full px-1.5 py-0.5',
                      f.status === 'verfügbar' ? 'bg-matcha-100 text-matcha-700' :
                      f.status === 'pause' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    )}>
                      {f.status === 'verfügbar' ? '● Frei' : f.status === 'pause' ? '⏸ Pause' : '🚴 Unterwegs'}
                    </span>
                    {f.rueckkehrMin != null && f.status === 'unterwegs' && (
                      <span className="text-[10px] text-muted-foreground">~{f.rueckkehrMin} Min</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                    <span>{f.lieferungenProH.toFixed(1)}/h</span>
                    <span>{f.kmProTour.toFixed(1)} km/Tour</span>
                  </div>
                </div>

                {/* Score + Stufe */}
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-black tabular-nums">{f.score}</div>
                  <div className={cn('text-[8px] font-bold rounded-full px-1.5 py-0.5 text-center', s.bg, s.text, s.border, 'border')}>
                    {s.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
