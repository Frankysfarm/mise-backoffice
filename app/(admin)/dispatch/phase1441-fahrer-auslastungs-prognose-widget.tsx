'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, AlertTriangle, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Phase 1441 — Fahrer-Auslastungs-Prognose-Widget (Dispatch)
// Zeigt Phase1439-API: 4h-Balkendiagramm Fahrerbedarf + Engpass-Alarm + Handlungsempfehlung
// 15-Min-Polling

type AuslastungLevel = 'gering' | 'normal' | 'hoch' | 'peak';

interface PrognoseStunde {
  stunde_offset: number;
  stunde_label: string;
  erwartete_bestellungen: number;
  benoetigte_fahrer: number;
  verfuegbare_fahrer: number;
  delta: number;
  status: 'ausreichend' | 'knapp' | 'kritisch';
  auslastung_level: AuslastungLevel;
}

interface ApiResponse {
  prognose: PrognoseStunde[];
  aktuelle_queue: number;
  aktive_fahrer: number;
  empfehlung: string;
  location_id: string | null;
  generiert_am: string;
}

interface Props {
  locationId?: string | null;
}

const LEVEL_COLOR: Record<AuslastungLevel, string> = {
  gering: 'bg-slate-300 dark:bg-slate-600',
  normal: 'bg-matcha-400 dark:bg-matcha-500',
  hoch:   'bg-amber-400 dark:bg-amber-500',
  peak:   'bg-red-500 dark:bg-red-600',
};

const LEVEL_LABEL: Record<AuslastungLevel, string> = {
  gering: 'Gering',
  normal: 'Normal',
  hoch:   'Hoch',
  peak:   'Peak',
};

const STATUS_BADGE: Record<PrognoseStunde['status'], { cls: string; label: string }> = {
  ausreichend: { cls: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300', label: 'OK' },
  knapp:       { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',   label: 'Knapp' },
  kritisch:    { cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',           label: 'Kritisch' },
};

const MOCK: ApiResponse = {
  prognose: [
    { stunde_offset: 1, stunde_label: '18:00', erwartete_bestellungen: 18, benoetigte_fahrer: 5, verfuegbare_fahrer: 4, delta: -1, status: 'knapp', auslastung_level: 'hoch' },
    { stunde_offset: 2, stunde_label: '19:00', erwartete_bestellungen: 22, benoetigte_fahrer: 6, verfuegbare_fahrer: 4, delta: -2, status: 'kritisch', auslastung_level: 'peak' },
    { stunde_offset: 3, stunde_label: '20:00', erwartete_bestellungen: 15, benoetigte_fahrer: 4, verfuegbare_fahrer: 4, delta: 0, status: 'ausreichend', auslastung_level: 'normal' },
    { stunde_offset: 4, stunde_label: '21:00', erwartete_bestellungen: 8,  benoetigte_fahrer: 2, verfuegbare_fahrer: 4, delta: 2, status: 'ausreichend', auslastung_level: 'gering' },
  ],
  aktuelle_queue: 6,
  aktive_fahrer: 4,
  empfehlung: 'In Stunde +2 werden 2 zusätzliche Fahrer benötigt — jetzt einplanen.',
  location_id: null,
  generiert_am: new Date().toISOString(),
};

export function DispatchPhase1441FahrerAuslastungsPrognoseWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetch_ = useCallback(() => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/fahrer-auslastungs-prognose?location_id=${locationId}`)
      .then(r => r.json())
      .then((d: ApiResponse) => { setData(d); setLastUpdate(new Date()); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    fetch_();
    const iv = setInterval(fetch_, 15 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetch_]);

  const maxBenoetigte = Math.max(...data.prognose.map(p => p.benoetigte_fahrer), 1);
  const engpasse = data.prognose.filter(p => p.status !== 'ausreichend');
  const hatKritisch = engpasse.some(p => p.status === 'kritisch');

  return (
    <Card className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Fahrer-Prognose 4h</span>
        {loading && <RefreshCw className="w-3 h-3 animate-spin text-slate-400 ml-auto" />}
        {!loading && lastUpdate && (
          <span className="text-[10px] text-slate-400 ml-auto">
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">
          <div className="text-lg font-black tabular-nums text-slate-800 dark:text-slate-100">{data.aktive_fahrer}</div>
          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><Users className="w-3 h-3" /> aktive Fahrer</div>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">
          <div className="text-lg font-black tabular-nums text-slate-800 dark:text-slate-100">{data.aktuelle_queue}</div>
          <div className="text-[10px] text-slate-500">offene Bestellungen</div>
        </div>
      </div>

      {/* Balkendiagramm */}
      <div className="space-y-2">
        {data.prognose.map(p => {
          const balkenBreite = Math.round((p.benoetigte_fahrer / maxBenoetigte) * 100);
          const sb = STATUS_BADGE[p.status];
          return (
            <div key={p.stunde_offset} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300 w-12 shrink-0">{p.stunde_label}</span>
                <div className="flex-1 relative h-5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-500', LEVEL_COLOR[p.auslastung_level])}
                    style={{ width: `${balkenBreite}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 drop-shadow-sm">
                      {p.benoetigte_fahrer} Fahrer · {p.erwartete_bestellungen} Best.
                    </span>
                  </div>
                </div>
                <span className={cn('shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full', sb.cls)}>
                  {sb.label}
                </span>
              </div>
              <div className="flex items-center gap-2 pl-14">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', LEVEL_COLOR[p.auslastung_level].replace('bg-', 'text-').replace('-400', '-700').replace('-500', '-700').replace('-600', '-700'), 'bg-opacity-20')}>
                  {LEVEL_LABEL[p.auslastung_level]}
                </span>
                {p.delta < 0 && (
                  <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3" /> {Math.abs(p.delta)} Fahrer fehlen
                  </span>
                )}
                {p.delta >= 0 && (
                  <span className="text-[10px] text-matcha-600 dark:text-matcha-400 font-semibold flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> +{p.delta} Reserve
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Engpass-Alarm */}
      {engpasse.length > 0 && (
        <div className={cn(
          'flex items-start gap-2 rounded-lg border px-3 py-2',
          hatKritisch ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30' : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30',
        )}>
          <AlertTriangle className={cn('w-4 h-4 shrink-0 mt-0.5', hatKritisch ? 'text-red-500' : 'text-amber-500')} />
          <div>
            <div className={cn('text-xs font-bold', hatKritisch ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400')}>
              {hatKritisch ? 'Engpass Kritisch' : 'Engpass Erwartet'}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">{data.empfehlung}</div>
          </div>
        </div>
      )}

      {/* Legende */}
      <div className="flex items-center gap-3 flex-wrap">
        {(Object.entries(LEVEL_LABEL) as [AuslastungLevel, string][]).map(([level, label]) => (
          <div key={level} className="flex items-center gap-1">
            <div className={cn('w-2.5 h-2.5 rounded-sm', LEVEL_COLOR[level])} />
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      {!locationId && (
        <p className="text-[10px] text-slate-400 text-center">Demo-Daten — location_id fehlt</p>
      )}
    </Card>
  );
}
