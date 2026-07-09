'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock, RefreshCw, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Phase 1045 — Fahrer-Schicht-Prognose-Board (Dispatch)
 *
 * Visualisiert wieviele Fahrer für die nächsten Schichten eingeplant sind
 * vs. Mindestbesetzung. 10-Minuten-Polling.
 */

interface Props {
  locationId: string | null;
}

interface FahrerSchicht {
  fahrer_id: string;
  fahrer_name: string;
  status: 'eingeplant' | 'bestaetigt' | 'ausstehend';
}

interface Schicht {
  id: string;
  label: string;
  zeitraum: string;
  start_iso: string;
  fahrer: FahrerSchicht[];
  eingeplant: number;
  bestaetigt: number;
  mindestbesetzung: number;
  ampel: 'gruen' | 'amber' | 'rot';
}

interface ApiResponse {
  schichten: Schicht[];
  location_id: string | null;
  generiert_am: string;
}

const POLL_MS = 10 * 60 * 1000;

const AMPEL_STYLE = {
  gruen: { bg: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500', text: 'text-emerald-700', label: 'OK' },
  amber: { bg: 'bg-amber-50',   border: 'border-amber-200',   bar: 'bg-amber-400',   text: 'text-amber-700',   label: 'Knapp' },
  rot:   { bg: 'bg-red-50',     border: 'border-red-200',     bar: 'bg-red-500',     text: 'text-red-700',     label: 'Kritisch' },
};

const STATUS_STYLE = {
  bestaetigt: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  eingeplant:  'bg-blue-100 text-blue-700 border-blue-200',
  ausstehend:  'bg-gray-100 text-gray-500 border-gray-200',
};

function AmpelDot({ ampel }: { ampel: Schicht['ampel'] }) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full shrink-0',
        ampel === 'gruen' ? 'bg-emerald-500' : ampel === 'amber' ? 'bg-amber-400 animate-pulse' : 'bg-red-500 animate-pulse',
      )}
    />
  );
}

function SchichtKarte({ schicht }: { schicht: Schicht }) {
  const [showFahrer, setShowFahrer] = useState(false);
  const s = AMPEL_STYLE[schicht.ampel];
  const fill = Math.min(1, schicht.eingeplant / schicht.mindestbesetzung);
  const fehlend = Math.max(0, schicht.mindestbesetzung - schicht.eingeplant);

  return (
    <div className={cn('rounded-lg border p-3 space-y-2', s.bg, s.border)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AmpelDot ampel={schicht.ampel} />
          <span className="text-sm font-bold">{schicht.label}</span>
          <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5 bg-white border', s.text, s.border)}>
            {s.label}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock size={10} />
          {schicht.zeitraum}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Besetzung</span>
          <span className={cn('font-bold', s.text)}>
            {schicht.eingeplant} / {schicht.mindestbesetzung} Fahrer
            {fehlend > 0 && <span className="ml-1 text-red-600">({fehlend} fehlt{fehlend > 1 ? 'en' : ''})</span>}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/70 overflow-hidden border border-gray-100">
          <div
            className={cn('h-full rounded-full transition-all', s.bar)}
            style={{ width: `${Math.round(fill * 100)}%` }}
          />
        </div>
      </div>

      {schicht.bestaetigt < schicht.eingeplant && (
        <p className="text-[11px] text-amber-700">
          ⚠ {schicht.eingeplant - schicht.bestaetigt} nicht bestätigt
        </p>
      )}

      {schicht.fahrer.length > 0 && (
        <button
          onClick={() => setShowFahrer(v => !v)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition"
        >
          <Users size={11} />
          Fahrerliste {showFahrer ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      )}

      {showFahrer && (
        <div className="space-y-1 pt-1">
          {schicht.fahrer.map(f => (
            <div key={f.fahrer_id} className="flex items-center justify-between text-[11px]">
              <span className="font-medium">{f.fahrer_name}</span>
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', STATUS_STYLE[f.status])}>
                {f.status === 'bestaetigt' ? '✓ Bestätigt' : f.status === 'eingeplant' ? 'Eingeplant' : 'Ausstehend'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DispatchPhase1045FahrerSchichtPrognoseBoard({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const url = locationId
          ? `/api/delivery/admin/fahrer-schicht-prognose?location_id=${locationId}`
          : '/api/delivery/admin/fahrer-schicht-prognose';
        const res = await fetch(url);
        if (res.ok) {
          const json: ApiResponse = await res.json();
          setData(json);
          setLastUpdate(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, [locationId]);

  const schichten = data?.schichten ?? [];
  const kritischCount = schichten.filter(s => s.ampel === 'rot').length;
  const amberCount = schichten.filter(s => s.ampel === 'amber').length;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-bold">Fahrer-Schicht-Prognose</span>
          {kritischCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 border border-red-300 animate-pulse">
              <AlertTriangle size={9} /> {kritischCount} Kritisch
            </span>
          )}
          {amberCount > 0 && kritischCount === 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {amberCount} Knapp
            </span>
          )}
          {kritischCount === 0 && amberCount === 0 && schichten.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <CheckCircle2 size={9} /> Alle besetzt
            </span>
          )}
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && <span className="text-[10px] text-muted-foreground">{lastUpdate}</span>}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {schichten.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground">Keine Schichtdaten verfügbar.</p>
          )}
          {schichten.map(s => <SchichtKarte key={s.id} schicht={s} />)}
        </div>
      )}
    </div>
  );
}
