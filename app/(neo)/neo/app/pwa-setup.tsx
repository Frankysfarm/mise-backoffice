'use client';
import { useEffect, useState } from 'react';

export function PwaSetup() {
  const [deferred, setDeferred] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Service Worker registrieren (network-first, vorhandene /sw.js)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    // Bereits installiert? → kein Banner
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (standalone) return;
    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e); setShow(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setDeferred(null); setShow(false);
  }
  if (!show) return null;
  return (
    <div style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 500, maxWidth: 420, margin: '0 auto', background: '#0F172A', color: '#fff', borderRadius: 14, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 12px 30px rgba(0,0,0,.3)' }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📲</div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700 }}>MAIS als App installieren</div><div style={{ fontSize: 12, color: '#CBD5E1' }}>Direkt vom Homescreen — Umsatz, Bestellungen & mehr.</div></div>
      <button onClick={install} style={{ height: 36, padding: '0 14px', borderRadius: 9, border: 'none', background: '#4F46E5', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>Installieren</button>
      <button onClick={() => setShow(false)} aria-label="Schließen" style={{ width: 30, height: 36, border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>×</button>
    </div>
  );
}
