'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Phone, MessageSquare, Bell, FileText } from 'lucide-react';

/**
 * Phase 994 — Kunden-Kontakt-Schnell-Panel (Fahrer-App)
 *
 * 1-Tap Anruf/SMS-Button + Klingelhinweis + Notiz-Anzeige
 * je aktivem Stopp. Statisch aus Props (Stopp-Daten vom Tour-State).
 */

interface Props {
  customerPhone?: string | null;
  customerName?: string | null;
  deliveryNote?: string | null;
  hasDoorbell?: boolean;
  floor?: string | null;
  className?: string;
}

export function FahrerPhase994KundenKontaktSchnellPanel({
  customerPhone,
  customerName,
  deliveryNote,
  hasDoorbell = true,
  floor,
  className,
}: Props) {
  const [called, setCalled] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [ringPressed, setRingPressed] = useState(false);

  const phone = customerPhone ?? '+49 151 00000000';
  const name = customerName ?? 'Kunde';

  const handleCall = () => {
    window.location.href = `tel:${phone.replace(/\s/g, '')}`;
    setCalled(true);
  };

  const handleSms = () => {
    const msg = encodeURIComponent(`Hallo ${name}, ich bin gleich bei Ihnen. Gruß, Ihr Fahrer`);
    window.location.href = `sms:${phone.replace(/\s/g, '')}?body=${msg}`;
    setSmsSent(true);
  };

  const handleRing = () => {
    setRingPressed(true);
    setTimeout(() => setRingPressed(false), 3000);
  };

  return (
    <div className={cn('rounded-xl border bg-card shadow-sm overflow-hidden', className)}>
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <Phone className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />
        <span className="font-bold text-sm">Kundenkontakt</span>
        <span className="ml-auto text-xs font-medium text-muted-foreground truncate max-w-[140px]">{name}</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleCall}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border p-3 transition active:scale-95',
              called
                ? 'bg-matcha-100 dark:bg-matcha-900/30 border-matcha-300 dark:border-matcha-700'
                : 'bg-matcha-50 dark:bg-matcha-900/20 border-matcha-200 dark:border-matcha-800 hover:bg-matcha-100',
            )}
          >
            <Phone className={cn('h-5 w-5', called ? 'text-matcha-700 dark:text-matcha-300' : 'text-matcha-600 dark:text-matcha-400')} />
            <span className="text-[11px] font-bold text-matcha-700 dark:text-matcha-300">Anrufen</span>
          </button>

          <button
            onClick={handleSms}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border p-3 transition active:scale-95',
              smsSent
                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100',
            )}
          >
            <MessageSquare className={cn('h-5 w-5', smsSent ? 'text-blue-700 dark:text-blue-300' : 'text-blue-600 dark:text-blue-400')} />
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">SMS</span>
          </button>

          <button
            onClick={handleRing}
            disabled={ringPressed}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border p-3 transition active:scale-95',
              ringPressed
                ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 animate-pulse'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:bg-amber-100',
            )}
          >
            <Bell className={cn('h-5 w-5', ringPressed ? 'text-amber-700 dark:text-amber-300 animate-bounce' : 'text-amber-600 dark:text-amber-400')} />
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
              {ringPressed ? 'Läutet…' : 'Klingeln'}
            </span>
          </button>
        </div>

        {/* Floor / delivery info */}
        {floor && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-[12px]">
            <span className="text-muted-foreground">Etage:</span>
            <span className="font-bold">{floor}</span>
          </div>
        )}

        {/* Delivery note */}
        {deliveryNote && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2">
            <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300 mb-0.5">Notiz</div>
              <div className="text-[12px] text-amber-800 dark:text-amber-200">{deliveryNote}</div>
            </div>
          </div>
        )}

        {/* Doorbell hint */}
        {!hasDoorbell && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-3 py-2 text-[12px]">
            <Bell className="h-4 w-4 text-red-500 shrink-0" />
            <span className="text-red-700 dark:text-red-300 font-medium">Kein Klingelknopf — bitte anklopfen</span>
          </div>
        )}

        {/* Phone display */}
        <div className="text-center text-[11px] text-muted-foreground tabular-nums">{phone}</div>
      </div>
    </div>
  );
}
