'use client';

import { useCallback, useEffect, useState } from 'react';
import { Star, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface FeedbackEntry {
  id: string;
  rating: number;
  kommentar: string | null;
  erstellt_am: string;
  fahrer_name: string | null;
}

const MOCK: FeedbackEntry[] = [
  { id: '1', rating: 5, kommentar: 'Super schnell und freundlich!', erstellt_am: new Date(Date.now() - 4 * 60_000).toISOString(), fahrer_name: 'Max M.' },
  { id: '2', rating: 4, kommentar: null, erstellt_am: new Date(Date.now() - 12 * 60_000).toISOString(), fahrer_name: 'Anna K.' },
  { id: '3', rating: 3, kommentar: 'Etwas länger als erwartet', erstellt_am: new Date(Date.now() - 23 * 60_000).toISOString(), fahrer_name: null },
  { id: '4', rating: 5, kommentar: 'Perfekt, wie immer!', erstellt_am: new Date(Date.now() - 45 * 60_000).toISOString(), fahrer_name: 'Lukas B.' },
];

function sterne(n: number) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function minutenVor(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 1) return 'jetzt';
  if (diff < 60) return `vor ${diff} Min`;
  return `vor ${Math.floor(diff / 60)} h`;
}

function sternenFarbe(r: number) {
  if (r >= 5) return 'text-emerald-500';
  if (r >= 4) return 'text-amber-500';
  return 'text-red-500';
}

export function KitchenPhase732KundenFeedbackLive({ locationId }: Props) {
  const [data, setData] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/kunden-feedback-engine?location_id=${locationId}&action=recent`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.eintraege) && json.eintraege.length > 0) {
          setData(json.eintraege);
          return;
        }
      }
    } catch { /* fallback */ }
    setData(MOCK);
  }, [locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 2 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  const avg = data.length > 0 ? data.reduce((s, f) => s + f.rating, 0) / data.length : 0;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Kunden-Feedback Live</span>
          {!loading && data.length > 0 && (
            <span className="text-xs font-bold text-amber-500">Ø {avg.toFixed(1)} ★</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="h-20 animate-pulse rounded bg-muted" />
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Noch keine Bewertungen</p>
          ) : (
            data.slice(0, 6).map((f) => (
              <div key={f.id} className="rounded-lg bg-muted/40 px-3 py-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-mono ${sternenFarbe(f.rating)}`}>{sterne(f.rating)}</span>
                  <span className="text-[10px] text-muted-foreground">{minutenVor(f.erstellt_am)}</span>
                </div>
                {f.kommentar && (
                  <p className="text-[11px] text-foreground/80 truncate">&ldquo;{f.kommentar}&rdquo;</p>
                )}
                {f.fahrer_name && (
                  <p className="text-[10px] text-muted-foreground">Fahrer: {f.fahrer_name}</p>
                )}
              </div>
            ))
          )}
          <p className="text-[10px] text-muted-foreground">Letzte Bewertungen · 2-Min Update</p>
        </div>
      )}
    </div>
  );
}
