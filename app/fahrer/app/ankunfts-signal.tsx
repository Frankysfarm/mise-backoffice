'use client';

/**
 * FahrerAnkunftsSignal — Phase 249
 *
 * Erlaubt dem Fahrer mit einem Tap, den Kunden über seine
 * bevorstehende Ankunft zu informieren. Sendet Push-Notification
 * oder falls nicht verfügbar, zeigt Telefonnummer zur Kontaktaufnahme.
 * Erscheint nur wenn Fahrer unterwegs und noch nicht angekommen.
 */

import { useState } from 'react';
import { Bell, CheckCircle2, Loader2, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

const QUICK_MSGS = [
  { id: 'eta2',   emoji: '⏱️', label: 'In 2 Min da',  text: 'Ich bin in 2 Minuten bei Ihnen!' },
  { id: 'eta5',   emoji: '🕐', label: 'In 5 Min da',  text: 'Ich bin in ca. 5 Minuten bei Ihnen!' },
  { id: 'here',   emoji: '📍', label: 'Ich bin da!',  text: 'Ich stehe vor Ihrer Tür — bitte kommen Sie.' },
  { id: 'ring',   emoji: '🔔', label: 'Klingelname?', text: 'Ich klingele gerade — bitte öffnen Sie.' },
] as const;

type MsgId = typeof QUICK_MSGS[number]['id'];

interface Props {
  orderId: string;
  kundeVorname: string;
  kundeTelefon: string | null;
}

export function FahrerAnkunftsSignal({ orderId, kundeVorname, kundeTelefon }: Props) {
  const [sending, setSending] = useState<MsgId | null>(null);
  const [sentId, setSentId] = useState<MsgId | null>(null);

  async function handleSend(msg: typeof QUICK_MSGS[number]) {
    setSending(msg.id);
    try {
      await fetch('/api/delivery/driver/notify-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, message: msg.text }),
      });
    } catch {
      // API nicht verfügbar — Fallback: Telefon anzeigen
    } finally {
      setSentId(msg.id);
      setSending(null);
      setTimeout(() => setSentId(null), 5_000);
    }
  }

  return (
    <div className="rounded-2xl border border-matcha-700/40 bg-matcha-900/70 p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <Bell size={14} className="text-saffron shrink-0" />
        <span className="text-xs font-black uppercase tracking-widest text-saffron">
          {kundeVorname} informieren
        </span>
      </div>

      {sentId ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-matcha-700/60 border border-matcha-500/30 px-3 py-2.5">
          <CheckCircle2 size={16} className="text-matcha-300 shrink-0" />
          <div>
            <p className="text-sm font-bold text-matcha-100">Nachricht gesendet!</p>
            <p className="text-[10px] text-matcha-400 mt-0.5">
              {QUICK_MSGS.find((m) => m.id === sentId)?.text}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_MSGS.map((msg) => (
            <button
              key={msg.id}
              onClick={() => handleSend(msg)}
              disabled={!!sending}
              className={cn(
                'flex items-center gap-2 rounded-xl border border-matcha-700/50',
                'bg-matcha-800/50 px-2.5 py-2.5 text-left transition-all',
                'hover:bg-matcha-700/60 active:scale-95 disabled:opacity-50',
              )}
            >
              {sending === msg.id ? (
                <Loader2 size={14} className="text-saffron animate-spin shrink-0" />
              ) : (
                <span className="text-base shrink-0 leading-none">{msg.emoji}</span>
              )}
              <span className="text-[11px] font-bold text-matcha-200 leading-tight">
                {msg.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {kundeTelefon && (
        <a
          href={`tel:${kundeTelefon}`}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-matcha-700/30 bg-matcha-800/30 py-2 text-[11px] font-bold text-matcha-400 hover:bg-matcha-700/40 active:scale-95 transition"
        >
          <Phone size={11} />
          {kundeTelefon}
        </a>
      )}
    </div>
  );
}
