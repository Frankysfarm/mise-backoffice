'use client';

/**
 * SchichtEngpassMonitor — Phase 421
 *
 * Zeigt der Küche live die aktuelle Druck-Situation und prognostiziert,
 * ob in den nächsten 30 Minuten ein Engpass droht.
 * API: GET /api/delivery/admin/wartezeit-analyse?action=kueche&location_id=...
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, Flame, Loader2, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KuechenData {
  avgPrepMin:    number | null;
  zielPrepMin:   number;
  deltaMin:      number | null;
  ampel:         'gruen' | 'gelb' | 'rot';
  aktuelleQueue: number;
  ueberfaellig:  number;
}

type DruckStufe = 'niedrig' | 'mittel' | 'hoch' | 'kritisch';

function berechneDruck(d: KuechenData): DruckStufe {
  if (d.ueberfaellig >= 3 || d.aktuelleQueue >= 8) return 'kritisch';
  if (d.ueberfaellig >= 1 || d.aktuelleQueue >= 5 || d.ampel === 'rot') return 'hoch';
  if (d.aktuelleQueue >= 3 || d.ampel === 'gelb') return 'mittel';
  return 'niedrig';
}

function prognoseText(d: KuechenData): string {
  const druck = berechneDruck(d);
  if (druck === 'kritisch') return 'Sofort handeln — Küche überlastet';
  if (druck === 'hoch') return 'Erhöhter Druck — weitere Hilfe empfohlen';
  if (druck === 'mittel') return 'Moderates Aufkommen — im Blick behalten';
  return 'Küche läuft entspannt';
}

const DRUCK_STYLE: Record<DruckStufe, { bg: string; border: string; text: string; badge: string; icon: typeof Flame; iconColor: string }> = {
  kritisch: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-500 text-white',
    icon: Flame,
    iconColor: 'text-red-500',
  },
  hoch: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-400 text-white',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
  },
  mittel: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    badge: 'bg-yellow-400 text-white',
    icon: Clock,
    iconColor: 'text-yellow-500',
  },
  niedrig: {
    bg: 'bg-matcha-50',
    border: 'border-matcha-200',
    text: 'text-matcha-700',
    badge: 'bg-matcha-500 text-white',
    icon: CheckCircle2,
    iconColor: 'text-matcha-500',
  },
};

export function SchichtEngpassMonitor({ locationId }: { locationId: string | null }) {
  const [data, setData]   = useState<KuechenData | null>(null);
  const [prev, setPrev]   = useState<KuechenData | null>(null);
  const [open, setOpen]   = useState(true);
  const [loading, setLoading] = useState(true);
  const [lastSec, setLastSec] = useState(0);

  const laden = useCallback(() => {
    if (!locationId) { setLoading(false); return; }
    fetch(`/api/delivery/admin/wartezeit-analyse?action=kueche&location_id=${encodeURIComponent(locationId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.kueche) {
          setPrev(prev => prev ?? d.kueche);
          setData(d.kueche);
          setLastSec(0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    laden();
    const poll = setInterval(laden, 45_000);
    const tick = setInterval(() => setLastSec(s => s + 1), 1_000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [laden]);

  if (!locationId) return null;
  if (loading && !data) {
    return (
      <div className="rounded-xl border bg-card px-5 py-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Engpass-Monitor lädt…
      </div>
    );
  }
  if (!data) return null;

  const druck = berechneDruck(data);
  const style = DRUCK_STYLE[druck];
  const Icon = style.icon;
  const queueTrend = prev ? data.aktuelleQueue - prev.aktuelleQueue : 0;

  const EMPFEHLUNGEN: Record<DruckStufe, string[]> = {
    kritisch: ['Sofort 2. Kochstation aktivieren', 'Fahrerannahme pausieren', 'Chef informieren'],
    hoch:     ['1 weiteren Koch einsetzen', 'Batch-Größe erhöhen', 'Dispatch über Verzögerung informieren'],
    mittel:   ['Prep-Zeiten im Blick behalten', 'Bei weiteren Bestellungen reagieren'],
    niedrig:  ['Alles im grünen Bereich'],
  };

  return (
    <div className={cn('rounded-xl border overflow-hidden', style.border, style.bg)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 transition"
      >
        <Icon className={cn('h-4 w-4 shrink-0', style.iconColor)} />
        <span className="flex-1 text-left text-xs font-bold uppercase tracking-wider text-foreground">
          Küchen-Engpass-Monitor
        </span>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', style.badge)}>
          {druck === 'niedrig' ? 'Entspannt' : druck === 'mittel' ? 'Moderat' : druck === 'hoch' ? 'Erhöht' : 'Kritisch'}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* KPI-Zeile */}
          <div className="grid grid-cols-3 gap-2">
            {/* Queue-Tiefe */}
            <div className="rounded-lg bg-white/70 border border-white/80 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <span className={cn('text-xl font-black tabular-nums', style.text)}>
                  {data.aktuelleQueue}
                </span>
                {queueTrend !== 0 && (
                  queueTrend > 0
                    ? <TrendingUp className="h-3 w-3 text-red-500" />
                    : <TrendingDown className="h-3 w-3 text-matcha-500" />
                )}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Queue</div>
            </div>

            {/* Ø Prep-Zeit */}
            <div className="rounded-lg bg-white/70 border border-white/80 p-2 text-center">
              <div className={cn('text-xl font-black tabular-nums', data.ampel === 'rot' ? 'text-red-600' : data.ampel === 'gelb' ? 'text-amber-600' : 'text-matcha-700')}>
                {data.avgPrepMin !== null ? `${data.avgPrepMin.toFixed(0)}'` : '—'}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Ø Prep</div>
            </div>

            {/* Überfällig */}
            <div className="rounded-lg bg-white/70 border border-white/80 p-2 text-center">
              <div className={cn('text-xl font-black tabular-nums', data.ueberfaellig > 0 ? 'text-red-600' : 'text-matcha-700')}>
                {data.ueberfaellig}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Überfällig</div>
            </div>
          </div>

          {/* Prognose-Text */}
          <div className={cn('rounded-lg px-3 py-2 flex items-start gap-2', style.bg, 'border', style.border)}>
            <Zap className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', style.iconColor)} />
            <span className={cn('text-xs font-semibold leading-snug', style.text)}>
              {prognoseText(data)}
            </span>
          </div>

          {/* Empfehlungen */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Empfohlene Maßnahmen
            </div>
            <ul className="space-y-1">
              {EMPFEHLUNGEN[druck].map((e, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                  <span className={cn('mt-0.5 h-1.5 w-1.5 rounded-full shrink-0', style.badge.includes('matcha') ? 'bg-matcha-500' : style.badge.includes('amber') ? 'bg-amber-400' : style.badge.includes('yellow') ? 'bg-yellow-400' : 'bg-red-500')} />
                  {e}
                </li>
              ))}
            </ul>
          </div>

          <div className="text-[10px] text-muted-foreground text-right">
            Aktualisiert vor {lastSec}s
          </div>
        </div>
      )}
    </div>
  );
}
