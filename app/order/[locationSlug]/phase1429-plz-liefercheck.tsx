'use client';

import { useState } from 'react';
import { MapPin, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1429 — PLZ-Liefer-Check (Storefront)
 *
 * Zeigt Kunden ob ihre Postleitzahl im Liefergebiet liegt.
 *   • Eingabefeld für PLZ
 *   • Sofort-Feedback: "Wir liefern zu dir!" / "Leider kein Liefergebiet"
 *   • Liste der belieferten PLZ-Bereiche ausklappbar
 * Props-basiert (deliveryZips aus Location). Nach Phase1424 in storefront.tsx.
 */

interface Props {
  locationId: string;
  deliveryZips?: string[];
}

const DEFAULT_ZIPS = ['10115', '10117', '10119', '10178', '10179', '10243', '10245', '10247'];

type CheckResult = 'ja' | 'nein' | null;

export function StorefrontPhase1429PlzLiefercheck({ deliveryZips }: Props) {
  const zips     = deliveryZips ?? DEFAULT_ZIPS;
  const [input, setInput]     = useState('');
  const [result, setResult]   = useState<CheckResult>(null);
  const [showList, setShowList] = useState(false);

  function check() {
    const clean = input.trim().replace(/\s/g, '');
    if (!clean) return;
    const found = zips.some((z) => z.startsWith(clean));
    setResult(found ? 'ja' : 'nein');
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') check();
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-matcha-600 dark:text-matcha-400" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Liefergebiet prüfen</span>
      </div>

      {/* PLZ-Eingabe */}
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={input}
          onChange={(e) => { setInput(e.target.value); setResult(null); }}
          onKeyDown={handleKey}
          placeholder="PLZ eingeben …"
          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-matcha-400"
        />
        <button
          onClick={check}
          disabled={input.trim().length < 3}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            input.trim().length >= 3
              ? 'bg-matcha-600 text-white hover:bg-matcha-700 dark:bg-matcha-500 dark:hover:bg-matcha-600'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed',
          )}
        >
          Prüfen
        </button>
      </div>

      {/* Ergebnis */}
      {result === 'ja' && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-3 py-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            Wir liefern zu dir! PLZ {input.trim()} liegt in unserem Gebiet.
          </p>
        </div>
      )}
      {result === 'nein' && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700 px-3 py-2">
          <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <p className="text-xs font-semibold text-rose-800 dark:text-rose-200">
            Leider kein Liefergebiet — PLZ {input.trim()} ist aktuell nicht abgedeckt.
          </p>
        </div>
      )}

      {/* PLZ-Liste ausklappbar */}
      <button
        onClick={() => setShowList((p) => !p)}
        className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      >
        {showList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Alle {zips.length} Liefergebiete anzeigen
      </button>

      {showList && (
        <div className="flex flex-wrap gap-1.5">
          {zips.map((z) => (
            <span
              key={z}
              className="rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[11px] font-mono text-slate-600 dark:text-slate-300"
            >
              {z}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
