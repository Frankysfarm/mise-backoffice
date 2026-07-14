'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Gift, Star, RefreshCw } from 'lucide-react';

// Phase 1448 — Treue-Punkte-Anzeige (Storefront)
// Earned-Points-Badge (X Punkte = Y€ Rabatt) aus localStorage oder API
// localStorage-Fallback; 5-Min-Polling wenn eingeloggt; nach Phase1443

const PUNKTE_PRO_EURO = 10;
const PUNKTE_FUER_1_EUR_RABATT = 100;
const STORAGE_KEY = 'treue_punkte';
const POLL_MS = 5 * 60 * 1000;

interface ApiData {
  punkte: number;
  rabatt_eur: number;
  naechstes_ziel_punkte: number;
  naechstes_ziel_label: string;
}

interface Props {
  locationId: string;
  customerId?: string | null;
  neuePunkte?: number;
}

function buildFromStorage(): ApiData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const punkte = parseInt(raw, 10);
    if (isNaN(punkte) || punkte <= 0) return null;
    const rabattEur = Math.floor(punkte / PUNKTE_FUER_1_EUR_RABATT);
    const naechstesZiel = Math.ceil(punkte / PUNKTE_FUER_1_EUR_RABATT + 1) * PUNKTE_FUER_1_EUR_RABATT;
    return {
      punkte,
      rabatt_eur: rabattEur,
      naechstes_ziel_punkte: naechstesZiel,
      naechstes_ziel_label: `${Math.ceil(punkte / PUNKTE_FUER_1_EUR_RABATT + 1)}€ Rabatt`,
    };
  } catch {
    return null;
  }
}

function fmtRabatt(eur: number): string {
  return eur.toFixed(2).replace('.', ',') + ' €';
}

export function TreuePunkteAnzeige({ locationId, customerId, neuePunkte }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!customerId) {
      const lokal = buildFromStorage();
      setData(lokal);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/public/treue-punkte?location_id=${locationId}&customer_id=${customerId}`,
      );
      if (res.ok) {
        const json: ApiData = await res.json();
        setData(json);
        try { localStorage.setItem(STORAGE_KEY, String(json.punkte)); } catch {}
        return;
      }
    } catch {
      // fallthrough
    } finally {
      setLoading(false);
    }
    const lokal = buildFromStorage();
    setData(lokal);
  }, [locationId, customerId]);

  useEffect(() => {
    if (!mounted) return;
    load();
    if (customerId) {
      timerRef.current = setInterval(load, POLL_MS);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load, mounted, customerId]);

  // Neue Punkte gutschreiben wenn übergeben
  useEffect(() => {
    if (!neuePunkte || neuePunkte <= 0) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const prev = raw ? parseInt(raw, 10) : 0;
      const neu = (isNaN(prev) ? 0 : prev) + neuePunkte;
      localStorage.setItem(STORAGE_KEY, String(neu));
    } catch {}
  }, [neuePunkte]);

  if (!mounted || !data) return null;

  const fortschritt = data.naechstes_ziel_punkte > 0
    ? Math.min(100, Math.round(((data.punkte % PUNKTE_FUER_1_EUR_RABATT) / PUNKTE_FUER_1_EUR_RABATT) * 100))
    : 0;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 shadow-sm">
      {/* Icon */}
      <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" />

      {/* Punkte */}
      <span className="text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300">
        {data.punkte.toLocaleString('de-DE')} Punkte
      </span>

      {/* Rabatt */}
      {data.rabatt_eur > 0 && (
        <>
          <span className="text-amber-400 dark:text-amber-600 text-xs">·</span>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5">
            <Gift className="w-3 h-3" />
            {fmtRabatt(data.rabatt_eur)} Rabatt
          </span>
        </>
      )}

      {/* Fortschritts-Pill zum nächsten Ziel */}
      {data.punkte % PUNKTE_FUER_1_EUR_RABATT > 0 && (
        <div className="hidden sm:flex items-center gap-1">
          <span className="text-amber-400 text-xs">·</span>
          <div className="w-16 h-1.5 rounded-full bg-amber-200 dark:bg-amber-900/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 dark:bg-amber-500 transition-all duration-500"
              style={{ width: `${fortschritt}%` }}
            />
          </div>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 whitespace-nowrap">
            nächste {fmtRabatt(1)}
          </span>
        </div>
      )}

      {loading && <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-400 ml-0.5" />}
    </div>
  );
}
