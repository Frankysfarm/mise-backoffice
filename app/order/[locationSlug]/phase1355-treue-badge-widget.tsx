'use client';

import { useCallback, useEffect, useState } from 'react';
import { Award, ChevronDown, ChevronUp, Copy, Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1355 — Treue-Badge-Widget (Storefront)
 *
 * Zeigt Phase1351-API: Stammkunden-Badge + "Noch X Bestellungen bis Gold" + persönlicher Rabattcode.
 * Storefront nach Phase1325.
 */

type Badge = 'neu' | 'bronze' | 'silber' | 'gold' | 'platin';

interface TreueData {
  gesamt_bestellungen: number;
  badge: Badge;
  badge_label: string;
  naechste_stufe: Badge | null;
  noch_bestellungen_bis_naechste: number | null;
  durchschnittsbewertung: number | null;
  rabattcode: string | null;
  generiert_am: string;
}

interface Props {
  locationId: string;
  customerEmail: string | null;
}

const BADGE_STYLES: Record<Badge, { bg: string; text: string; border: string; emoji: string }> = {
  neu:     { bg: 'bg-slate-100 dark:bg-slate-800',   text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-600', emoji: '👋' },
  bronze:  { bg: 'bg-orange-50 dark:bg-orange-950',  text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-700', emoji: '🥉' },
  silber:  { bg: 'bg-gray-100 dark:bg-gray-800',     text: 'text-gray-600 dark:text-gray-300',   border: 'border-gray-400 dark:border-gray-500',   emoji: '🥈' },
  gold:    { bg: 'bg-yellow-50 dark:bg-yellow-950',  text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-400 dark:border-yellow-600', emoji: '🥇' },
  platin:  { bg: 'bg-purple-50 dark:bg-purple-950',  text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-400 dark:border-purple-600', emoji: '💎' },
};

const NAECHSTE_LABEL: Record<Badge, string> = {
  neu:    'Bronze-Stammgast',
  bronze: 'Silber-Stammgast',
  silber: 'Gold-Stammgast',
  gold:   'Platin-Stammgast',
  platin: '',
};

export function StorefrontPhase1355TreueBadgeWidget({ locationId, customerEmail }: Props) {
  const [data, setData] = useState<TreueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ location_id: locationId });
      if (customerEmail) params.set('customer_email', customerEmail);
      const res = await fetch(`/api/delivery/public/kunden-treue?${params}`);
      if (!res.ok) return;
      const json: TreueData = await res.json();
      setData(json);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [locationId, customerEmail]);

  useEffect(() => { laden(); }, [laden]);

  const copyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Treueprogramm wird geladen…</span>
      </div>
    );
  }

  if (!data) return null;

  const style = BADGE_STYLES[data.badge];

  return (
    <div className={cn('rounded-xl border px-4 py-3 space-y-2 transition-all', style.bg, style.border)}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="text-2xl leading-none">{style.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-bold', style.text)}>{data.badge_label}</p>
          <p className="text-[11px] text-muted-foreground">{data.gesamt_bestellungen} Bestellungen bei uns</p>
        </div>
        <Award className={cn('h-5 w-5 shrink-0', style.text)} />
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="space-y-2 pt-1">
          {data.noch_bestellungen_bis_naechste != null && data.naechste_stufe && (
            <div className="rounded-lg bg-white/60 dark:bg-black/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground mb-1">
                Noch <span className="font-bold text-foreground">{data.noch_bestellungen_bis_naechste}</span> Bestellungen bis{' '}
                <span className="font-bold text-foreground">{NAECHSTE_LABEL[data.badge]}</span>
              </p>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full', style.text.replace('text-', 'bg-').replace('dark:text-', 'dark:bg-'))}
                  style={{
                    width: `${Math.min(100, (data.gesamt_bestellungen / (data.gesamt_bestellungen + data.noch_bestellungen_bis_naechste)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {data.durchschnittsbewertung != null && (
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
              <span className="text-[11px] text-muted-foreground">
                Deine Ø-Bewertung: <span className="font-bold text-foreground">{data.durchschnittsbewertung.toFixed(1)}</span>
              </span>
            </div>
          )}

          {data.rabattcode && (
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
              <p className="text-[10px] text-muted-foreground mb-1">Dein persönlicher Rabattcode:</p>
              <div className="flex items-center gap-2">
                <code className={cn('text-sm font-bold tracking-widest', style.text)}>{data.rabattcode}</code>
                <button
                  onClick={() => copyCode(data.rabattcode!)}
                  className="ml-auto rounded p-1 hover:bg-primary/10 transition"
                  title="Code kopieren"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              {copied && <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">Kopiert!</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
