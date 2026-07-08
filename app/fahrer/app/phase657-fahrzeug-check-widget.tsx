'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Car, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  driverId: string;
}

type CheckStatus = 'ok' | 'mangel' | null;

interface FahrzeugCheck {
  reifen: CheckStatus;
  licht: CheckStatus;
  gepaeckraum: CheckStatus;
  spiegel: CheckStatus;
  bremsen: CheckStatus;
}

const FELDER: { key: keyof FahrzeugCheck; label: string }[] = [
  { key: 'reifen', label: 'Reifen' },
  { key: 'licht', label: 'Beleuchtung' },
  { key: 'gepaeckraum', label: 'Gepäckraum' },
  { key: 'spiegel', label: 'Spiegel' },
  { key: 'bremsen', label: 'Bremsen' },
];

const HEUTE_KEY = (driverId: string) => `fahrzeug-check-${driverId}-${new Date().toISOString().slice(0, 10)}`;

function StatusBtn({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CheckStatus;
  onChange: (v: CheckStatus) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-sm">{label}</span>
      <div className="flex gap-2">
        <button
          onClick={() => onChange('ok')}
          className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
            value === 'ok'
              ? 'bg-emerald-600 text-white'
              : 'border border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400'
          }`}
        >
          OK
        </button>
        <button
          onClick={() => onChange('mangel')}
          className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
            value === 'mangel'
              ? 'bg-red-600 text-white'
              : 'border border-red-300 text-red-700 dark:border-red-800 dark:text-red-400'
          }`}
        >
          Mangel
        </button>
      </div>
    </div>
  );
}

export function FahrerPhase657FahrzeugCheckWidget({ driverId }: Props) {
  const [open, setOpen] = useState(false);
  const [check, setCheck] = useState<FahrzeugCheck>({
    reifen: null,
    licht: null,
    gepaeckraum: null,
    spiegel: null,
    bremsen: null,
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HEUTE_KEY(driverId));
      if (stored) {
        const parsed = JSON.parse(stored) as { check: FahrzeugCheck; submitted: boolean };
        setCheck(parsed.check);
        setSubmitted(parsed.submitted);
      }
    } catch {
      // ignore
    }
  }, [driverId]);

  function setFeld(key: keyof FahrzeugCheck, val: CheckStatus) {
    setCheck((prev) => {
      const next = { ...prev, [key]: val };
      return next;
    });
  }

  const alleBeantwortet = FELDER.every((f) => check[f.key] !== null);
  const hasMangel = FELDER.some((f) => check[f.key] === 'mangel');

  function handleSubmit() {
    if (!alleBeantwortet) return;
    try {
      localStorage.setItem(
        HEUTE_KEY(driverId),
        JSON.stringify({ check, submitted: true }),
      );
    } catch {
      // ignore
    }
    setSubmitted(true);
    setOpen(false);
  }

  if (submitted) {
    return (
      <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 ${
        hasMangel
          ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20'
          : 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/10'
      }`}>
        {hasMangel ? (
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        )}
        <div>
          <p className={`text-xs font-semibold ${
            hasMangel ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
          }`}>
            Fahrzeug-Check heute abgeschlossen
          </p>
          <p className="text-[10px] text-muted-foreground">
            {hasMangel ? 'Mängel gemeldet — bitte Disponent informieren' : 'Alle Punkte OK'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-semibold">Fahrzeug-Check</span>
          <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
            heute noch offen
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-2">
          <p className="text-[11px] text-muted-foreground mb-3">
            Bitte täglich vor Schichtbeginn ausfüllen.
          </p>
          <div>
            {FELDER.map((f) => (
              <StatusBtn
                key={f.key}
                label={f.label}
                value={check[f.key]}
                onChange={(v) => setFeld(f.key, v)}
              />
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!alleBeantwortet}
            className="mt-4 w-full rounded-lg bg-slate-900 dark:bg-slate-100 py-2 text-sm font-semibold text-white dark:text-slate-900 disabled:opacity-40 transition"
          >
            Check abschließen
          </button>
        </div>
      )}
    </div>
  );
}
