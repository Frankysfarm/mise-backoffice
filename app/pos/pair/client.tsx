'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Calculator, Check, Loader2 } from 'lucide-react';

/**
 * Tablet-Pairing-Flow:
 * 1. Tablet öffnet /pos/pair
 * 2. 6-stelliger Code wird eingegeben (vom Backoffice)
 * 3. Terminal-device_token wird in localStorage gespeichert
 * 4. Redirect zu /pos/terminal (das erkennt den Token und öffnet die Kasse)
 */
export function PairingClient() {
  const supabase = createClient();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Wenn bereits gepaart → direkt weiterleiten
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const existingToken = localStorage.getItem('mise_terminal_token');
    if (existingToken) {
      // Prüfen ob Token noch gültig
      (async () => {
        const { data } = await supabase.from('pos_terminals')
          .select('id, aktiv').eq('device_token', existingToken).maybeSingle();
        if (data?.aktiv) {
          window.location.href = '/pos/terminal';
        } else {
          localStorage.removeItem('mise_terminal_token');
        }
      })();
    }
  }, []);

  function handleDigit(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    setCode((prev) => prev.map((x, i) => i === idx ? digit : x));
    if (digit && idx < 5) {
      const next = document.getElementById(`pos-code-${idx + 1}`);
      next?.focus();
    }
    const filled = [...code];
    filled[idx] = digit;
    if (filled.every((x) => x)) {
      setTimeout(() => submit(filled.join('')), 100);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length > 0) {
      const arr = text.split('').concat(Array(6).fill('')).slice(0, 6);
      setCode(arr);
      e.preventDefault();
      if (text.length === 6) {
        setTimeout(() => submit(text), 100);
      }
    }
  }

  async function submit(codeStr: string) {
    setErr(null);
    setPending(true);
    try {
      const { data: terminal, error } = await supabase.from('pos_terminals')
        .select('id, device_token, register_id, name')
        .eq('pairing_code', codeStr)
        .maybeSingle();

      if (error || !terminal) {
        setErr('Code ungültig. Prüfe den Code im Backoffice.');
        setPending(false);
        return;
      }

      // Token speichern + Server-Update
      await supabase.from('pos_terminals').update({
        pairing_code: null,
        gepaart_am: new Date().toISOString(),
        letzter_kontakt: new Date().toISOString(),
      }).eq('id', terminal.id);

      localStorage.setItem('mise_terminal_token', terminal.device_token);
      localStorage.setItem('mise_terminal_name', terminal.name);

      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/pos/terminal';
      }, 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fehler');
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 text-white grid place-items-center p-6">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-matcha-600 grid place-items-center mb-4 animate-bounce">
            <Check className="h-10 w-10 text-white" />
          </div>
          <div className="font-display text-3xl font-black">Verbunden</div>
          <div className="text-sm text-white/60 mt-2">Starte Kasse…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 grid place-items-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-accent text-matcha-900 grid place-items-center mb-4">
            <Calculator className="h-8 w-8" />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">Kasse · Terminal</div>
          <h1 className="font-display text-4xl font-black mt-1">Verbinden</h1>
          <p className="text-white/70 mt-2">
            Gib den 6-stelligen Code ein, den du im Backoffice erzeugt hast.
          </p>
        </div>

        <div className="flex justify-center gap-2" onPaste={handlePaste}>
          {code.map((d, i) => (
            <input
              key={i}
              id={`pos-code-${i}`}
              value={d}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !d && i > 0) {
                  const prev = document.getElementById(`pos-code-${i - 1}`);
                  prev?.focus();
                }
              }}
              inputMode="numeric"
              maxLength={1}
              disabled={pending}
              className="h-20 w-16 rounded-2xl bg-white/10 border-2 border-white/20 text-white text-center font-display text-5xl font-black focus:outline-none focus:border-accent disabled:opacity-50"
            />
          ))}
        </div>

        {pending && (
          <div className="mt-6 text-center text-sm text-white/60 inline-flex items-center gap-2 justify-center w-full">
            <Loader2 className="h-4 w-4 animate-spin" /> Verbinde …
          </div>
        )}
        {err && (
          <div className="mt-6 text-center text-sm text-red-400 bg-red-900/30 rounded-xl p-3">
            {err}
          </div>
        )}

        <div className="mt-10 rounded-2xl bg-white/5 border border-white/10 p-4 text-xs text-white/70 text-center leading-relaxed">
          <strong>Wo finde ich den Code?</strong><br />
          Backoffice → Kasse → Kassen / Terminals → Tablet hinzufügen
        </div>
      </div>
    </div>
  );
}
