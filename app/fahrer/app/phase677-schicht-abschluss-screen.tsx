'use client';

/**
 * Phase 677 — Fahrer-App Schicht-Abschluss-Screen
 * Zusammenfassung beim Schichtende: Score-Ring + Einnahmen + Touren + Km + Trinkgeld + Bewertung.
 * Zeigt Glückwunsch-Banner bei guter Performance.
 * Props: driverId, locationId
 */

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Star, TrendingUp, Bike, MapPin, Euro } from 'lucide-react';

type Zusammenfassung = {
  name: string;
  schichtDauerMin: number;
  touren: number;
  lieferungen: number;
  kmHeute: number;
  trinkgeld: number;
  avgRating: number | null;
  ratingAnzahl: number;
  gesamtScore: number;
  stufe: 'top' | 'gut' | 'mittel' | 'niedrig';
  shiftStatus: string;
};

const STUFE_COLOR = {
  top:     { ring: '#22c55e', bg: 'bg-matcha-50',  text: 'text-matcha-700',  label: 'Herausragend! 🏆' },
  gut:     { ring: '#3b82f6', bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'Sehr gut! 👍'     },
  mittel:  { ring: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'Solide Leistung'  },
  niedrig: { ring: '#ef4444', bg: 'bg-red-50',     text: 'text-red-700',     label: 'Verbesserungspotenzial' },
};

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-black tabular-nums leading-none">{score}</span>
        <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Score</span>
      </div>
    </div>
  );
}

export function FahrerPhase677SchichtAbschlussScreen({
  driverId,
  locationId,
}: {
  driverId: string;
  locationId: string;
}) {
  const [data, setData] = useState<Zusammenfassung | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId || !locationId) return;

    const load = () => {
      fetch(`/api/delivery/admin/schicht-abschluss-zusammenfassung?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.ok && d.zusammenfassung) setData(d.zusammenfassung);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };

    load();
  }, [driverId, locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-5 animate-pulse">
        <div className="h-4 w-40 bg-muted rounded mb-3" />
        <div className="h-24 bg-muted rounded" />
      </div>
    );
  }

  if (!data) return null;

  const col = STUFE_COLOR[data.stufe];
  const schichtH = Math.floor(data.schichtDauerMin / 60);
  const schichtMin = data.schichtDauerMin % 60;

  const kpis = [
    { icon: Bike,    label: 'Touren',    value: data.touren.toString(),                                  color: 'text-matcha-600' },
    { icon: MapPin,  label: 'km heute',  value: `${data.kmHeute.toFixed(1)} km`,                          color: 'text-blue-600'   },
    { icon: Euro,    label: 'Trinkgeld', value: `${data.trinkgeld.toFixed(2).replace('.', ',')} €`,       color: 'text-amber-600'  },
    { icon: Star,    label: 'Ø Bewertung', value: data.avgRating !== null ? `${data.avgRating.toFixed(1)} ★` : '—', color: 'text-yellow-500' },
  ];

  return (
    <div className={cn('rounded-2xl border p-5 space-y-4', col.bg)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <CheckCircle2 className={cn('h-5 w-5 shrink-0', col.text)} />
        <div>
          <div className={cn('font-display text-sm font-black uppercase tracking-wider', col.text)}>
            Schicht abgeschlossen
          </div>
          <div className="text-xs text-muted-foreground">
            {schichtH > 0 ? `${schichtH}h ` : ''}{schichtMin}min · {data.lieferungen} Lieferungen
          </div>
        </div>
      </div>

      {/* Score + Glückwunsch */}
      <div className="flex items-center gap-4">
        <ScoreRing score={data.gesamtScore} color={col.ring} />
        <div className="flex-1">
          <div className={cn('font-display text-base font-black', col.text)}>{col.label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Schicht-Qualitäts-Score: {data.gesamtScore}/100
          </div>
          {data.avgRating !== null && data.ratingAnzahl > 0 && (
            <div className="flex items-center gap-1 mt-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={cn('h-3 w-3', i < Math.round(data.avgRating ?? 0) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground')}
                />
              ))}
              <span className="text-[10px] text-muted-foreground ml-1">({data.ratingAnzahl})</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2">
        {kpis.map(kpi => (
          <div key={kpi.label} className="rounded-xl bg-white/60 border border-white/80 px-3 py-2 flex items-center gap-2">
            <kpi.icon className={cn('h-4 w-4 shrink-0', kpi.color)} />
            <div>
              <div className={cn('text-sm font-black tabular-nums', kpi.color)}>{kpi.value}</div>
              <div className="text-[10px] text-muted-foreground">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tipp bei niedrigem Score */}
      {data.stufe === 'niedrig' && (
        <div className="flex items-start gap-2 rounded-xl bg-red-100 border border-red-200 px-3 py-2 text-xs text-red-800">
          <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Tipp: Kürzere Routen wählen und pünktliche Lieferungen steigern den Score deutlich.</span>
        </div>
      )}
    </div>
  );
}
