'use client';

import { useMemo } from 'react';
import { CheckCircle2, Clock, MapPin, Navigation, Package, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1162 — Tour-Stopp-Live-Kommando (Fahrer-App)
// Nächster Stopp mit ETA-Ring, Adresse, Kundentelefon und Navi-Button

interface Stop {
  id: string;
  reihenfolge?: number;
  geliefert_am?: string | null;
  order?: {
    bestellnummer?: string;
    kunde_name?: string;
    kunde_adresse?: string | null;
    kunde_plz?: string | null;
    kunde_telefon?: string | null;
    gesamtbetrag?: number;
    bezahlt?: boolean;
    zahlungsart?: string;
    eta_earliest?: string | null;
    eta_latest?: string | null;
    kunde_notiz?: string | null;
  } | null;
}

interface Props {
  activeBatch: { id: string; stops: Stop[] } | null;
}

function etaMin(stop: Stop): number | null {
  const s = stop.order?.eta_latest;
  if (!s) return null;
  return Math.round((new Date(s).getTime() - Date.now()) / 60_000);
}

function naviUrl(stop: Stop): string {
  const adresse = [stop.order?.kunde_adresse, stop.order?.kunde_plz].filter(Boolean).join(', ');
  return `https://maps.google.com/?q=${encodeURIComponent(adresse)}`;
}

export function FahrerPhase1162TourStoppLiveKommando({ activeBatch }: Props) {
  const naechster = useMemo(() => {
    if (!activeBatch) return null;
    return (activeBatch.stops ?? [])
      .filter(s => !s.geliefert_am)
      .sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0))[0] ?? null;
  }, [activeBatch]);

  if (!naechster) return null;

  const o = naechster.order;
  const minLeft = etaMin(naechster);
  const urgent = minLeft !== null && minLeft < 5;
  const overdue = minLeft !== null && minLeft < 0;
  const adresse = [o?.kunde_adresse, o?.kunde_plz].filter(Boolean).join(', ') || '—';
  const erledigt = (activeBatch?.stops ?? []).filter(s => !!s.geliefert_am).length;
  const gesamt = (activeBatch?.stops ?? []).length;

  return (
    <div className={cn('rounded-2xl border overflow-hidden', overdue ? 'bg-red-50 border-red-300' : urgent ? 'bg-amber-50 border-amber-300' : 'bg-matcha-50 border-matcha-200')}>
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-4 py-2.5 border-b', overdue ? 'border-red-200 bg-red-100' : urgent ? 'border-amber-200 bg-amber-100' : 'border-matcha-200 bg-matcha-100')}>
        <Package size={14} className={overdue ? 'text-red-700' : urgent ? 'text-amber-700' : 'text-matcha-700'} />
        <span className={cn('font-bold text-sm uppercase tracking-wider', overdue ? 'text-red-800' : urgent ? 'text-amber-800' : 'text-matcha-800')}>
          Nächster Stopp
        </span>
        <span className="ml-auto text-[10px] font-bold text-muted-foreground">{erledigt}/{gesamt} erledigt</span>
        <div className="flex gap-0.5">
          {(activeBatch?.stops ?? []).map((s, i) => (
            <span key={s.id} className={cn('h-1.5 w-4 rounded-full', s.geliefert_am ? 'bg-matcha-500' : i === erledigt ? (overdue ? 'bg-red-500' : urgent ? 'bg-amber-500' : 'bg-matcha-400 animate-pulse') : 'bg-muted')} />
          ))}
        </div>
      </div>

      {/* Hauptkarte */}
      <div className="p-4 space-y-3">
        {/* Kundenname + Bestellung */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base truncate">{o?.kunde_name ?? 'Kunde'}</div>
            <div className="text-xs text-muted-foreground">#{o?.bestellnummer?.slice(-6) ?? '—'}</div>
          </div>
          {/* ETA Badge */}
          {minLeft !== null && (
            <div className={cn('rounded-xl px-3 py-1.5 text-center shrink-0', overdue ? 'bg-red-600 text-white' : urgent ? 'bg-amber-500 text-white' : 'bg-matcha-600 text-white')}>
              <div className="font-mono font-black text-lg tabular-nums">
                {overdue ? `+${Math.abs(minLeft)}` : minLeft}
              </div>
              <div className="text-[9px] font-bold">Min</div>
            </div>
          )}
        </div>

        {/* Adresse */}
        <div className="flex items-center gap-2 rounded-xl bg-white/80 border px-3 py-2">
          <MapPin size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm flex-1 truncate">{adresse}</span>
        </div>

        {/* Zahlungsart + Betrag */}
        {o?.gesamtbetrag != null && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold">{o.gesamtbetrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', o.bezahlt ? 'bg-matcha-100 text-matcha-700' : 'bg-amber-100 text-amber-700')}>
              {o.bezahlt ? 'Bezahlt' : (o.zahlungsart ?? 'Barzahlung')}
            </span>
          </div>
        )}

        {/* Notiz */}
        {o?.kunde_notiz && (
          <div className="text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5 text-yellow-800">
            {o.kunde_notiz}
          </div>
        )}

        {/* Aktionen */}
        <div className="flex gap-2 pt-1">
          <a href={naviUrl(naechster)} target="_blank" rel="noopener noreferrer"
            className={cn('flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold text-sm text-white', overdue ? 'bg-red-600' : urgent ? 'bg-amber-500' : 'bg-matcha-600')}>
            <Navigation size={16} />
            Navi starten
          </a>
          {o?.kunde_telefon && (
            <a href={`tel:${o.kunde_telefon}`}
              className="flex items-center justify-center gap-1 rounded-xl px-4 py-2.5 font-bold text-sm bg-white border border-muted text-foreground">
              <Phone size={16} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
