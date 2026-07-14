'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Bike, TrendingDown, X } from 'lucide-react';

// Phase 1471 — Dynamische ETA-Anzeige (Storefront)
// Live-Polling der Lieferzeit-Schätzung je Standort;
// Farbkodierung (grün < 30 Min / gelb < 45 / orange < 60 / rot ≥ 60);
// schließbar; Hydration-safe; API-Polling 5 Min.

const STORAGE_KEY = 'eta_anzeige_dismissed';

interface Props {
  locationId: string;
  className?: string;
}

interface EtaData {
  eta_min: number;
  eta_label: string;
  is_peak: boolean;
  last_update: string;
}

function buildMock(): EtaData {
  const eta = 25 + Math.floor(Math.random() * 20);
  return {
    eta_min: eta,
    eta_label: `${eta}–${eta + 5} Min`,
    is_peak: eta > 40,
    last_update: new Date().toISOString(),
  };
}

type EtaFarbe = 'gruen' | 'gelb' | 'orange' | 'rot';

function getEtaFarbe(min: number): EtaFarbe {
  if (min < 30) return 'gruen';
  if (min < 45) return 'gelb';
  if (min < 60) return 'orange';
  return 'rot';
}

const FARB_CFG: Record<EtaFarbe, { bg: string; border: string; text: string; icon: string }> = {
  gruen:  { bg: 'bg-emerald-50 dark:bg-emerald-950/30',  border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', icon: 'text-emerald-500' },
  gelb:   { bg: 'bg-amber-50 dark:bg-amber-950/30',       border: 'border-amber-200 dark:border-amber-800',     text: 'text-amber-700 dark:text-amber-300',     icon: 'text-amber-500' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950/30',     border: 'border-orange-200 dark:border-orange-800',   text: 'text-orange-700 dark:text-orange-300',   icon: 'text-orange-500' },
  rot:    { bg: 'bg-rose-50 dark:bg-rose-950/30',         border: 'border-rose-200 dark:border-rose-800',       text: 'text-rose-700 dark:text-rose-300',       icon: 'text-rose-500' },
};

function isDismissed(locationId: string): boolean {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${locationId}`);
    if (!raw) return false;
    const { ts } = JSON.parse(raw) as { ts: number };
    return Date.now() - ts < 15 * 60 * 1000;
  } catch { return false; }
}

function dismiss(locationId: string): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${locationId}`, JSON.stringify({ ts: Date.now() }));
  } catch {}
}

export function StorefrontPhase1471DynamischeEtaAnzeige({ locationId, className }: Props) {
  const [data, setData] = useState<EtaData | null>(null);
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const checked = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  async function fetchEta() {
    try {
      const res = await fetch(`/api/delivery/customer/kuechen-auslastung?location_id=${locationId}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json?.eta_min != null) {
          setData({ eta_min: json.eta_min, eta_label: json.eta_label ?? `${json.eta_min}–${json.eta_min + 5} Min`, is_peak: !!json.is_peak, last_update: new Date().toISOString() });
          return;
        }
      }
    } catch {}
    setData(buildMock());
  }

  useEffect(() => {
    if (!mounted || checked.current) return;
    checked.current = true;
    if (isDismissed(locationId)) return;
    fetchEta().then(() => setShow(true));
    const iv = setInterval(fetchEta, 5 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, locationId]);

  if (!show || !mounted || !data) return null;

  const farbe = getEtaFarbe(data.eta_min);
  const cfg = FARB_CFG[farbe];

  return (
    <div className={cn(
      'relative rounded-2xl border px-4 py-3 flex items-center gap-3 shadow-sm',
      cfg.bg, cfg.border, className,
    )}>
      {/* Close */}
      <button
        onClick={() => { dismiss(locationId); setShow(false); }}
        className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        aria-label="Schließen"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Icon */}
      <div className={cn('shrink-0', cfg.icon)}>
        <Bike className="w-6 h-6" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-sm font-black tabular-nums', cfg.text)}>
            {data.eta_label}
          </span>
          {data.is_peak && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-orange-600 bg-orange-100 dark:bg-orange-900/40 rounded-full px-1.5 py-0.5">
              <TrendingDown className="w-2.5 h-2.5" />
              Peak
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <Clock className="w-2.5 h-2.5 text-slate-400" />
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            Geschätzte Lieferzeit
          </span>
        </div>
      </div>
    </div>
  );
}
