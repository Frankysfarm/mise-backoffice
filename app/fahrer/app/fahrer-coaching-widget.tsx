'use client';

import React, { useState, useEffect } from 'react';
import { Lightbulb, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';

interface CoachingHinweis {
  id:                 string;
  puenktlichkeitPct:  number;
  zielPct:            number;
  hinweise:           string[];
  kategorie:          'kritisch' | 'warnung' | 'info';
  gesehenAm:          string | null;
}

interface Props {
  driverId: string;
  locationId: string;
}

const KATEGORIE_STYLE = {
  kritisch: { bg: 'bg-rose-950',   border: 'border-rose-700',  badge: 'bg-rose-700 text-white',  label: 'Kritisch' },
  warnung:  { bg: 'bg-amber-950',  border: 'border-amber-700', badge: 'bg-amber-600 text-white', label: 'Verbesserungsbedarf' },
  info:     { bg: 'bg-green-950',  border: 'border-green-700', badge: 'bg-green-700 text-white', label: 'Gut gemacht' },
};

export function FahrerCoachingWidget({ driverId, locationId }: Props) {
  const [hinweis, setHinweis] = useState<CoachingHinweis | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/delivery/driver/coaching?driver_id=${driverId}&location_id=${locationId}`)
      .then(r => r.json())
      .then(j => { if (j.ok && j.hinweis) setHinweis(j.hinweis); })
      .finally(() => setLoading(false));
  }, [driverId, locationId]);

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next && hinweis && !hinweis.gesehenAm) {
      await fetch('/api/delivery/driver/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: hinweis.id, action: 'seen' }),
      });
      setHinweis(h => h ? { ...h, gesehenAm: new Date().toISOString() } : null);
    }
  }

  if (loading || !hinweis) return null;

  const style = KATEGORIE_STYLE[hinweis.kategorie];

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} overflow-hidden`}>
      <button
        onClick={handleOpen}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <Lightbulb className="w-4 h-4 text-yellow-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">Pünktlichkeits-Coach</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
              {style.label}
            </span>
          </div>
          <div className="text-xs text-stone-400 mt-0.5">
            Pünktlichkeit: <span className="text-white font-medium">{hinweis.puenktlichkeitPct.toFixed(0)}%</span>
            {' '}(Ziel: {hinweis.zielPct}%)
          </div>
        </div>
        <span className="text-stone-400 shrink-0">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {/* Progress-Balken */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-stone-400">
              <span>Aktuell</span>
              <span>Ziel {hinweis.zielPct}%</span>
            </div>
            <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  hinweis.puenktlichkeitPct >= hinweis.zielPct
                    ? 'bg-green-500'
                    : hinweis.puenktlichkeitPct >= 70
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, hinweis.puenktlichkeitPct)}%` }}
              />
            </div>
          </div>

          {/* Hinweise */}
          <div className="space-y-1.5 pt-1">
            {hinweis.hinweise.map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-yellow-400 text-xs mt-0.5 shrink-0">→</span>
                <p className="text-xs text-stone-300 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>

          {hinweis.gesehenAm && (
            <div className="flex items-center gap-1 text-[10px] text-green-400 pt-1">
              <CheckCircle className="w-3 h-3" />
              Gesehen
            </div>
          )}
        </div>
      )}
    </div>
  );
}
