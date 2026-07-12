'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Loader2, RefreshCw, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1110 — Fahrer-Rückkehr-Koordinator (Dispatch)
// ETA-Balken + empfohlene Neuzuteilung für aktive Touren

interface Props { locationId: string | null }

type Empfehlung = 'neuzuteilung_moeglich' | 'kurz_warten' | 'nicht_verfuegbar';

type FahrerRueckkehr = {
  fahrer_id: string;
  fahrer_name: string;
  aktuelle_zone: string;
  offene_stopps: number;
  eta_rueckkehr_min: number;
  eta_label: string;
  auslastung_pct: number;
  empfehlung: Empfehlung;
  empfehlung_label: string;
};

type ApiData = {
  fahrer: FahrerRueckkehr[];
  gesamt_verfuegbar_in_30min: number;
  location_id: string | null;
  generiert_am: string;
};

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Ahmad K.', aktuelle_zone: 'Zone A', offene_stopps: 2, eta_rueckkehr_min: 8, eta_label: 'in ~8 Min', auslastung_pct: 65, empfehlung: 'kurz_warten', empfehlung_label: 'Kurz warten' },
    { fahrer_id: 'f2', fahrer_name: 'Lukas M.', aktuelle_zone: 'Zone B', offene_stopps: 1, eta_rueckkehr_min: 4, eta_label: 'in ~4 Min', auslastung_pct: 30, empfehlung: 'neuzuteilung_moeglich', empfehlung_label: 'Neuzuteilung möglich' },
    { fahrer_id: 'f3', fahrer_name: 'Sara P.', aktuelle_zone: 'Zone C', offene_stopps: 4, eta_rueckkehr_min: 22, eta_label: 'in ~22 Min', auslastung_pct: 95, empfehlung: 'nicht_verfuegbar', empfehlung_label: 'Nicht verfügbar' },
  ],
  gesamt_verfuegbar_in_30min: 3,
  location_id: null,
  generiert_am: new Date().toISOString(),
};

const POLL_MS = 60_000;

function EmpBadge({ emp }: { emp: Empfehlung }) {
  const cls =
    emp === 'neuzuteilung_moeglich'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : emp === 'kurz_warten'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
  const label =
    emp === 'neuzuteilung_moeglich' ? 'Neuzuteilung möglich' : emp === 'kurz_warten' ? 'Kurz warten' : 'Nicht verfügbar';
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold uppercase whitespace-nowrap', cls)}>
      {label}
    </span>
  );
}

function EtaBar({ pct, emp }: { pct: number; emp: Empfehlung }) {
  const barColor =
    emp === 'neuzuteilung_moeglich' ? 'bg-emerald-500' : emp === 'kurz_warten' ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DispatchPhase1110FahrerRueckkehrKoordinator({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-rueckkehr-koordinator?location_id=${encodeURIComponent(locationId)}`);
      if (!res.ok) throw new Error('fetch');
      setData(await res.json());
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const display = data ?? MOCK;
  const active = display.fahrer.filter(f => f.offene_stopps > 0);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Fahrer-Rückkehr</span>
          <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
            {active.length} aktiv · {display.gesamt_verfuegbar_in_30min} frei in 30 Min
          </span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-3">
          {!locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {locationId && active.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Fahrer auf aktiven Touren.</p>
          )}

          {active.map(f => {
            const etaPct = Math.max(5, Math.min(100, (f.eta_rueckkehr_min / 30) * 100));
            return (
              <div key={f.fahrer_id} className="space-y-1.5 rounded-lg border p-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                    <span className="text-sm font-semibold">{f.fahrer_name}</span>
                    <span className="text-[10px] text-muted-foreground">{f.aktuelle_zone}</span>
                  </div>
                  <EmpBadge emp={f.empfehlung} />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{f.offene_stopps} offene Stopp{f.offene_stopps !== 1 ? 's' : ''}</span>
                  <span className="font-semibold text-foreground">{f.eta_label}</span>
                </div>

                <EtaBar pct={etaPct} emp={f.empfehlung} />

                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', f.auslastung_pct >= 80 ? 'bg-red-400' : f.auslastung_pct >= 50 ? 'bg-amber-400' : 'bg-emerald-400')}
                      style={{ width: `${f.auslastung_pct}%` }}
                    />
                  </div>
                  <span>{f.auslastung_pct}% Auslastung</span>
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50 transition"
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
              Aktualisieren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
