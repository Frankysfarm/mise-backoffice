'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Star, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface BewertungEntry {
  id:            string;
  driver_id:     string;
  driver_name:   string;
  schicht_datum: string;
  sterne:        number;
  stimmung:      string | null;
  kommentar:     string | null;
  created_at:    string;
}

interface BewertungsStats {
  avgSterne:   number;
  total:       number;
  stimmungen:  Record<string, number>;
}

const STIMMUNG_EMOJI: Record<string, string> = {
  super:  '🚀',
  gut:    '😊',
  okay:   '😐',
  muede:  '😴',
  schwer: '😓',
};

const STIMMUNG_LABEL: Record<string, string> = {
  super:  'Super',
  gut:    'Gut',
  okay:   'Okay',
  muede:  'Müde',
  schwer: 'Schwer',
};

interface Props {
  locationId: string | null;
}

export function SelbstBewertungsUebersicht({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<BewertungEntry[]>([]);
  const [stats, setStats] = useState<BewertungsStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/selbst-bewertung?location_id=${locationId}&date=${date}`);
      const j = await r.json();
      if (j.ok) {
        setEntries(j.entries ?? []);
        setStats(j.stats ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [locationId, date]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  function renderSterne(n: number) {
    return (
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className={`w-3 h-3 ${i <= n ? 'text-yellow-400 fill-yellow-400' : 'text-stone-600'}`}
          />
        ))}
      </span>
    );
  }

  const stimmungOrder = ['super', 'gut', 'okay', 'muede', 'schwer'];

  return (
    <div className="rounded-xl border border-stone-800 bg-stone-950 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-stone-900 transition-colors text-left"
      >
        <Star className="w-4 h-4 text-yellow-400 shrink-0" />
        <span className="text-sm font-semibold text-white">Fahrer-Selbstbewertungen</span>
        {stats && (
          <span className="ml-2 flex items-center gap-1 text-xs text-yellow-400 font-medium">
            {renderSterne(Math.round(stats.avgSterne))}
            <span className="text-stone-400 ml-1">{stats.avgSterne.toFixed(1)} Ø · {stats.total} Bewertungen</span>
          </span>
        )}
        <span className="ml-auto text-stone-400">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Datum-Filter + Refresh */}
          <div className="flex items-center gap-3 pt-1">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-500"
            />
            <button
              onClick={load}
              className="p-1.5 rounded-lg bg-stone-800 text-stone-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Stimmungs-Verteilung */}
          {stats && stats.total > 0 && (
            <div className="bg-stone-900 rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium text-stone-300 mb-2">Stimmungsverteilung</div>
              <div className="flex gap-3 flex-wrap">
                {stimmungOrder.map(s => {
                  const count = stats.stimmungen[s] ?? 0;
                  if (count === 0) return null;
                  const pct = Math.round((count / stats.total) * 100);
                  return (
                    <div key={s} className="flex items-center gap-1.5">
                      <span className="text-base">{STIMMUNG_EMOJI[s]}</span>
                      <div>
                        <div className="text-xs font-medium text-white">{STIMMUNG_LABEL[s]}</div>
                        <div className="text-[10px] text-stone-400">{count}× ({pct}%)</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Progress-Balken je Stimmung */}
              <div className="space-y-1 pt-1">
                {stimmungOrder.map(s => {
                  const count = stats.stimmungen[s] ?? 0;
                  if (count === 0) return null;
                  const pct = (count / stats.total) * 100;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <span className="text-xs w-14 text-stone-400">{STIMMUNG_LABEL[s]}</span>
                      <div className="flex-1 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-stone-400 w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loading && (
            <div className="text-xs text-stone-400 py-4 text-center animate-pulse">Lade Bewertungen…</div>
          )}

          {!loading && entries.length === 0 && (
            <div className="text-xs text-stone-500 py-4 text-center">Keine Selbstbewertungen für diesen Tag</div>
          )}

          {!loading && entries.length > 0 && (
            <div className="space-y-2">
              {entries.map(e => (
                <div key={e.id} className="bg-stone-900 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{e.driver_name}</span>
                    <div className="flex items-center gap-2">
                      {e.stimmung && (
                        <span className="text-sm" title={STIMMUNG_LABEL[e.stimmung]}>
                          {STIMMUNG_EMOJI[e.stimmung] ?? ''}
                        </span>
                      )}
                      {renderSterne(e.sterne)}
                    </div>
                  </div>
                  {e.kommentar && (
                    <p className="text-[11px] text-stone-400 italic leading-relaxed">
                      &ldquo;{e.kommentar}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
