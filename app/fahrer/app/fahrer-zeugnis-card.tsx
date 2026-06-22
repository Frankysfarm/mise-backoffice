'use client';

/**
 * FahrerZeugnisCard — Phase 432
 *
 * Zeigt dem Fahrer seine monatlichen Leistungszeugnisse.
 * Grade-Ring, KPI-Zusammenfassung, Score-Trend, Bewertungstext.
 * Sichtbar wenn mindestens ein Zeugnis vorhanden ist.
 * Integration: fahrer/app/client.tsx nach FahrerIncentiveWidget.
 */

import { useEffect, useState } from 'react';
import { Award, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type ScoreGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

interface ZeugnisData {
  schichtenAnzahl:    number;
  lieferungenGesamt:  number;
  puenktlichkeitsPct: number | null;
  compositeScore:     number | null;
  verdienstEur:       number | null;
  topZone:            string | null;
  scoreTrend:         number | null;
  scoreTrendPct:      number | null;
  avgDeliveryMin:     number | null;
  erzielteBoni:       number;
  bonusSummeEur:      number | null;
  highlights:         string[];
  bewertungstext:     string;
}

interface Zeugnis {
  id:         string;
  monat:      string;
  grade:      ScoreGrade;
  daten:      ZeugnisData;
  erstelltAm: string;
}

interface Props {
  driverId:   string;
  locationId: string;
}

const GRADE_RING: Record<ScoreGrade, string> = {
  'A+': 'text-violet-300 border-violet-400',
  'A':  'text-emerald-300 border-emerald-400',
  'B':  'text-sky-300 border-sky-400',
  'C':  'text-amber-300 border-amber-400',
  'D':  'text-rose-300 border-rose-400',
};

const GRADE_BG: Record<ScoreGrade, string> = {
  'A+': 'bg-violet-900/20',
  'A':  'bg-emerald-900/20',
  'B':  'bg-sky-900/20',
  'C':  'bg-amber-900/20',
  'D':  'bg-rose-900/20',
};

function MonatLabel({ monat }: { monat: string }) {
  const d = new Date(monat);
  return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function TrendBadge({ trend }: { trend: number | null }) {
  if (trend === null) return null;
  const abs = Math.abs(trend);
  if (abs < 0.5) return null;
  const up = trend > 0;
  return (
    <span className={cn(
      'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
      up ? 'bg-emerald-900/30 text-emerald-300' : 'bg-rose-900/30 text-rose-300',
    )}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{trend.toFixed(1)} Pkt.
    </span>
  );
}

export function FahrerZeugnisCard({ driverId, locationId }: Props) {
  const [zeugnisse, setZeugnisse] = useState<Zeugnis[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [open,      setOpen]      = useState(false);
  const [selected,  setSelected]  = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res  = await fetch(`/api/delivery/driver/fahrer-zeugnis?location_id=${locationId}&limit=6`);
        const json = await res.json() as { zeugnisse?: Zeugnis[] };
        setZeugnisse(json.zeugnisse ?? []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [driverId, locationId]);

  if (loading || zeugnisse.length === 0) return null;

  const z = zeugnisse[selected];
  if (!z) return null;
  const d = z.daten;

  return (
    <div className="rounded-2xl border border-white/10 bg-stone-900/60 shadow-lg">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Award className="h-5 w-5 text-violet-400" />
          <div>
            <p className="font-semibold text-white text-sm">Leistungszeugnis</p>
            <p className="text-xs text-stone-400">{MonatLabel({ monat: z.monat })}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(
            'rounded-xl border-2 px-3 py-1 text-lg font-black',
            GRADE_RING[z.grade],
            GRADE_BG[z.grade],
          )}>
            {z.grade}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-white/10 px-5 pb-5 pt-4 space-y-4">
          {/* Monat-Tabs wenn mehrere Zeugnisse */}
          {zeugnisse.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {zeugnisse.map((zz, i) => (
                <button
                  key={zz.id}
                  onClick={() => setSelected(i)}
                  className={cn(
                    'flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium',
                    i === selected
                      ? 'bg-violet-600 text-white'
                      : 'bg-stone-800 text-stone-400 hover:text-white',
                  )}
                >
                  {MonatLabel({ monat: zz.monat })}
                </button>
              ))}
            </div>
          )}

          {/* Grade-Ring + Score */}
          <div className="flex items-center gap-4">
            <div className={cn(
              'flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center rounded-2xl border-4',
              GRADE_RING[z.grade],
              GRADE_BG[z.grade],
            )}>
              <span className={cn('text-2xl font-black', GRADE_RING[z.grade])}>{z.grade}</span>
              {d.compositeScore != null && (
                <span className="text-[10px] text-stone-400 font-mono">{d.compositeScore.toFixed(1)}</span>
              )}
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <TrendBadge trend={d.scoreTrend} />
              </div>
              <p className="text-xs text-stone-300 leading-relaxed italic">{d.bewertungstext}</p>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Schichten',    value: String(d.schichtenAnzahl) },
              { label: 'Lieferungen',  value: String(d.lieferungenGesamt) },
              { label: 'Pünktlichkeit', value: d.puenktlichkeitsPct != null ? `${d.puenktlichkeitsPct.toFixed(1)} %` : '—' },
              { label: 'Ø Lieferzeit', value: d.avgDeliveryMin != null ? `${d.avgDeliveryMin.toFixed(0)} min` : '—' },
              { label: 'Verdienst',    value: d.verdienstEur != null ? `${d.verdienstEur.toFixed(2)} €` : '—' },
              { label: 'Top-Zone',     value: d.topZone ?? '—' },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-xl bg-stone-800/60 px-3 py-2">
                <p className="text-[10px] text-stone-500 uppercase tracking-wide">{kpi.label}</p>
                <p className="font-semibold text-white text-sm mt-0.5">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Boni */}
          {d.erzielteBoni > 0 && (
            <div className="rounded-xl bg-amber-900/20 border border-amber-500/30 px-4 py-2 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-300">
                {d.erzielteBoni} Incentive-Ziel{d.erzielteBoni > 1 ? 'e' : ''} erreicht
                {d.bonusSummeEur != null && ` · ${d.bonusSummeEur.toFixed(2)} € Bonus`}
              </p>
            </div>
          )}

          {/* Highlights */}
          {d.highlights.length > 0 && (
            <div className="space-y-1.5">
              {d.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-stone-300">
                  <span className="mt-0.5 text-violet-400 flex-shrink-0">•</span>
                  {h}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
