'use client';

import { useState } from 'react';
import { Phone, MessageSquare, Bell, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  kundenName?: string | null;
  kundenTelefon?: string | null;
  stoppNr?: number;
  onNotReached?: () => void;
};

type Status = 'idle' | 'angerufen' | 'nachricht_gesendet' | 'geklingelt' | 'nicht_erreicht';

export function FahrerPhase1071KundenKontaktSchnellPanelV2({
  kundenName,
  kundenTelefon,
  stoppNr,
  onNotReached,
}: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [saving, setSaving] = useState(false);

  const handleAnruf = () => {
    if (kundenTelefon) {
      window.location.href = `tel:${kundenTelefon}`;
      setStatus('angerufen');
    }
  };

  const handleNachricht = () => {
    if (kundenTelefon) {
      window.location.href = `sms:${kundenTelefon}?body=Ich+bin+gleich+bei+Ihnen.`;
      setStatus('nachricht_gesendet');
    }
  };

  const handleKlingeln = () => {
    setStatus('geklingelt');
  };

  const handleNichtErreicht = async () => {
    setSaving(true);
    try {
      await fetch('/api/delivery/driver/stopp-nicht-erreicht', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopp_nr: stoppNr }),
      });
    } catch {
      /* best-effort */
    } finally {
      setSaving(false);
      setStatus('nicht_erreicht');
      onNotReached?.();
    }
  };

  const name = kundenName ?? 'Kunde';
  const hasPhone = !!kundenTelefon;

  return (
    <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <Phone size={14} className="text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-bold text-blue-800 dark:text-blue-200 uppercase tracking-wider">
            Kunden-Kontakt — {name}
          </span>
        </div>
        {stoppNr != null && (
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
            Stopp {stoppNr}
          </span>
        )}
      </div>

      <div className="p-3 space-y-2">
        {status === 'nicht_erreicht' ? (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-3">
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
            <span className="text-xs font-bold text-red-700 dark:text-red-300">
              Nicht erreicht — Dispatch informiert
            </span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleAnruf}
                disabled={!hasPhone}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 border text-xs font-bold transition-all active:scale-95',
                  status === 'angerufen'
                    ? 'bg-blue-500 text-white border-blue-600'
                    : 'bg-white dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40',
                  !hasPhone && 'opacity-40 cursor-not-allowed',
                )}
              >
                {status === 'angerufen' ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <Phone size={18} />
                )}
                <span>{status === 'angerufen' ? 'Angerufen' : 'Anrufen'}</span>
              </button>

              <button
                onClick={handleNachricht}
                disabled={!hasPhone}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 border text-xs font-bold transition-all active:scale-95',
                  status === 'nachricht_gesendet'
                    ? 'bg-matcha-500 text-white border-matcha-600'
                    : 'bg-white dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40',
                  !hasPhone && 'opacity-40 cursor-not-allowed',
                )}
              >
                {status === 'nachricht_gesendet' ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <MessageSquare size={18} />
                )}
                <span>{status === 'nachricht_gesendet' ? 'Gesendet' : 'Nachricht'}</span>
              </button>

              <button
                onClick={handleKlingeln}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 border text-xs font-bold transition-all active:scale-95',
                  status === 'geklingelt'
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-white dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40',
                )}
              >
                {status === 'geklingelt' ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <Bell size={18} />
                )}
                <span>{status === 'geklingelt' ? 'Geklingelt' : 'Klingeln'}</span>
              </button>
            </div>

            {(status === 'angerufen' || status === 'nachricht_gesendet' || status === 'geklingelt') && (
              <button
                onClick={handleNichtErreicht}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-all active:scale-95 disabled:opacity-50"
              >
                <AlertTriangle size={12} />
                {saving ? 'Wird gemeldet…' : 'Nicht erreicht — Dispatch melden'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
