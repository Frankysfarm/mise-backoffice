'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Sparkles, Loader2, Check } from 'lucide-react';

export function SeedTestButton() {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [count, setCount] = useState(5);

  async function run() {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc('seed_test_orders', { p_count: count });
    setBusy(false);
    if (error) { setMsg('Fehler: ' + error.message); return; }
    const res = data as any;
    if (!res?.ok) { setMsg(res?.error ?? 'Unbekannter Fehler'); return; }
    setMsg(`✓ ${res.created} Test-Bestellungen angelegt. Auto-Dispatch läuft.`);
    setTimeout(() => setMsg(null), 5000);
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-accent/20 grid place-items-center shrink-0">
          <Sparkles className="h-5 w-5 text-matcha-900" />
        </div>
        <div className="flex-1">
          <div className="font-display font-bold text-sm">Smart-Dispatch testen</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Zufällige Lieferungen 0.5–12 km um deinen Standort. System weist passende Fahrzeuge zu.
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number" min={1} max={20}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value))))}
              className="w-14 h-9 rounded-lg border bg-white px-2 text-sm text-center font-bold"
            />
            <button
              onClick={run}
              disabled={busy}
              className="h-9 px-4 rounded-lg bg-matcha-900 text-matcha-50 text-xs font-bold inline-flex items-center gap-2 hover:bg-matcha-800 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Test-Orders erzeugen
            </button>
            {msg && (
              <span className={msg.startsWith('✓') ? 'text-xs text-matcha-700 inline-flex items-center gap-1' : 'text-xs text-red-600'}>
                {msg.startsWith('✓') && <Check className="h-3 w-3" />}
                {msg}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
