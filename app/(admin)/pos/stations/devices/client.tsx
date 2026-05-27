'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Check, Copy, ExternalLink, Link2, Loader2, Monitor, Trash2, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

type Device = {
  id: string;
  device_token: string;
  station_id: string;
  name: string | null;
  gepaart_am: string | null;
  letzter_kontakt: string | null;
  aktiv: boolean;
  station: { name: string; icon: string | null; farbe: string | null } | null;
};

export function DevicesManager({
  initialDevices, stations,
}: {
  initialDevices: Device[];
  stations: { id: string; name: string }[];
}) {
  const supabase = createClient();
  const [devices, setDevices] = useState(initialDevices);
  const [codeInput, setCodeInput] = useState(['', '', '', '', '', '']);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleDigit(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    setCodeInput((prev) => prev.map((x, i) => i === idx ? digit : x));
    if (digit && idx < 5) {
      const next = document.getElementById(`code-${idx + 1}`);
      next?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length > 0) {
      const arr = text.split('').concat(Array(6).fill('')).slice(0, 6);
      setCodeInput(arr);
      e.preventDefault();
      if (text.length === 6) {
        setTimeout(() => submit(text), 50);
      }
    }
  }

  function submit(code: string) {
    startTransition(async () => {
      const { data, error } = await supabase.rpc('confirm_kds_pairing', { p_code: code });
      if (error || !(data as any)?.ok) {
        setStatus({ ok: false, msg: (data as any)?.error ?? error?.message ?? 'Fehler' });
        return;
      }
      setStatus({ ok: true, msg: 'Display verbunden!' });
      setCodeInput(['', '', '', '', '', '']);
      const { data: d } = await supabase.from('kitchen_display_devices')
        .select('*, station:kitchen_stations(name, icon, farbe)')
        .eq('id', (data as any).device_id).single();
      if (d) setDevices((xs) => [d as any, ...xs]);
    });
  }

  const filled = codeInput.every((x) => x);
  const codeStr = codeInput.join('');

  async function unpair(id: string) {
    if (!confirm('Display wirklich entkoppeln? Muss dann neu verbunden werden.')) return;
    await supabase.from('kitchen_display_devices').delete().eq('id', id);
    setDevices((xs) => xs.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Code-Eingabe */}
      <Card className="p-6">
        <div className="text-center mb-4">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gray-900 text-white grid place-items-center mb-3">
            <Link2 className="h-7 w-7" />
          </div>
          <h3 className="font-display text-xl font-black">Display verbinden</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Gib den 6-stelligen Code ein, der auf dem Küchen-Tablet angezeigt wird.
          </p>
        </div>

        <div className="flex justify-center gap-2" onPaste={handlePaste}>
          {codeInput.map((d, i) => (
            <input
              key={i}
              id={`code-${i}`}
              value={d}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !d && i > 0) {
                  const prev = document.getElementById(`code-${i - 1}`);
                  prev?.focus();
                }
                if (e.key === 'Enter' && filled) submit(codeStr);
              }}
              inputMode="numeric"
              maxLength={1}
              className="h-16 w-12 sm:h-20 sm:w-16 rounded-xl border-2 bg-white text-center font-display text-3xl sm:text-4xl font-black focus:outline-none focus:border-gray-900 transition"
            />
          ))}
        </div>

        <button
          onClick={() => submit(codeStr)}
          disabled={!filled || pending}
          className="mt-5 w-full h-12 rounded-xl bg-gray-900 text-white font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Verbinden
        </button>

        {status && (
          <div className={cn(
            'mt-3 text-center text-sm font-semibold px-3 py-2 rounded-xl',
            status.ok ? 'bg-matcha-50 text-matcha-900' : 'bg-red-50 text-red-900',
          )}>
            {status.msg}
          </div>
        )}

        <div className="mt-6 pt-4 border-t text-xs text-muted-foreground text-center">
          <strong className="text-foreground">So startest du ein neues Display:</strong><br />
          Am Küchen-Tablet öffnen: <code className="bg-gray-100 px-2 py-0.5 rounded font-mono text-[11px]">
            {typeof window !== 'undefined' ? window.location.origin : ''}/kitchen/pair
          </code>
        </div>
      </Card>

      {/* Verbundene Displays */}
      {devices.length > 0 && (
        <section>
          <h3 className="font-display text-lg font-bold mb-3">Verbundene Displays ({devices.length})</h3>
          <div className="space-y-3">
            {devices.map((d) => (
              <Card key={d.id} className="p-4 flex items-center gap-4">
                <div
                  className="h-12 w-12 rounded-xl grid place-items-center text-2xl shrink-0"
                  style={{ background: d.station?.farbe ?? '#14532d', color: 'white' }}
                >
                  {d.station?.icon ?? '👨‍🍳'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold">
                    {d.name ?? `KDS · ${d.station?.name ?? 'Station'}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Station: <strong>{d.station?.name}</strong>
                    {d.gepaart_am && <> · seit {new Date(d.gepaart_am).toLocaleDateString('de-DE')}</>}
                    {d.letzter_kontakt && <> · letzter Kontakt: {new Date(d.letzter_kontakt).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })}</>}
                  </div>
                </div>
                <a
                  href={`/kitchen/device/${d.device_token}`}
                  target="_blank"
                  className="h-9 px-3 rounded-lg bg-matcha-900 text-matcha-50 hover:bg-matcha-800 text-xs font-bold inline-flex items-center gap-1.5"
                  title="Display öffnen"
                >
                  <Monitor className="h-3.5 w-3.5" /> Öffnen <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  onClick={() => unpair(d.id)}
                  className="h-9 w-9 rounded-lg hover:bg-red-50 hover:text-red-700 text-muted-foreground grid place-items-center"
                  title="Entkoppeln"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
