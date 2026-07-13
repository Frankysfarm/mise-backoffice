'use client';

// Phase 1293 — Küchen-Kapazitäts-Prognose-Widget (Kitchen)
// Nächste 30/60 Min Prognose + Ampel + "Jetzt Vorkochen"-Empfehlung
// Nutzt /api/delivery/admin/kuechen-auslastungs-prognose · locationId-Prop · nach Phase1285

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Flame, Loader2, UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StundenSlot {
  stunde: number;
  erwartete_bestellungen: number;
  historischer_schnitt: number;
  auslastungs_level: 'ruhig' | 'normal' | 'hoch' | 'peak';
}

interface PrognoseData {
  naechste_30_min: StundenSlot;
  naechste_60_min: StundenSlot;
  jetzt_stunde: number;
  prognose_qualitaet: 'hoch' | 'mittel' | 'gering';
  generiert_am: string;
}

const LEVEL_CONFIG = {
  ruhig: { label: 'Ruhig', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', dot: 'bg-slate-400' },
  normal: { label: 'Normal', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', dot: 'bg-emerald-500' },
  hoch: { label: 'Hohe Last', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', dot: 'bg-amber-500' },
  peak: { label: 'Peak!', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', dot: 'bg-red-500' },
};

interface Props {
  locationId: string | null;
}

export function KitchenPhase1293KuechenKapazitaetsPrognoseWidget({ locationId }: Props) {
  const [data, setData] = useState<PrognoseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/kuechen-auslastungs-prognose?location_id=${locationId}`);
        if (active && res.ok) setData(await res.json());
      } catch { /* ignore */ } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  if (!locationId || loading) return null;
  if (!data) return null;

  const s30 = data.naechste_30_min;
  const s60 = data.naechste_60_min;
  const cfg30 = LEVEL_CONFIG[s30.auslastungs_level];
  const cfg60 = LEVEL_CONFIG[s60.auslastungs_level];
  const peakSoon = s30.auslastungs_level === 'peak' || s60.auslastungs_level === 'peak';
  const hochSoon = s30.auslastungs_level === 'hoch' || s60.auslastungs_level === 'hoch';
  const showEmpfehlung = peakSoon || hochSoon;

  const headerColor = peakSoon
    ? 'bg-red-600 dark:bg-red-700'
    : hochSoon
    ? 'bg-amber-600 dark:bg-amber-700'
    : 'bg-teal-600 dark:bg-teal-700';

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center justify-between px-4 py-3 text-white', headerColor)}
      >
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4" />
          <span className="text-sm font-semibold">Küchen-Kapazitäts-Prognose</span>
          {peakSoon && (
            <span className="text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5 animate-pulse">
              PEAK BALD
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white" /> : <ChevronDown className="h-4 w-4 text-white" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Jetzt-Vorkochen-Empfehlung */}
          {showEmpfehlung && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-3 py-2">
              <Flame className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                {peakSoon
                  ? 'Jetzt Vorkochen! Peak-Last in Kürze — Bases und häufige Artikel vorbereiten.'
                  : 'Erhöhte Last erwartet — jetzt schon Mise-en-Place vorbereiten.'}
              </p>
            </div>
          )}

          {/* 30/60-Min-Kacheln */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { slot: s30, cfg: cfg30, label: 'In 30 Min' },
              { slot: s60, cfg: cfg60, label: 'In 60 Min' },
            ].map(({ slot, cfg, label }) => (
              <div key={label} className={cn('rounded-xl p-3 space-y-1', cfg.bg)}>
                <div className="flex items-center gap-1.5">
                  <Clock className={cn('h-3.5 w-3.5', cfg.color)} />
                  <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">{label}</span>
                </div>
                <div className={cn('text-2xl font-black', cfg.color)}>
                  {slot.erwartete_bestellungen}
                </div>
                <div className="text-[10px] text-stone-500 dark:text-stone-400">
                  erw. Bestellungen
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
                  <span className={cn('text-[10px] font-bold', cfg.color)}>{cfg.label}</span>
                </div>
                <div className="text-[10px] text-stone-400 dark:text-stone-500">
                  Ø-Vergleich: {slot.historischer_schnitt}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500">
            <span>Prognose-Qualität: {data.prognose_qualitaet}</span>
            <span>
              {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
