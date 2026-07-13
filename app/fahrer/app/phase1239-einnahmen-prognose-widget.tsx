'use client';

// Phase 1239 — Einnahmen-Prognose-Widget (Fahrer-App)
// Nutzt /api/delivery/driver/einnahmen-prognose
// Hochrechnungs-Balken bis Schichtende + Bronze/Silber/Gold-Ziel
// isOnline-Guard · 5-Min-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, Euro, Star, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EinnahmenPrognose {
  fahrer_id: string;
  bisherige_einnahmen_eur: number;
  aktive_stunden: number;
  verbleibende_stunden: number;
  prognose_tagesende_eur: number;
  stopp_bonus_eur: number;
  einnahmen_pro_stunde_eur: number;
  stopp_anzahl_heute: number;
  ziel_bronze_eur: number;
  ziel_silber_eur: number;
  ziel_gold_eur: number;
  ziel_status: 'unter_bronze' | 'bronze' | 'silber' | 'gold';
}

const ZIEL_STYLE = {
  gold: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', bar: 'bg-amber-500', label: 'Gold-Ziel erreicht!' },
  silber: { text: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-900/20', bar: 'bg-slate-400', label: 'Silber-Ziel erreicht!' },
  bronze: { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', bar: 'bg-orange-400', label: 'Bronze-Ziel erreicht!' },
  unter_bronze: { text: 'text-stone-600 dark:text-stone-400', bg: 'bg-stone-50 dark:bg-stone-800/40', bar: 'bg-blue-400', label: 'Auf Kurs' },
} as const;

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function ZielBalken({ label, ziel, prognose, bar }: { label: string; ziel: number; prognose: number; bar: string }) {
  const pct = Math.min((prognose / Math.max(ziel, 1)) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] text-stone-500 dark:text-stone-400 mb-0.5">
        <span>{label}</span>
        <span className="font-semibold">{fmtEur(ziel)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function FahrerPhase1239EinnahmenPrognoseWidget({
  driverId,
  isOnline,
}: {
  driverId: string;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<EinnahmenPrognose | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!driverId || !isOnline) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/einnahmen-prognose?driver_id=${encodeURIComponent(driverId)}`);
        const d = await res.json();
        if (!cancelled) setData(d);
      } catch {
        // silent fallback — no mock needed, component stays empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [driverId, isOnline]);

  if (!isOnline || !data) return null;

  const style = ZIEL_STYLE[data.ziel_status];

  return (
    <div className={cn('rounded-2xl border overflow-hidden', style.bg, 'border-stone-200 dark:border-stone-700')}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:opacity-80 transition-opacity"
        onClick={() => setOpen((o) => !o)}
      >
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', style.bg)}>
          <TrendingUp className={cn('h-4 w-4', style.text)} />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-stone-800 dark:text-stone-100">Einnahmen-Prognose</div>
          <div className={cn('text-xs font-semibold', style.text)}>
            Prognose: {fmtEur(data.prognose_tagesende_eur)} · {style.label}
          </div>
        </div>
        {loading && <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />}
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/60 dark:bg-black/20 p-2.5 text-center">
              <div className="text-base font-black text-stone-800 dark:text-stone-100">{fmtEur(data.bisherige_einnahmen_eur)}</div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400">Bisher</div>
            </div>
            <div className="rounded-xl bg-white/60 dark:bg-black/20 p-2.5 text-center">
              <div className="text-base font-black text-stone-800 dark:text-stone-100">{fmtEur(data.einnahmen_pro_stunde_eur)}</div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400">Pro Stunde</div>
            </div>
            <div className="rounded-xl bg-white/60 dark:bg-black/20 p-2.5 text-center">
              <div className="text-base font-black text-stone-800 dark:text-stone-100">{data.stopp_anzahl_heute}</div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400">Stopps</div>
            </div>
          </div>

          {/* Schicht-Info */}
          <div className="text-[10px] text-stone-500 dark:text-stone-400 flex gap-3">
            <span>Aktiv: {data.aktive_stunden}h</span>
            <span>·</span>
            <span>Verbleibend: {data.verbleibende_stunden}h</span>
            <span>·</span>
            <span>Stopp-Bonus: {fmtEur(data.stopp_bonus_eur)}</span>
          </div>

          {/* Ziel-Balken */}
          <div className="space-y-2 pt-1">
            <ZielBalken label="Bronze" ziel={data.ziel_bronze_eur} prognose={data.prognose_tagesende_eur} bar="bg-orange-400" />
            <ZielBalken label="Silber" ziel={data.ziel_silber_eur} prognose={data.prognose_tagesende_eur} bar="bg-slate-400" />
            <ZielBalken label="Gold" ziel={data.ziel_gold_eur} prognose={data.prognose_tagesende_eur} bar="bg-amber-500" />
          </div>

          {/* Ziel-Badges */}
          <div className="flex gap-1.5 pt-0.5">
            {(['bronze', 'silber', 'gold'] as const).map((tier) => {
              const reached =
                tier === 'bronze' ? data.prognose_tagesende_eur >= data.ziel_bronze_eur :
                tier === 'silber' ? data.prognose_tagesende_eur >= data.ziel_silber_eur :
                data.prognose_tagesende_eur >= data.ziel_gold_eur;
              const colors = {
                bronze: reached ? 'bg-orange-500 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-400',
                silber: reached ? 'bg-slate-400 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-400',
                gold: reached ? 'bg-amber-500 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-400',
              }[tier];
              return (
                <span key={tier} className={cn('flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold capitalize', colors)}>
                  <Award className="h-3 w-3" />
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
