'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

export function UpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'SW_UPDATED') setUpdateReady(true);
    };
    navigator.serviceWorker.addEventListener('message', handler);

    // Waiting-SW: wenn es einen gibt, ist Update bereit
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) setUpdateReady(true);
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      });
    });

    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  function reload() {
    // Neuen SW aktivieren + Seite neu laden
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(() => window.location.reload(), 100);
    });
  }

  if (!updateReady) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] p-3 bg-accent text-matcha-900 border-b-2 border-matcha-900 shadow-lg animate-slide-down">
      <div className="flex items-center gap-3 max-w-md mx-auto">
        <Sparkles className="h-5 w-5 shrink-0" />
        <div className="flex-1 text-sm font-bold leading-tight">
          Neue Version verfügbar — App neu starten?
        </div>
        <button
          onClick={reload}
          className="h-9 px-3 rounded-lg bg-matcha-900 text-accent text-xs font-bold inline-flex items-center gap-1.5"
        >
          <RefreshCw size={14} /> Starten
        </button>
      </div>
      <style jsx>{`
        @keyframes slide-down { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        .animate-slide-down { animation: slide-down 0.4s cubic-bezier(.17,.67,.3,1.01); }
      `}</style>
    </div>
  );
}
