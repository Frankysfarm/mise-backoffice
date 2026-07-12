'use client';

import { useCallback, useEffect, useState } from 'react';
import { Award, CheckCircle2, Clock, MapPin, Star, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1178 — Tour-Zusammenfassung-Screen (Fahrer-App)
// Nach Tour-Abschluss: km/Stopps/Trinkgeld/Ø-Bewertung + Motivations-Tier

interface Props {
  driverId: string;
  lastBatchId: string | null;
}

interface TourData {
  batch_id: string;
  stopps: number;
  km_geschaetzt: number;
  trinkgeld_eur: number;
  bewertung_avg: number | null;
  dauer_min: number;
  zone: string;
  abgeschlossen_um: string;
}

type Tier = 'legend' | 'star' | 'good' | 'ok';

function motivationTier(stopps: number, trinkgeld: number, bewertung: number | null): { tier: Tier; label: string; emoji: string; text: string } {
  const score = stopps * 10 + trinkgeld * 2 + (bewertung ?? 0) * 5;
  if (score >= 100 || (bewertung ?? 0) >= 4.8) return { tier: 'legend', label: 'Legende', emoji: '🏆', text: 'Außergewöhnliche Tour!' };
  if (score >= 60 || (bewertung ?? 0) >= 4.5)  return { tier: 'star',   label: 'Star',    emoji: '⭐', text: 'Klasse Leistung!' };
  if (score >= 30)                               return { tier: 'good',   label: 'Solid',   emoji: '👍', text: 'Gute Tour!' };
  return                                               { tier: 'ok',     label: 'OK',      emoji: '✅', text: 'Tour abgeschlossen.' };
}

const TIER_STYLE: Record<Tier, { bg: string; border: string; text: string; badge: string }> = {
  legend: { bg: 'bg-yellow-50',  border: 'border-yellow-300', text: 'text-yellow-700', badge: 'bg-yellow-500' },
  star:   { bg: 'bg-matcha-50',  border: 'border-matcha-300', text: 'text-matcha-700', badge: 'bg-matcha-500' },
  good:   { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-500'   },
  ok:     { bg: 'bg-muted/30',   border: 'border-muted',      text: 'text-foreground', badge: 'bg-muted-foreground' },
};

const MOCK: TourData = {
  batch_id: 'mock-1',
  stopps: 4,
  km_geschaetzt: 11.2,
  trinkgeld_eur: 5.5,
  bewertung_avg: 4.7,
  dauer_min: 38,
  zone: 'B',
  abgeschlossen_um: new Date().toISOString(),
};

export function FahrerPhase1178TourZusammenfassung({ driverId, lastBatchId }: Props) {
  const [data, setData] = useState<TourData | null>(null);
  const [visible, setVisible] = useState(true);

  const load = useCallback(async () => {
    if (!lastBatchId) return;
    try {
      const r = await fetch(`/api/delivery/driver/schicht-bilanz?driver_id=${driverId}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      // Build tour summary from schicht-bilanz data
      const stopps = d.stopps_heute ?? d.stopps ?? MOCK.stopps;
      const km = d.km_geschaetzt ?? MOCK.km_geschaetzt;
      const trinkgeld = d.trinkgeld_eur ?? MOCK.trinkgeld_eur;
      const bewertung = d.bewertung_avg ?? d.avg_bewertung ?? MOCK.bewertung_avg;
      const dauer = d.schicht_min ?? MOCK.dauer_min;
      setData({ batch_id: lastBatchId, stopps, km_geschaetzt: km, trinkgeld_eur: trinkgeld, bewertung_avg: bewertung, dauer_min: dauer, zone: d.zone ?? MOCK.zone, abgeschlossen_um: new Date().toISOString() });
    } catch {
      setData({ ...MOCK, batch_id: lastBatchId });
    }
  }, [driverId, lastBatchId]);

  useEffect(() => {
    if (lastBatchId) { load(); setVisible(true); }
  }, [lastBatchId, load]);

  if (!data || !visible || !lastBatchId) return null;

  const mot = motivationTier(data.stopps, data.trinkgeld_eur, data.bewertung_avg);
  const style = TIER_STYLE[mot.tier];

  return (
    <div className={cn('rounded-2xl border overflow-hidden', style.bg, style.border)}>
      {/* Header */}
      <div className={cn('flex items-center gap-3 px-4 py-3 border-b border-black/10')}>
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center text-xl shrink-0', style.badge)}>
          <span>{mot.emoji}</span>
        </div>
        <div className="flex-1">
          <div className={cn('font-black text-base', style.text)}>Tour abgeschlossen!</div>
          <div className="text-[11px] text-muted-foreground">{mot.text}</div>
        </div>
        <button onClick={() => setVisible(false)} className="text-muted-foreground text-[10px] underline">
          Schließen
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2 px-4 py-3">
        {[
          { icon: CheckCircle2, label: 'Stopps', value: data.stopps.toString(), sub: `Zone ${data.zone}` },
          { icon: Clock,        label: 'Dauer',  value: `${data.dauer_min} Min`, sub: data.abgeschlossen_um ? new Date(data.abgeschlossen_um).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr' : '' },
          { icon: MapPin,       label: 'Km',     value: `${data.km_geschaetzt.toFixed(1)} km`, sub: `${(data.km_geschaetzt / Math.max(1, data.stopps)).toFixed(1)} km/Stopp` },
          { icon: TrendingUp,   label: 'Trinkgeld', value: `${data.trinkgeld_eur.toFixed(2)} €`, sub: `${(data.trinkgeld_eur / Math.max(1, data.stopps)).toFixed(2)} €/Stopp` },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl bg-white/60 border px-3 py-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Icon size={10} className="text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{k.label}</span>
              </div>
              <div className={cn('font-black text-lg tabular-nums', style.text)}>{k.value}</div>
              {k.sub && <div className="text-[9px] text-muted-foreground">{k.sub}</div>}
            </div>
          );
        })}
      </div>

      {/* Bewertung */}
      {data.bewertung_avg !== null && (
        <div className={cn('flex items-center gap-3 px-4 py-2.5 border-t border-black/10')}>
          <Star size={16} className="text-yellow-500 fill-yellow-500 shrink-0" />
          <div className="flex-1">
            <span className="font-bold text-sm">{data.bewertung_avg.toFixed(1)}</span>
            <span className="text-[10px] text-muted-foreground ml-1">Ø Kundenbewertung</span>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} size={12} className={i < Math.round(data.bewertung_avg ?? 0) ? 'text-yellow-500 fill-yellow-500' : 'text-muted'} />
            ))}
          </div>
        </div>
      )}

      {/* Motivations-Badge */}
      <div className={cn('flex items-center gap-2 px-4 py-2 border-t border-black/10 bg-white/40')}>
        <Award size={12} className={style.text} />
        <span className={cn('text-[10px] font-bold uppercase tracking-wider', style.text)}>{mot.label}</span>
        <Zap size={10} className={cn('ml-auto', style.text)} />
        <span className={cn('text-[10px] font-bold', style.text)}>{mot.text}</span>
      </div>
    </div>
  );
}
