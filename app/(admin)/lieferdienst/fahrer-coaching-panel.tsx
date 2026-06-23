'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Lightbulb, ChevronDown, ChevronUp, RefreshCw, AlertTriangle } from 'lucide-react';

interface CoachingEntry {
  id:                 string;
  driverId:           string;
  driverName:         string;
  puenktlichkeitPct:  number;
  zielPct:            number;
  hinweise:           string[];
  kategorie:          'kritisch' | 'warnung' | 'info';
  gesehenAm:          string | null;
}

interface Props {
  locationId: string | null;
}

const KATEGORIE = {
  kritisch: { dot: 'bg-rose-500',   label: 'Kritisch',   text: 'text-rose-400'  },
  warnung:  { dot: 'bg-amber-500',  label: 'Warnung',    text: 'text-amber-400' },
  info:     { dot: 'bg-green-500',  label: 'Gut',        text: 'text-green-400' },
};

export function FahrerCoachingPanel({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<CoachingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-coach?location_id=${locationId}`);
      const j = await r.json();
      if (j.ok) setEntries(j.hinweise ?? []);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function generate() {
    if (!locationId) return;
    setGenerating(true);
    try {
      await fetch('/api/delivery/admin/fahrer-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', location_id: locationId }),
      });
      await load();
    } finally {
      setGenerating(false);
    }
  }

  const kritisch = entries.filter(e => e.kategorie === 'kritisch').length;
  const warnung  = entries.filter(e => e.kategorie === 'warnung').length;

  return (
    <div className="rounded-xl border border-stone-800 bg-stone-950 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-stone-900 transition-colors text-left"
      >
        <Lightbulb className="w-4 h-4 text-yellow-400 shrink-0" />
        <span className="text-sm font-semibold text-white">Pünktlichkeits-Coaching</span>
        <div className="ml-2 flex items-center gap-2">
          {kritisch > 0 && (
            <span className="flex items-center gap-1 text-xs text-rose-400 font-medium">
              <AlertTriangle className="w-3 h-3" />{kritisch} kritisch
            </span>
          )}
          {warnung > 0 && (
            <span className="text-xs text-amber-400 font-medium">{warnung} Warnung{warnung > 1 ? 'en' : ''}</span>
          )}
          {entries.length === 0 && !loading && open && (
            <span className="text-xs text-stone-500">Keine Daten</span>
          )}
        </div>
        <span className="ml-auto text-stone-400">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-900 hover:bg-yellow-800 text-yellow-300 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Generiere…' : 'Jetzt generieren'}
            </button>
            <button onClick={load} className="p-1.5 rounded-lg bg-stone-800 text-stone-400 hover:text-white">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading && (
            <div className="text-xs text-stone-400 py-4 text-center animate-pulse">Lade Coaching-Hinweise…</div>
          )}

          {!loading && entries.length === 0 && (
            <div className="text-xs text-stone-500 py-4 text-center">
              Noch keine Coaching-Hinweise für heute. Klicke &quot;Jetzt generieren&quot;.
            </div>
          )}

          {!loading && entries.length > 0 && (
            <div className="space-y-2">
              {entries.map(e => {
                const kat = KATEGORIE[e.kategorie];
                return (
                  <div key={e.id} className="bg-stone-900 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${kat.dot}`} />
                        <span className="text-xs font-semibold text-white">{e.driverName}</span>
                        <span className={`text-[10px] font-medium ${kat.text}`}>{kat.label}</span>
                      </div>
                      <span className="text-xs text-stone-400">
                        {e.puenktlichkeitPct.toFixed(0)}% <span className="text-stone-600">/ {e.zielPct}% Ziel</span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      {e.hinweise.slice(0, 2).map((h, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="text-yellow-500 text-[10px] mt-0.5">→</span>
                          <p className="text-[11px] text-stone-400 leading-relaxed">{h}</p>
                        </div>
                      ))}
                    </div>
                    {e.gesehenAm && (
                      <div className="text-[10px] text-green-500">✓ Fahrer hat Hinweise gesehen</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
