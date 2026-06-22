'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, TrendingUp, TrendingDown, Minus, Users } from 'lucide-react';

// ── Typen ─────────────────────────────────────────────────────────────────────

type PrognoseKategorie = 'elite' | 'gut' | 'durchschnitt' | 'auffällig';
type TrendDirection    = 'up' | 'stable' | 'down';

interface FahrerEintrag {
  rang:              number;
  driverId:          string;
  driverName:        string | null;
  initials:          string;
  prognoseScore:     number;
  kategorie:         PrognoseKategorie;
  punctualityScore:  number | null;
  deliveryTimeScore: number | null;
  stornoScore:       number | null;
  efficiencyScore:   number | null;
  toursAnalyzed:     number;
  trendDirection:    TrendDirection;
  computedAt:        string;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

const KATEGORIE_CONFIG: Record<PrognoseKategorie, { label: string; bg: string; text: string; ring: string }> = {
  elite:        { label: 'Elite',        bg: 'bg-purple-100',  text: 'text-purple-700',  ring: 'ring-purple-300' },
  gut:          { label: 'Gut',          bg: 'bg-green-100',   text: 'text-green-700',   ring: 'ring-green-300' },
  durchschnitt: { label: 'Durchschnitt', bg: 'bg-blue-100',    text: 'text-blue-700',    ring: 'ring-blue-300' },
  auffällig:    { label: 'Auffällig',    bg: 'bg-red-100',     text: 'text-red-700',     ring: 'ring-red-300' },
};

function TrendIcon({ direction }: { direction: TrendDirection }) {
  if (direction === 'up')   return <TrendingUp   className="h-4 w-4 text-green-500" />;
  if (direction === 'down') return <TrendingDown  className="h-4 w-4 text-red-500"  />;
  return <Minus className="h-4 w-4 text-stone-400" />;
}

function ScoreBar({ score, color }: { score: number | null; color: string }) {
  if (score == null) return <div className="h-2 bg-stone-100 rounded-full" />;
  return (
    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.max(2, score)}%` }}
      />
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-purple-600' :
    score >= 60 ? 'text-green-600'  :
    score >= 40 ? 'text-blue-600'   :
                  'text-red-600';
  const ring =
    score >= 80 ? 'stroke-purple-500' :
    score >= 60 ? 'stroke-green-500'  :
    score >= 40 ? 'stroke-blue-500'   :
                  'stroke-red-500';

  const circumference = 2 * Math.PI * 18;
  const filled = (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-14 h-14">
      <svg viewBox="0 0 40 40" className="w-14 h-14 -rotate-90">
        <circle cx="20" cy="20" r="18" fill="none" stroke="#e7e5e4" strokeWidth="3.5" />
        <circle
          cx="20" cy="20" r="18" fill="none"
          className={ring}
          strokeWidth="3.5"
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
        />
      </svg>
      <span className={`absolute text-sm font-black tabular-nums ${color}`}>
        {Math.round(score)}
      </span>
    </div>
  );
}

// ── Drill-Down Zeile ──────────────────────────────────────────────────────────

function FahrerDrillDown({ fahrer }: { fahrer: FahrerEintrag }) {
  const subScores = [
    { label: 'Pünktlichkeit', score: fahrer.punctualityScore,  color: 'bg-green-500',  pct: 35 },
    { label: 'Lieferzeit',    score: fahrer.deliveryTimeScore, color: 'bg-blue-500',   pct: 30 },
    { label: 'Bewertung',     score: fahrer.stornoScore,       color: 'bg-amber-500',  pct: 20 },
    { label: 'Effizienz',     score: fahrer.efficiencyScore,   color: 'bg-purple-500', pct: 15 },
  ];

  return (
    <div className="px-4 pb-4 space-y-3 border-t border-stone-100 pt-3">
      <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-2">
        Sub-Scores · {fahrer.toursAnalyzed} Touren analysiert
      </div>
      {subScores.map(({ label, score, color, pct }) => (
        <div key={label} className="flex items-center gap-3">
          <div className="w-24 text-xs text-stone-500 shrink-0">
            {label}
            <span className="text-[10px] text-stone-400 ml-1">({pct}%)</span>
          </div>
          <div className="flex-1">
            <ScoreBar score={score} color={color} />
          </div>
          <div className="w-10 text-right text-xs font-bold tabular-nums text-stone-700">
            {score != null ? Math.round(score) : '–'}
          </div>
        </div>
      ))}
      <div className="text-[10px] text-stone-400 mt-1">
        Berechnet: {new Date(fahrer.computedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
      </div>
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export function FahrerPrognosePanel({ locationId }: { locationId: string | null }) {
  const [open,        setOpen]        = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [computing,   setComputing]   = useState(false);
  const [rangliste,   setRangliste]   = useState<FahrerEintrag[]>([]);
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());
  const [lastFetch,   setLastFetch]   = useState<Date | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-prognose?location_id=${encodeURIComponent(locationId)}`,
      );
      const data = await res.json();
      if (data.rangliste) {
        setRangliste(data.rangliste as FahrerEintrag[]);
        setLastFetch(new Date());
      }
    } catch {
      setError('Fehler beim Laden der Fahrer-Prognosen');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (open && locationId) {
      void load();
    }
  }, [open, locationId, load]);

  // 10-Min-Polling
  useEffect(() => {
    if (!open || !locationId) return;
    const id = setInterval(() => void load(), 10 * 60_000);
    return () => clearInterval(id);
  }, [open, locationId, load]);

  const handleCompute = async () => {
    if (!locationId) return;
    setComputing(true);
    try {
      await fetch('/api/delivery/admin/fahrer-prognose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compute', location_id: locationId }),
      });
      await load();
    } finally {
      setComputing(false);
    }
  };

  const toggleExpand = (driverId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(driverId)) next.delete(driverId);
      else next.add(driverId);
      return next;
    });
  };

  // Kategorie-Zusammenfassung
  const katCount = rangliste.reduce<Record<PrognoseKategorie, number>>(
    (acc, f) => { acc[f.kategorie] = (acc[f.kategorie] ?? 0) + 1; return acc; },
    { elite: 0, gut: 0, durchschnitt: 0, auffällig: 0 },
  );

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-stone-50 transition-colors"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-700 shrink-0">
          <Users className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-stone-800">Fahrer-Prognose-Rangliste</div>
          <div className="text-xs text-stone-400">
            ML-Score: Pünktlichkeit · Lieferzeit · Bewertung · Effizienz
          </div>
        </div>

        {/* Kategorie-Badges im Header */}
        {rangliste.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5">
            {(['elite', 'gut', 'auffällig'] as PrognoseKategorie[]).map(k =>
              katCount[k] > 0 ? (
                <span
                  key={k}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${KATEGORIE_CONFIG[k].bg} ${KATEGORIE_CONFIG[k].text}`}
                >
                  {katCount[k]} {KATEGORIE_CONFIG[k].label}
                </span>
              ) : null,
            )}
          </div>
        )}

        {open ? <ChevronUp className="h-4 w-4 text-stone-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-stone-400 shrink-0" />}
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-stone-100">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 bg-stone-50">
            <div className="text-xs text-stone-500">
              {rangliste.length} Fahrer
              {lastFetch && (
                <span className="ml-2">
                  · {lastFetch.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCompute}
                disabled={computing}
                className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${computing ? 'animate-spin' : ''}`} />
                Neu berechnen
              </button>
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Fehler */}
          {error && (
            <div className="px-5 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
              {error}
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && rangliste.length === 0 && (
            <div className="divide-y divide-stone-100">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                  <div className="h-8 w-8 bg-stone-100 rounded-full" />
                  <div className="h-14 w-14 bg-stone-100 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-stone-100 rounded w-32" />
                    <div className="h-2 bg-stone-100 rounded w-24" />
                  </div>
                  <div className="h-6 w-20 bg-stone-100 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {/* Leer-Zustand */}
          {!loading && rangliste.length === 0 && !error && (
            <div className="px-5 py-10 text-center">
              <Users className="h-8 w-8 text-stone-300 mx-auto mb-3" />
              <div className="text-sm font-semibold text-stone-500">Keine Prognose-Daten</div>
              <div className="text-xs text-stone-400 mt-1">
                Klicke „Neu berechnen" um Fahrer-Scores zu berechnen.
              </div>
            </div>
          )}

          {/* Rangliste */}
          {rangliste.length > 0 && (
            <div className="divide-y divide-stone-100">
              {rangliste.map((fahrer) => {
                const cfg = KATEGORIE_CONFIG[fahrer.kategorie];
                const isExpanded = expanded.has(fahrer.driverId);

                return (
                  <div key={fahrer.driverId}>
                    <button
                      onClick={() => toggleExpand(fahrer.driverId)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50 text-left transition-colors"
                    >
                      {/* Rang */}
                      <div className="w-6 text-center text-xs font-black text-stone-400 shrink-0">
                        {fahrer.rang}
                      </div>

                      {/* Score Gauge */}
                      <ScoreGauge score={fahrer.prognoseScore} />

                      {/* Name + Infos */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-stone-800 truncate">
                            {fahrer.driverName ?? fahrer.initials}
                          </span>
                          <TrendIcon direction={fahrer.trendDirection} />
                        </div>
                        <div className="text-[11px] text-stone-400">
                          {fahrer.toursAnalyzed} Touren analysiert
                        </div>
                      </div>

                      {/* Kategorie Badge */}
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring} shrink-0`}>
                        {cfg.label}
                      </span>

                      {/* Expand */}
                      {isExpanded
                        ? <ChevronUp   className="h-4 w-4 text-stone-400 shrink-0" />
                        : <ChevronDown className="h-4 w-4 text-stone-400 shrink-0" />}
                    </button>

                    {/* Drill-Down */}
                    {isExpanded && <FahrerDrillDown fahrer={fahrer} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer-Statistiken */}
          {rangliste.length > 0 && (
            <div className="grid grid-cols-4 gap-0 border-t border-stone-100">
              {(Object.entries(KATEGORIE_CONFIG) as [PrognoseKategorie, typeof KATEGORIE_CONFIG[PrognoseKategorie]][]).map(
                ([k, cfg]) => (
                  <div key={k} className={`py-3 text-center ${cfg.bg}`}>
                    <div className={`text-lg font-black tabular-nums ${cfg.text}`}>
                      {katCount[k]}
                    </div>
                    <div className={`text-[10px] font-semibold ${cfg.text} opacity-80`}>
                      {cfg.label}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
