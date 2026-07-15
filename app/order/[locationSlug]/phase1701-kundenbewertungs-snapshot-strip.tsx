'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, RefreshCw, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

/**
 * Phase 1701 — Kundenbewertungs-Snapshot-Strip (Storefront)
 *
 * Zeigt die letzten 3 echten Kundenbewertungen mit Sternen + Kurztext.
 * 60-Min-Polling; Hydration-safe.
 */

interface Bewertung {
  id: string;
  kunden_name: string;
  sterne: number;
  kommentar: string | null;
  datum: string;
}

interface ApiData {
  bewertungen: Bewertung[];
}

interface Props {
  locationId: string;
}

const POLL_MS = 60 * 60 * 1000;

function StarRow({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn('h-3 w-3', i < count ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')}
        />
      ))}
    </span>
  );
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (d >= 1) return `vor ${d} Tag${d !== 1 ? 'en' : ''}`;
  if (h >= 1) return `vor ${h} Std.`;
  return 'gerade eben';
}

export function StorefrontPhase1701KundenbewertungsSnapshotStrip({ locationId }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/public/bewertungen?location_id=${encodeURIComponent(locationId)}&limit=3`);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    if (!mounted) return;
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, locationId]);

  if (!mounted) return null;

  const bewertungen = data?.bewertungen?.slice(0, 3) ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <MessageSquare className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="text-sm font-semibold flex-1 text-foreground">Kundenstimmen</span>
        {bewertungen.length > 0 && (
          <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {(bewertungen.reduce((s, b) => s + b.sterne, 0) / bewertungen.length).toFixed(1)}
          </span>
        )}
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2.5">
          {bewertungen.length === 0 && !loading && (
            <div className="text-sm text-muted-foreground text-center py-2">Noch keine Bewertungen.</div>
          )}
          {bewertungen.map(b => (
            <div key={b.id} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 space-y-1">
              <div className="flex items-center gap-2">
                <StarRow count={b.sterne} />
                <span className="flex-1 text-[11px] font-semibold text-foreground truncate">{b.kunden_name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(b.datum)}</span>
              </div>
              {b.kommentar && (
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  &ldquo;{b.kommentar}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
