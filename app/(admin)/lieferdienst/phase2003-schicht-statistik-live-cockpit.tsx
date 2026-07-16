'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  TrendingUp, Target, Clock, CheckCircle2, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';

type Prognose = {
  vergangene_stunden: number;
  gesamte_stunden: number;
  umsatz_bisher_eur: number;
  hochrechnung_eur: number;
  ziel_eur: number;
  bestellungen_bisher: number;
  hochrechnung_bestellungen: number;
  ziel_bestellungen: number;
};

const MOCK_DATA: Prognose = {
  vergangene_stunden: 4,
  gesamte_stunden: 8,
  umsatz_bisher_eur: 1620,
  hochrechnung_eur: 3240,
  ziel_eur: 3000,
  bestellungen_bisher: 54,
  hochrechnung_bestellungen: 108,
  ziel_bestellungen: 100,
};

export function LieferdienstPhase2003SchichtStatistikLiveCockpit({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [data, setData] = useState<Prognose | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!locationId) {
        setData(MOCK_DATA);
        setLoading(false);
        return;
      }
      fetch(`/api/delivery/admin/schicht-prognose?location_id=${encodeURIComponent(locationId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          if (d) setData(d);
          else setData(MOCK_DATA);
        })
        .catch(() => { if (!cancelled) setData(MOCK_DATA); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const fmtEur = (v: number) =>
    '€' + v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Schicht-Live-Cockpit
          </span>
          {!loading && data && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {Math.round((data.vergangene_stunden / data.gesamte_stunden) * 100)}% Schicht abgelaufen
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t p-4 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Schicht-Prognose…
            </div>
          ) : !data ? (
            <div className="text-sm text-muted-foreground">Keine Daten verfügbar.</div>
          ) : (() => {
            const schichtPct = Math.min(100, (data.vergangene_stunden / data.gesamte_stunden) * 100);
            const umsatzZielErreicht = data.hochrechnung_eur >= data.ziel_eur;
            const bestellungenZielErreicht = data.hochrechnung_bestellungen >= data.ziel_bestellungen;
            const faktor = data.vergangene_stunden > 0
              ? (data.gesamte_stunden / data.vergangene_stunden).toFixed(2)
              : '—';

            return (
              <>
                {/* Schicht-Fortschrittsbalken */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock size={12} />
                      <span>Schicht-Fortschritt</span>
                    </div>
                    <span className="font-bold tabular-nums">
                      {data.vergangene_stunden}h / {data.gesamte_stunden}h
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-matcha-500 transition-all"
                      style={{ width: `${schichtPct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Hochrechnungs-Faktor: ×{faktor}
                  </div>
                </div>

                {/* Umsatz-Prognose */}
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <Target size={13} className="text-matcha-600" />
                    Umsatz-Prognose
                  </div>
                  <div className="text-sm font-black tabular-nums">
                    {fmtEur(data.umsatz_bisher_eur)}{' '}
                    <span className="font-normal text-muted-foreground text-xs">
                      von {fmtEur(data.hochrechnung_eur)} prognostiziert
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        umsatzZielErreicht ? 'bg-matcha-500' : 'bg-amber-400',
                      )}
                      style={{ width: `${Math.min(100, (data.umsatz_bisher_eur / data.hochrechnung_eur) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {umsatzZielErreicht ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
                        <CheckCircle2 size={10} /> Ziel erreicht ({fmtEur(data.ziel_eur)})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        {fmtEur(data.ziel_eur - data.hochrechnung_eur)} bis Ziel
                      </span>
                    )}
                  </div>
                </div>

                {/* Bestellungen-Prognose */}
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <TrendingUp size={13} className="text-blue-600" />
                    Bestellungen-Prognose
                  </div>
                  <div className="text-sm font-black tabular-nums">
                    {data.bestellungen_bisher}{' '}
                    <span className="font-normal text-muted-foreground text-xs">
                      von {data.hochrechnung_bestellungen} prognostiziert
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        bestellungenZielErreicht ? 'bg-blue-500' : 'bg-amber-400',
                      )}
                      style={{ width: `${Math.min(100, (data.bestellungen_bisher / data.hochrechnung_bestellungen) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {bestellungenZielErreicht ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        <CheckCircle2 size={10} /> Ziel erreicht ({data.ziel_bestellungen})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        {data.ziel_bestellungen - data.hochrechnung_bestellungen} bis Ziel
                      </span>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
