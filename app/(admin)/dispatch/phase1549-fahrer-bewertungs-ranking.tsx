'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface FahrerBewertung {
  driver_id: string;
  name: string;
  avg_heute: number;
  avg_7tage: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  anzahl_heute: number;
  anzahl_7tage: number;
}

interface ApiData {
  fahrer: FahrerBewertung[];
  top3: FahrerBewertung[];
  flop3: FahrerBewertung[];
}

const POLL_MS = 15 * 60 * 1000;

function Sterne({ wert }: { wert: number }) {
  return (
    <span className="text-amber-400 text-sm select-none" aria-label={`${wert} Sterne`}>
      {'★'.repeat(Math.floor(wert))}
      {wert % 1 >= 0.5 ? '½' : ''}
      {'☆'.repeat(Math.max(0, 5 - Math.ceil(wert)))}
    </span>
  );
}

function TrendIcon({ trend }: { trend: FahrerBewertung['trend'] }) {
  if (trend === 'steigend') return <span className="text-green-600 font-bold text-sm">↑</span>;
  if (trend === 'fallend')  return <span className="text-red-500 font-bold text-sm">↓</span>;
  return <span className="text-gray-400 text-sm">→</span>;
}

export function DispatchPhase1549FahrerBewertungsRanking() {
  const [data, setData] = useState<ApiData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [ansicht, setAnsicht] = useState<'alle' | 'top3' | 'flop3'>('alle');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/fahrer-bewertungen');
      if (res.ok) {
        setData(await res.json());
        setLastUpdate(new Date());
      }
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const liste: FahrerBewertung[] = data
    ? (ansicht === 'top3' ? data.top3 : ansicht === 'flop3' ? data.flop3 : data.fahrer)
    : [];

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-foreground">⭐ Fahrer-Bewertungs-Ranking</h3>
        <div className="flex gap-1">
          {(['alle', 'top3', 'flop3'] as const).map(v => (
            <button
              key={v}
              onClick={() => setAnsicht(v)}
              className={`rounded-md px-2 py-0.5 text-xs font-semibold transition ${
                ansicht === v
                  ? 'bg-matcha-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {v === 'alle' ? 'Alle' : v === 'top3' ? 'Top 3' : 'Flop 3'}
            </button>
          ))}
        </div>
      </div>

      {!data && (
        <p className="text-xs text-muted-foreground animate-pulse">Lade Bewertungen…</p>
      )}

      {data && liste.length === 0 && (
        <p className="text-xs text-muted-foreground">Keine Bewertungsdaten vorhanden.</p>
      )}

      {liste.length > 0 && (
        <div className="space-y-2">
          {liste.map((f, idx) => (
            <div
              key={f.driver_id}
              className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2"
            >
              <span className="w-5 shrink-0 text-center text-xs font-black text-muted-foreground tabular-nums">
                {ansicht === 'alle' ? idx + 1 : ansicht === 'top3' ? `T${idx + 1}` : `F${idx + 1}`}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{f.name}</p>
                <Sterne wert={f.avg_heute} />
              </div>
              <div className="shrink-0 text-right space-y-0.5">
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-sm font-black tabular-nums text-foreground">{f.avg_heute.toFixed(1)}</span>
                  <TrendIcon trend={f.trend} />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Ø 7T: {f.avg_7tage.toFixed(1)} · {f.anzahl_heute} Bew. heute
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {lastUpdate && (
        <p className="text-[10px] text-muted-foreground text-right">
          Aktualisiert: {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}
