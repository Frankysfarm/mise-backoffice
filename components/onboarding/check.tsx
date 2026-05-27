'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowRight, Calculator, Menu, ShoppingBag, Sparkles, Table, X, Zap } from 'lucide-react';

/**
 * Onboarding-Banner: bei Erstbesuch zeigt sich ein Overlay,
 * das den Nutzer durch die ersten Schritte führt.
 * "Mise-First-Time" wird im localStorage gespeichert.
 */
export function OnboardingCheck() {
  const router = useRouter();
  const pathname = usePathname();
  const [showOverlay, setShowOverlay] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Nicht auf Help-Seiten, /modules, /start etc. zeigen
    if (pathname.startsWith('/help') || pathname === '/modules' || pathname === '/start') return;
    const done = localStorage.getItem('mise_onboarding_done');
    if (!done) {
      // kleiner Delay, damit Page erst gerendert wird
      setTimeout(() => setShowOverlay(true), 1500);
    }
  }, [pathname]);

  function finish() {
    localStorage.setItem('mise_onboarding_done', '1');
    setShowOverlay(false);
  }

  function skip() {
    finish();
  }

  if (!showOverlay) return null;

  const steps = [
    {
      icon: <Sparkles className="h-8 w-8" />,
      title: 'Willkommen bei Mise! 👋',
      body: 'Das Betriebssystem für dein Restaurant. In 5 Minuten bist du startklar — Schritt für Schritt.',
      cta: 'Los geht\'s',
    },
    {
      icon: <Zap className="h-8 w-8" />,
      title: 'So funktioniert\'s',
      body: 'Du hast aktuell zwei Hauptmodule: Kasse (POS) und Lieferdienst. Weitere Module kommen bald. Du kannst jederzeit testen — 14 Tage gratis.',
      cta: 'Verstanden',
    },
    {
      icon: <Menu className="h-8 w-8" />,
      title: 'Erste Schritte',
      body: 'Klick oben links auf „Alle Module" und aktiviere „Kasse" — dann erscheint die komplette POS-Sidebar. Danach: Speisekarte laden, Tische anlegen, Kasse starten.',
      cta: 'Zu den Modulen',
      action: () => router.push('/modules'),
    },
    {
      icon: <Table className="h-8 w-8" />,
      title: 'Brauchst du Hilfe?',
      body: 'Unten rechts ist ein Mise-AI-Chat (Bot-Icon). Frag ihn alles auf Deutsch. Oder öffne die Dokumentation unter /help.',
      cta: 'Fertig',
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur grid place-items-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 relative">
        <button
          onClick={skip}
          className="absolute top-3 right-3 h-9 w-9 rounded-full hover:bg-muted grid place-items-center"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="h-14 w-14 rounded-2xl bg-matcha-900 text-matcha-50 grid place-items-center mb-4">
          {current.icon}
        </div>

        <h2 className="font-display text-2xl font-black">{current.title}</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{current.body}</p>

        {/* Progress */}
        <div className="mt-5 flex gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-matcha-900' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="h-11 px-4 rounded-xl border hover:bg-muted text-sm font-semibold"
            >
              Zurück
            </button>
          )}
          <button
            onClick={() => {
              if (current.action) current.action();
              if (isLast) finish();
              else setStep(step + 1);
            }}
            className="flex-1 h-11 rounded-xl bg-matcha-900 text-matcha-50 font-bold inline-flex items-center justify-center gap-2 hover:bg-matcha-800"
          >
            {current.cta}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <button onClick={skip} className="w-full text-center text-xs text-muted-foreground mt-3 hover:text-foreground">
          Überspringen
        </button>
      </div>
    </div>
  );
}
