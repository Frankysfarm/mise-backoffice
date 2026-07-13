'use client';

import { useState } from 'react';
import { CheckCircle2, FileText, Loader2, WifiOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1403 — Schicht-Notiz (Fahrer-App)
 *
 * Erlaubt dem Fahrer, am Ende der Schicht eine kurze Notiz zu hinterlassen:
 *   • Vorlagen-Buttons: Stau, Baustelle, Parkproblem, Alles OK
 *   • Freitext (max 280 Zeichen)
 *   • POST /api/driver-app/schicht-notiz (best-effort)
 *   • isOnline-Guard, localStorage-Fallback
 *
 * Nach Phase1398 in fahrer/app/client.tsx einbinden.
 */

interface Props {
  driverId: string;
  isOnline: boolean;
}

const VORLAGEN = [
  'Alles OK',
  'Stau auf der Route',
  'Baustelle behindert Zufahrt',
  'Parkplatzprobleme',
  'Fahrzeug-Hinweis: Reifendruck niedrig',
];

export function FahrerPhase1403SchichtNotiz({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleVorlage = (v: string) => {
    setText((prev) => prev ? `${prev}; ${v}` : v);
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const payload = { driver_id: driverId, notiz: text.trim(), timestamp: new Date().toISOString() };
      if (isOnline) {
        await fetch('/api/driver-app/schicht-notiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        try {
          const pending = JSON.parse(localStorage.getItem('pending_schicht_notiz') ?? '[]') as unknown[];
          pending.push(payload);
          localStorage.setItem('pending_schicht_notiz', JSON.stringify(pending));
        } catch {}
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false);
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20 px-4 py-3 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
        <div>
          <div className="font-semibold text-sm text-green-700 dark:text-green-300">Schicht-Notiz gespeichert</div>
          <div className="text-xs text-muted-foreground truncate max-w-[220px]">{text}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <FileText className="h-4 w-4 text-violet-500" />
        <span className="font-semibold text-sm">Schicht-Notiz</span>
        {text && <span className="ml-1 text-xs text-muted-foreground truncate max-w-[120px]">{text}</span>}
        <span className="ml-auto text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!isOnline && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <WifiOff className="h-3.5 w-3.5 shrink-0" />
              Offline — Notiz wird lokal gespeichert
            </div>
          )}

          {/* Vorlagen */}
          <div className="flex flex-wrap gap-1.5">
            {VORLAGEN.map((v) => (
              <button
                key={v}
                onClick={() => handleVorlage(v)}
                className="rounded-full border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 px-2.5 py-1 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
              >
                {v}
              </button>
            ))}
          </div>

          {/* Freitext */}
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 280))}
              placeholder="Eigene Notiz eingeben…"
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            {text && (
              <button
                onClick={() => setText('')}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="text-right text-xs text-muted-foreground mt-0.5">{text.length}/280</div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors',
              'bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white disabled:opacity-50'
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Notiz speichern
          </button>
        </div>
      )}
    </div>
  );
}
