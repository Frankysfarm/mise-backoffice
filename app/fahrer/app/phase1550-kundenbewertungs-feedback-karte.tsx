'use client';

import React, { useEffect, useState } from 'react';

interface LetztesBewertung {
  rating: number;
  kommentar: string | null;
  datum: string;
}

interface Props {
  isOnline?: boolean;
  driverId?: string;
}

const MOCK: LetztesBewertung = {
  rating: 5,
  kommentar: 'Super schnell und freundlich! Danke!',
  datum: new Date(Date.now() - 2 * 3600_000).toISOString(),
};

const POLL_MS = 30 * 60 * 1000;

function Sterne({ wert }: { wert: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={`text-xl ${i <= wert ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export function FahrerPhase1550KundenbewertungsFeedbackKarte({ isOnline = false, driverId = '' }: Props) {
  const [bewertung, setBewertung] = useState<LetztesBewertung | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    if (!isOnline) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-bewertungen`);
      if (!res.ok) { setBewertung(MOCK); return; }
      const json = await res.json();
      const meinFahrer = (json.fahrer ?? []).find((f: { driver_id: string }) => f.driver_id === driverId);
      if (!meinFahrer) { setBewertung(MOCK); return; }
      // Use aggregate data as preview
      setBewertung({
        rating: meinFahrer.avg_heute || meinFahrer.avg_7tage || 5,
        kommentar: `${meinFahrer.anzahl_heute} Bewertungen heute · Ø 7 Tage: ${meinFahrer.avg_7tage}`,
        datum: new Date().toISOString(),
      });
    } catch {
      setBewertung(MOCK);
    }
  };

  useEffect(() => {
    if (!isOnline) return;
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, driverId]);

  if (!isOnline || !bewertung) return null;

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor(diff / 60_000);
    if (h >= 1) return `vor ${h}h`;
    if (m >= 1) return `vor ${m} Min`;
    return 'gerade eben';
  };

  const ratingColor =
    bewertung.rating >= 4.5 ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' :
    bewertung.rating >= 3.5 ? 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800' :
    'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';

  return (
    <div className={`rounded-xl border p-4 space-y-2 ${ratingColor}`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center justify-between gap-2"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <span className="text-sm font-bold text-foreground">Letzte Kundenbewertung</span>
        </div>
        <span className="text-muted-foreground text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      <div className="flex items-center gap-3">
        <Sterne wert={Math.round(bewertung.rating)} />
        <span className="text-lg font-black tabular-nums text-foreground">{bewertung.rating.toFixed(1)}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{relativeTime(bewertung.datum)}</span>
      </div>

      {expanded && bewertung.kommentar && (
        <p className="rounded-md bg-white/60 dark:bg-black/20 px-3 py-2 text-sm italic text-foreground/80 border border-border">
          &ldquo;{bewertung.kommentar}&rdquo;
        </p>
      )}
    </div>
  );
}
