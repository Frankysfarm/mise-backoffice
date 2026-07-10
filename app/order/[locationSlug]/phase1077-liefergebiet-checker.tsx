'use client';

import { useState, useRef } from 'react';
import { MapPin, CheckCircle2, XCircle, Loader2, Clock, Euro } from 'lucide-react';
import { cn } from '@/lib/utils';

type ApiResponse = {
  lieferbar: boolean;
  plz: string;
  zone: 'A' | 'B' | 'C' | 'D' | null;
  eta_min: number | null;
  mindestbestellwert_eur: number | null;
  lieferkosten_eur: number | null;
  grund: string | null;
};

const ZONE_COLORS: Record<string, string> = {
  A: 'bg-matcha-100 text-matcha-800 dark:bg-matcha-900/40 dark:text-matcha-200 border-matcha-200 dark:border-matcha-700',
  B: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 border-blue-200 dark:border-blue-700',
  C: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-200 dark:border-amber-700',
  D: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 border-orange-200 dark:border-orange-700',
};

export function Phase1077LiefergebietChecker({ locationSlug }: { locationSlug: string }) {
  const [plz, setPlz] = useState('');
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const check = async (value?: string) => {
    const val = (value ?? plz).replace(/\s/g, '');
    if (!/^\d{5}$/.test(val)) {
      setError('Bitte eine gültige 5-stellige PLZ eingeben.');
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const p = new URLSearchParams({ plz: val, location_id: locationSlug });
      const r = await fetch(`/api/delivery/order/liefergebiet-checker?${p}`);
      if (r.ok) setResult(await r.json());
      else setError('Prüfung nicht möglich. Bitte erneut versuchen.');
    } catch {
      setError('Prüfung nicht möglich. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 5);
    setPlz(digits);
    setResult(null);
    setError(null);
    if (digits.length === 5) check(digits);
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <MapPin size={15} className="text-matcha-600 dark:text-matcha-400" />
        <span className="text-sm font-bold text-foreground">Liefergebiet prüfen</span>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="\d{5}"
              maxLength={5}
              placeholder="PLZ eingeben…"
              value={plz}
              onChange={(e) => handleInput(e.target.value)}
              className={cn(
                'w-full rounded-xl border px-3 py-2.5 text-sm font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal',
                'bg-background text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-matcha-400 focus:border-transparent',
                error ? 'border-red-400' : 'border-border',
              )}
            />
          </div>
          <button
            onClick={() => check()}
            disabled={loading || plz.length !== 5}
            className="px-4 py-2.5 rounded-xl bg-matcha-600 text-white text-sm font-bold hover:bg-matcha-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : 'Prüfen'}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
            <XCircle size={13} />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className={cn(
            'rounded-xl border p-3 space-y-2.5 transition-all',
            result.lieferbar
              ? 'bg-matcha-50 dark:bg-matcha-950/30 border-matcha-200 dark:border-matcha-700'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-700',
          )}>
            {/* Status header */}
            <div className="flex items-center gap-2">
              {result.lieferbar
                ? <CheckCircle2 size={18} className="text-matcha-600 dark:text-matcha-400 shrink-0" />
                : <XCircle size={18} className="text-red-600 dark:text-red-400 shrink-0" />
              }
              <div>
                <div className={cn('text-sm font-bold', result.lieferbar ? 'text-matcha-800 dark:text-matcha-200' : 'text-red-700 dark:text-red-300')}>
                  {result.lieferbar ? `PLZ ${result.plz} wird beliefert!` : `PLZ ${result.plz} liegt außerhalb des Liefergebiets`}
                </div>
                {!result.lieferbar && result.grund && (
                  <div className="text-xs text-red-600 dark:text-red-400">{result.grund}</div>
                )}
              </div>
            </div>

            {result.lieferbar && (
              <div className="flex flex-wrap gap-2">
                {result.zone && (
                  <div className={cn('rounded-lg border px-2.5 py-1.5 text-center', ZONE_COLORS[result.zone])}>
                    <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">Zone</div>
                    <div className="text-base font-black">{result.zone}</div>
                  </div>
                )}
                {result.eta_min != null && (
                  <div className="flex-1 min-w-[80px] rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1.5">
                    <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      <Clock size={9} />
                      ETA
                    </div>
                    <div className="text-sm font-black text-blue-800 dark:text-blue-200">
                      ca. {result.eta_min} Min
                    </div>
                  </div>
                )}
                {result.mindestbestellwert_eur != null && (
                  <div className="flex-1 min-w-[80px] rounded-lg border border-border bg-muted/50 px-2.5 py-1.5">
                    <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Euro size={9} />
                      MBW
                    </div>
                    <div className="text-sm font-black text-foreground">
                      {result.mindestbestellwert_eur.toFixed(2).replace('.', ',')} €
                    </div>
                  </div>
                )}
                {result.lieferkosten_eur != null && (
                  <div className="flex-1 min-w-[80px] rounded-lg border border-border bg-muted/50 px-2.5 py-1.5">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Lieferkosten</div>
                    <div className="text-sm font-black text-foreground">
                      {result.lieferkosten_eur === 0 ? 'Kostenlos' : `${result.lieferkosten_eur.toFixed(2).replace('.', ',')} €`}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!result && !loading && !error && (
          <p className="text-xs text-muted-foreground">
            Gib deine PLZ ein, um zu prüfen ob wir in dein Gebiet liefern.
          </p>
        )}
      </div>
    </div>
  );
}
