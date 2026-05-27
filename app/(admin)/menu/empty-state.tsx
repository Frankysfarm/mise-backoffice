'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { seedDemoMenu } from './seed';

export function EmptyMenuState() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    startTransition(async () => {
      const res = await seedDemoMenu();
      if (!res.ok) {
        setError(res.error ?? 'Fehler beim Laden.');
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-8 text-center bg-gradient-to-br from-matcha-50/60 to-amber-50/40 border-matcha-200">
      <div className="mx-auto h-16 w-16 rounded-3xl bg-matcha-900 text-matcha-50 flex items-center justify-center mb-4">
        <Sparkles className="h-7 w-7" />
      </div>
      <h3 className="font-display text-2xl font-bold mb-2">Dein Menü ist noch leer</h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        Leg direkt los und lade unser <strong>Beispiel-Menü mit 14 Produkten</strong> —
        Matcha, Kaffee, Frühstück, Süßes. Inklusive Bildern, Extras und Cross-Sells.
        Alles nachträglich änderbar.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <a
          href="/menu/import"
          className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-matcha-900 text-matcha-50 font-bold hover:bg-matcha-800 shadow-lg shadow-matcha-900/20"
        >
          <Sparkles className="h-4 w-4" />
          Mit KI hochladen (Foto/Sprache/Text)
        </a>
        <button
          onClick={load}
          disabled={pending}
          className="inline-flex items-center gap-2 h-12 px-6 rounded-xl border-2 border-matcha-200 bg-white text-matcha-900 font-medium hover:bg-matcha-50 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {pending ? 'Lade Menü…' : 'Beispiel-Menü laden'}
        </button>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2 inline-block">
          {error}
        </div>
      )}

      <div className="mt-6 text-xs text-muted-foreground">
        Tipp: Du kannst jederzeit eigene Kategorien und Produkte ergänzen.
      </div>
    </Card>
  );
}
