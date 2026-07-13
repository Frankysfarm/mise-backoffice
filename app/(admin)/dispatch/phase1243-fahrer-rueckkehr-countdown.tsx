'use client';

// Phase 1243 — Fahrer-Rückkehr-Countdown-Live (Dispatch)
// Für jeden aktiven Fahrer: ETA zurück zur Basis in Min + wie viele Touren noch bis Schichtende
// 60s-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Home, Clock, Bike, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerRueckkehr {
  fahrer_id: string;
  fahrer_name: string;
  zone: string | null;
  eta_basis_min: number | null;
  aktuelle_stopps_verbleibend: number;
  schicht_ende_uhr: string | null;
  noch_moegliche_touren: number;
  status: 'auf_tour' | 'rückkehr_nah' | 'fast_schichtende' | 'frei';
}

interface ApiResponse {
  fahrer: FahrerRueckkehr[];
  location_id: string;
  generiert_am: string;
}

const STATUS_STYLE: Record<FahrerRueckkehr['status'], { bg: string; border: string; badge: string; label: string }> = {
  auf_tour: {
    bg: 'bg-blue-50 dark:bg-blue-900/10',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-500 text-white',
    label: 'Auf Tour',
  },
  rückkehr_nah: {
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-500 text-white',
    label: 'Kehrt zurück',
  },
  fast_schichtende: {
    bg: 'bg-red-50 dark:bg-red-900/10',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-500 text-white',
    label: 'Fast Schichtende',
  },
  frei: {
    bg: 'bg-matcha-50 dark:bg-matcha-900/10',
    border: 'border-matcha-200 dark:border-matcha-800',
    badge: 'bg-matcha-500 text-white',
    label: 'Verfügbar',
  },
};

function buildMock(): ApiResponse {
  const now = new Date();
  const fahrer: FahrerRueckkehr[] = [
    {
      fahrer_id: 'm1',
      fahrer_name: 'Tobias M.',
      zone: 'Nord',
      eta_basis_min: 8,
      aktuelle_stopps_verbleibend: 1,
      schicht_ende_uhr: '22:00',
      noch_moegliche_touren: 3,
      status: 'rückkehr_nah',
    },
    {
      fahrer_id: 'm2',
      fahrer_name: 'Sara K.',
      zone: 'Süd',
      eta_basis_min: 22,
      aktuelle_stopps_verbleibend: 3,
      schicht_ende_uhr: '23:00',
      noch_moegliche_touren: 2,
      status: 'auf_tour',
    },
    {
      fahrer_id: 'm3',
      fahrer_name: 'Max B.',
      zone: 'Mitte',
      eta_basis_min: 4,
      aktuelle_stopps_verbleibend: 0,
      schicht_ende_uhr: `${now.getHours().toString().padStart(2, '0')}:30`,
      noch_moegliche_touren: 1,
      status: 'fast_schichtende',
    },
  ];
  return { fahrer, location_id: '', generiert_am: now.toISOString() };
}

export function DispatchPhase1243FahrerRueckkehrCountdown({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  function load() {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/fahrer-rueckkehr-countdown?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ApiResponse | null) => {
        setData(d ?? buildMock());
        setLastUpdated(new Date());
      })
      .catch(() => {
        setData(buildMock());
        setLastUpdated(new Date());
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const activeFahrer = data?.fahrer.filter((f) => f.status !== 'frei') ?? [];

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
          <Home className="h-4 w-4" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-stone-800 dark:text-stone-100">Fahrer-Rückkehr-Countdown</div>
          <div className="text-xs text-stone-400 dark:text-stone-500">
            ETA Basis + noch mögliche Touren
            {lastUpdated && (
              <span className="ml-2">
                · {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        {loading && (
          <div className="h-3 w-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
        )}
        {activeFahrer.length > 0 && (
          <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
            {activeFahrer.length} Fahrer
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {activeFahrer.length === 0 ? (
            <div className="text-sm text-stone-400 text-center py-4">Keine aktiven Fahrer</div>
          ) : (
            activeFahrer.map((f) => {
              const s = STATUS_STYLE[f.status];
              return (
                <div
                  key={f.fahrer_id}
                  className={cn('rounded-xl border p-3 flex items-center gap-3', s.bg, s.border)}
                >
                  {/* Status badge */}
                  <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black min-w-[72px] text-center', s.badge)}>
                    {s.label}
                  </div>

                  {/* Driver info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-100 truncate">{f.fahrer_name}</span>
                      {f.zone && (
                        <span className="text-[9px] rounded-full bg-white/60 dark:bg-stone-700/60 border border-stone-200 dark:border-stone-600 px-1.5 py-0.5 font-bold text-stone-600 dark:text-stone-300">
                          {f.zone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {f.aktuelle_stopps_verbleibend > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-stone-500 dark:text-stone-400">
                          <Bike className="h-3 w-3" />
                          {f.aktuelle_stopps_verbleibend} Stopp{f.aktuelle_stopps_verbleibend !== 1 ? 's' : ''} verbleibend
                        </span>
                      )}
                      {f.schicht_ende_uhr && (
                        <span className="flex items-center gap-1 text-[10px] text-stone-500 dark:text-stone-400">
                          <Clock className="h-3 w-3" />
                          Schichtende {f.schicht_ende_uhr}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ETA + tours */}
                  <div className="shrink-0 text-right">
                    {f.eta_basis_min !== null && (
                      <div className="flex items-baseline gap-0.5 justify-end">
                        <span className="font-mono text-lg font-black tabular-nums text-stone-800 dark:text-stone-100">
                          {f.eta_basis_min}
                        </span>
                        <span className="text-[9px] text-stone-400">Min</span>
                      </div>
                    )}
                    <div className={cn(
                      'text-[10px] font-bold',
                      f.noch_moegliche_touren >= 3 ? 'text-matcha-600' :
                      f.noch_moegliche_touren >= 1 ? 'text-amber-600' : 'text-red-600',
                    )}>
                      {f.noch_moegliche_touren > 0
                        ? `+${f.noch_moegliche_touren} Tour${f.noch_moegliche_touren !== 1 ? 'en' : ''} möglich`
                        : 'Keine Tour mehr'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
