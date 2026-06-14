'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { LineChart, Square } from 'lucide-react';

export function AiForecastClient({ locationId }: { locationId: string }) {
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);

  const start = async () => {
    const ac = new AbortController();
    setController(ac);
    setOutput('');
    setDone(false);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/delivery/admin/ai-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? 'Fehler beim Starten der Prognose');
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setError('Kein Stream'); setLoading(false); return; }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') { setDone(true); break; }
          const text = data.replace(/\\n/g, '\n');
          setOutput(prev => prev + text);
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message ?? 'Unbekannter Fehler');
      }
    } finally {
      setLoading(false);
      setController(null);
    }
  };

  const stop = () => {
    controller?.abort();
    setLoading(false);
    setDone(true);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <LineChart className="h-5 w-5 text-blue-700" />
          <span className="font-display font-bold">KI-Nachfrage-Prognose</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Nutzt historische Bestelldaten, Wochentag, Uhrzeit und saisonale Muster,
          um Nachfrage-Peaks und Fahrerbedarf für die nächsten Stunden vorherzusagen.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={start}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-blue-700 bg-blue-700 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-800 transition disabled:opacity-50"
          >
            <LineChart className="h-4 w-4" />
            {loading ? 'Berechnet…' : 'Prognose generieren'}
          </button>
          {loading && (
            <button onClick={stop} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition">
              <Square className="h-3.5 w-3.5" /> Stoppen
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">{error}</div>
      )}

      {(output || loading) && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <div className={cn('h-2 w-2 rounded-full', loading ? 'bg-blue-500 animate-pulse' : done ? 'bg-matcha-700' : 'bg-muted')} />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {loading ? 'Generiert…' : done ? 'Prognose fertig' : 'Bereit'}
            </span>
          </div>
          <div className="px-4 py-4">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground">
              {output}
              {loading && <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5 align-middle" />}
            </pre>
          </div>
        </div>
      )}

      {done && output && (
        <div className="text-xs text-muted-foreground text-center">
          Prognose abgeschlossen · Basiert auf historischen Daten dieser Location
        </div>
      )}
    </div>
  );
}
