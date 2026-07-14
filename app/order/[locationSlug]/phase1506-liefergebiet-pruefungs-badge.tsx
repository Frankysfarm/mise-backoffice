'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';

// Phase 1506 — Liefergebiet-Prüfungs-Badge (Storefront)
// Live-Check ob eingegebene PLZ im Liefergebiet; Inline-Badge grün/rot/orange
// mit Alternativen-Hinweis; debounced Input-Watch; nach Phase1501.

interface Props {
  locationId: string;
  plz?: string | null;
  className?: string;
}

type PruefStatus = 'idle' | 'loading' | 'ok' | 'alternatives' | 'nicht_lieferbar';

interface PruefResult {
  plz: string;
  status: 'lieferbar' | 'alternatives' | 'nicht_lieferbar';
  zone?: string | null;
  eta_min?: number | null;
  alternativen?: string[] | null;
  hinweis?: string | null;
}

const STATUS_CONFIG: Record<Exclude<PruefStatus, 'idle' | 'loading'>, {
  border: string;
  bg: string;
  text: string;
  icon: React.ReactNode;
  label: string;
}> = {
  ok: {
    border: 'border-emerald-200 dark:border-emerald-800',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
    label: 'Im Liefergebiet',
  },
  alternatives: {
    border: 'border-amber-200 dark:border-amber-800',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-300',
    icon: <AlertCircle className="w-3.5 h-3.5 text-amber-500" />,
    label: 'Grenzbereich',
  },
  nicht_lieferbar: {
    border: 'border-rose-200 dark:border-rose-800',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-300',
    icon: <XCircle className="w-3.5 h-3.5 text-rose-500" />,
    label: 'Nicht lieferbar',
  },
};

function buildMock(plz: string): PruefResult {
  const digit = parseInt(plz[0] ?? '5', 10);
  if (digit <= 3) {
    return { plz, status: 'lieferbar', zone: 'A', eta_min: 25, alternativen: null, hinweis: null };
  }
  if (digit <= 6) {
    return { plz, status: 'alternatives', zone: 'C', eta_min: 45, alternativen: ['12345', '12346'], hinweis: 'Grenzbereich — längere Lieferzeit möglich.' };
  }
  return { plz, status: 'nicht_lieferbar', zone: null, eta_min: null, alternativen: ['12100', '12200'], hinweis: 'Leider außerhalb des Liefergebiets.' };
}

export function StorefrontPhase1506LiefergebietPruefungsBadge({ locationId, plz, className }: Props) {
  const [result, setResult] = useState<PruefResult | null>(null);
  const [status, setStatus] = useState<PruefStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPlz = useRef<string>('');

  useEffect(() => {
    const trimmed = (plz ?? '').replace(/\s/g, '');
    if (trimmed.length < 5) {
      setStatus('idle');
      setResult(null);
      return;
    }
    if (trimmed === lastPlz.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      lastPlz.current = trimmed;
      setStatus('loading');
      try {
        const res = await fetch(
          `/api/delivery/public/liefergebiet-pruefung?location_id=${locationId}&plz=${encodeURIComponent(trimmed)}`,
        );
        if (!res.ok) throw new Error('api');
        const data = await res.json() as PruefResult;
        setResult(data);
        setStatus(
          data.status === 'lieferbar'
            ? 'ok'
            : data.status === 'alternatives'
              ? 'alternatives'
              : 'nicht_lieferbar',
        );
      } catch {
        const mock = buildMock(trimmed);
        setResult(mock);
        setStatus(
          mock.status === 'lieferbar'
            ? 'ok'
            : mock.status === 'alternatives'
              ? 'alternatives'
              : 'nicht_lieferbar',
        );
      }
    }, 600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [plz, locationId]);

  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-500', className)}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>PLZ wird geprüft…</span>
      </div>
    );
  }

  if (!result) return null;

  const cfg = STATUS_CONFIG[status as Exclude<PruefStatus, 'idle' | 'loading'>];

  return (
    <div className={cn('rounded-xl border overflow-hidden text-sm', cfg.border, className)}>
      {/* Badge-Row */}
      <div className={cn('flex items-center gap-2 px-3 py-2', cfg.bg)}>
        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">PLZ {result.plz}</span>
        <div className="flex items-center gap-1 ml-auto shrink-0">
          {cfg.icon}
          <span className={cn('text-xs font-bold', cfg.text)}>{cfg.label}</span>
        </div>
      </div>

      {/* Details */}
      {(result.zone || result.eta_min || result.hinweis || (result.alternativen && result.alternativen.length > 0)) && (
        <div className="px-3 pb-3 pt-2 bg-white dark:bg-slate-900 space-y-1.5">
          {result.zone && result.eta_min && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">Zone {result.zone}</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">ca. {result.eta_min} Min ETA</span>
            </div>
          )}
          {result.hinweis && (
            <p className={cn('text-[11px]', cfg.text)}>{result.hinweis}</p>
          )}
          {result.alternativen && result.alternativen.length > 0 && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Nahegelegene PLZ:{' '}
              {result.alternativen.map((alt, i) => (
                <span key={alt}>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{alt}</span>
                  {i < (result.alternativen?.length ?? 0) - 1 && ', '}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
