'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type Stimmung = 'super' | 'gut' | 'okay' | 'muede' | 'schwer';

interface Bewertung {
  id:           string;
  sterne:       number;
  kommentar:    string | null;
  stimmung:     Stimmung | null;
  schichtDatum: string;
  erstelltAm:   string;
}

interface Props {
  driverId:   string;
  locationId: string;
}

const STIMMUNGEN: { value: Stimmung; emoji: string; label: string }[] = [
  { value: 'super',  emoji: '🚀', label: 'Super' },
  { value: 'gut',    emoji: '😊', label: 'Gut' },
  { value: 'okay',   emoji: '😐', label: 'Okay' },
  { value: 'muede',  emoji: '😴', label: 'Müde' },
  { value: 'schwer', emoji: '😓', label: 'Schwer' },
];

function StarButton({ n, selected, onClick }: { n: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-2xl transition-transform hover:scale-110 active:scale-95',
        selected ? 'opacity-100' : 'opacity-30',
      )}
      aria-label={`${n} Stern${n !== 1 ? 'e' : ''}`}
    >
      ⭐
    </button>
  );
}

export function FahrerSelbstBewertung({ driverId, locationId }: Props) {
  const [existing, setExisting] = useState<Bewertung | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [open, setOpen]         = useState(false);

  const [sterne, setSterne]       = useState(0);
  const [stimmung, setStimmung]   = useState<Stimmung | null>(null);
  const [kommentar, setKommentar] = useState('');

  useEffect(() => {
    if (!driverId || !locationId) { setLoading(false); return; }
    fetch(
      `/api/delivery/driver/selbst-bewertung?driver_id=${driverId}&location_id=${locationId}`,
    )
      .then((r) => r.json())
      .then((j: { ok: boolean; bewertung?: Bewertung }) => {
        if (j.ok && j.bewertung) setExisting(j.bewertung);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [driverId, locationId]);

  async function submit() {
    if (sterne === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/delivery/driver/selbst-bewertung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id:   driverId,
          location_id: locationId,
          sterne,
          stimmung: stimmung ?? undefined,
          kommentar: kommentar.trim() || undefined,
        }),
      });
      const j = await res.json() as { ok: boolean; bewertung?: Bewertung };
      if (j.ok && j.bewertung) {
        setExisting(j.bewertung);
        setSaved(true);
        setOpen(false);
      }
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  const today = new Date().toISOString().slice(0, 10);
  const alreadyToday = existing?.schichtDatum === today;

  if (alreadyToday && !saved) {
    return (
      <section className="bg-gradient-to-br from-violet-900/60 to-violet-800/50 border border-violet-700/40 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">📝</span>
          <span className="text-xs font-semibold text-violet-200 uppercase tracking-wide">
            Meine Schicht-Bewertung
          </span>
        </div>
        <div className="flex items-center gap-1 mb-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={cn('text-xl', n <= (existing?.sterne ?? 0) ? 'opacity-100' : 'opacity-20')}>
              ⭐
            </span>
          ))}
          {existing?.stimmung && (
            <span className="ml-2 text-lg">
              {STIMMUNGEN.find((s) => s.value === existing.stimmung)?.emoji}
            </span>
          )}
        </div>
        {existing?.kommentar && (
          <p className="text-xs text-violet-300 italic">„{existing.kommentar}"</p>
        )}
      </section>
    );
  }

  return (
    <section className="bg-gradient-to-br from-violet-900/60 to-violet-800/50 border border-violet-700/40 rounded-2xl p-4 space-y-3">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📝</span>
          <span className="text-xs font-semibold text-violet-200 uppercase tracking-wide">
            Schicht bewerten
          </span>
        </div>
        <span className="text-violet-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="space-y-3 pt-1">
          {/* Stars */}
          <div>
            <p className="text-xs text-violet-300 mb-1.5">Wie war deine Schicht?</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <StarButton
                  key={n}
                  n={n}
                  selected={n <= sterne}
                  onClick={() => setSterne(n)}
                />
              ))}
              {sterne > 0 && (
                <span className="ml-2 text-xs text-violet-300 font-medium">
                  {['', 'Schwach', 'Naja', 'Okay', 'Gut', 'Top!'][sterne]}
                </span>
              )}
            </div>
          </div>

          {/* Stimmung */}
          <div>
            <p className="text-xs text-violet-300 mb-1.5">Wie fühlst du dich?</p>
            <div className="flex flex-wrap gap-2">
              {STIMMUNGEN.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStimmung(stimmung === s.value ? null : s.value)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                    stimmung === s.value
                      ? 'bg-violet-500 text-white'
                      : 'bg-white/10 text-violet-200 hover:bg-white/20',
                  )}
                >
                  <span>{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Kommentar */}
          <div>
            <textarea
              value={kommentar}
              onChange={(e) => setKommentar(e.target.value)}
              placeholder="Kurzer Kommentar (optional)…"
              maxLength={300}
              rows={2}
              className="w-full rounded-xl bg-white/10 border border-violet-600/30 text-white placeholder:text-violet-400 text-sm px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>

          <button
            onClick={submit}
            disabled={sterne === 0 || saving}
            className="w-full py-2.5 bg-violet-500 hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors"
          >
            {saving ? 'Speichern…' : 'Bewertung abschicken'}
          </button>
        </div>
      )}
    </section>
  );
}
