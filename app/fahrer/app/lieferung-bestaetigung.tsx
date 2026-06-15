'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Camera, MapPin, Banknote, CreditCard, AlertTriangle, Phone, Loader2, X, Check } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type Stop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    gesamtbetrag: number;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
    kunde_telefon?: string | null;
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
  };
};

interface Props {
  stop: Stop;
  batchId: string;
  onConfirmed: () => void;
}

type Step = 'uebersicht' | 'zahlung' | 'foto' | 'bestaetigt';

export function LieferungBestaetigung({ stop, batchId, onConfirmed }: Props) {
  const [step, setStep] = useState<Step>('uebersicht');
  const [cashReceived, setCashReceived] = useState('');
  const [notesAck, setNotesAck] = useState(false);
  const [zahlungOk, setZahlungOk] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const o = stop.order;
  const needsCash = !o.bezahlt && (o.zahlungsart === 'bar' || o.zahlungsart === 'ec');
  const hasNotes = o.kunde_notiz || o.kunde_lieferhinweis;

  function handleConfirm() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/delivery/tours/${batchId}/proof`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stop_id: stop.id,
            confirmed_at: new Date().toISOString(),
            cash_amount: cashReceived ? parseFloat(cashReceived) : null,
          }),
        });
        if (!res.ok) throw new Error('Bestätigung fehlgeschlagen');
        setStep('bestaetigt');
        setTimeout(() => onConfirmed(), 1800);
      } catch (e) {
        setErrorMsg('Fehler beim Bestätigen. Nochmals versuchen?');
      }
    });
  }

  if (step === 'bestaetigt') {
    return (
      <div className="rounded-2xl bg-accent/10 border-2 border-accent/50 px-5 py-6 flex flex-col items-center gap-3 text-center">
        <div className="h-16 w-16 rounded-full bg-accent flex items-center justify-center animate-bounce">
          <CheckCircle2 className="h-8 w-8 text-matcha-900" />
        </div>
        <div className="font-black text-lg text-accent">Lieferung bestätigt!</div>
        <div className="text-sm text-matcha-300">{o.kunde_name} · #{o.bestellnummer.slice(-6)}</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-accent/10 border-b border-accent/20 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
          <MapPin className="h-4 w-4 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-sm text-matcha-50 truncate">{o.kunde_name}</div>
          <div className="text-[10px] text-matcha-400 truncate">
            {o.kunde_adresse}{o.kunde_plz ? `, ${o.kunde_plz}` : ''}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-black text-accent">{euro(o.gesamtbetrag)}</div>
          <div className="text-[9px] text-matcha-500">#{o.bestellnummer.slice(-6)}</div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Notizen — sofort sichtbar wenn vorhanden */}
        {hasNotes && (
          <button
            onClick={() => setNotesAck(v => !v)}
            className={cn(
              'w-full flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition',
              notesAck
                ? 'border-accent/40 bg-accent/10'
                : 'border-amber-400/30 bg-amber-400/10 animate-pulse',
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-[10px] font-black text-amber-300 uppercase tracking-wider mb-0.5">
                Hinweis gelesen? {notesAck ? '✓' : ''}
              </div>
              {o.kunde_notiz && <div className="text-xs text-amber-200">{o.kunde_notiz}</div>}
              {o.kunde_lieferhinweis && <div className="text-xs text-amber-200/80">{o.kunde_lieferhinweis}</div>}
            </div>
          </button>
        )}

        {/* Zahlung */}
        {needsCash && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 space-y-2">
            <div className="flex items-center gap-2">
              {o.zahlungsart === 'bar'
                ? <Banknote className="h-4 w-4 text-amber-400" />
                : <CreditCard className="h-4 w-4 text-blue-400" />
              }
              <span className="text-xs font-black text-matcha-200">
                {o.zahlungsart === 'bar' ? 'Barzahlung kassieren' : 'EC-Karte kassieren'}
              </span>
              <span className="ml-auto text-sm font-black text-accent">{euro(o.gesamtbetrag)}</span>
            </div>
            {o.zahlungsart === 'bar' && !zahlungOk && (
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Betrag erhalten"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  className="flex-1 h-9 rounded-lg bg-white/10 border border-white/10 px-3 text-sm text-matcha-100 placeholder:text-matcha-500 focus:outline-none focus:border-accent/50"
                  step="0.01"
                  min="0"
                />
                <button
                  onClick={() => setZahlungOk(true)}
                  disabled={!cashReceived || parseFloat(cashReceived) < o.gesamtbetrag}
                  className="h-9 px-4 rounded-lg bg-accent text-matcha-900 text-xs font-black disabled:opacity-40 transition active:scale-[0.97]"
                >
                  OK
                </button>
              </div>
            )}
            {(zahlungOk || o.zahlungsart === 'ec') && (
              <div className="flex items-center gap-1.5 text-xs text-accent font-bold">
                <Check className="h-3 w-3" />
                Zahlung bestätigt
                {cashReceived && o.zahlungsart === 'bar' && parseFloat(cashReceived) > o.gesamtbetrag && (
                  <span className="text-amber-400 ml-1">
                    Rückgeld: {euro(parseFloat(cashReceived) - o.gesamtbetrag)}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Telefon */}
        {o.kunde_telefon && (
          <a
            href={`tel:${o.kunde_telefon}`}
            className="flex items-center gap-2 text-xs text-matcha-400 hover:text-matcha-200 transition"
          >
            <Phone className="h-3 w-3" />
            {o.kunde_telefon} anrufen
          </a>
        )}

        {/* Fehler */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/20 border border-red-500/30 px-3 py-2">
            <X className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <span className="text-xs text-red-300">{errorMsg}</span>
          </div>
        )}

        {/* Bestätigen-Button */}
        <button
          onClick={handleConfirm}
          disabled={
            pending ||
            (hasNotes && !notesAck) ||
            (needsCash && o.zahlungsart === 'bar' && !zahlungOk) ||
            (needsCash && o.zahlungsart === 'ec' && !zahlungOk && o.zahlungsart !== 'bar')
          }
          className={cn(
            'w-full h-12 rounded-xl font-black text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2',
            'bg-accent text-matcha-900 disabled:opacity-40',
            pending && 'opacity-60',
          )}
        >
          {pending
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Bestätige…</>
            : <><CheckCircle2 className="h-4 w-4" /> Lieferung bestätigen</>
          }
        </button>

        {/* Helper-Hinweis für Notes-Check */}
        {hasNotes && !notesAck && (
          <p className="text-center text-[10px] text-matcha-500">
            Bitte zuerst den Hinweis oben lesen und bestätigen.
          </p>
        )}
      </div>
    </div>
  );
}
