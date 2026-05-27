'use client';

import { useEffect, useState } from 'react';
import { Check, Download, Smartphone, Copy, AlertTriangle } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function FahrerInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [swOk, setSwOk] = useState(false);
  const [env, setEnv] = useState({ ios: false, android: false, safari: false, chrome: false });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/fahrer' })
        .then(() => setSwOk(true)).catch(() => setSwOk(false));
    }

    const onBefore = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', () => setInstalled(true));

    const ua = navigator.userAgent;
    const ios = /iP(hone|od|ad)/.test(ua) && !('MSStream' in window);
    const android = /Android/.test(ua);
    const safari = ios && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Mercury|GSA|Instagram|FBAN|FBAV|Line/.test(ua);
    const chrome = android && /Chrome\//.test(ua) && !/SamsungBrowser|EdgA|FxAn|DuckDuckGo/.test(ua);
    setEnv({ ios, android, safari, chrome });

    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', onBefore);
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setDeferred(null);
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText('https://mise-gastro.de/fahrer');
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    } catch {}
  }

  if (installed) {
    return (
      <div className="rounded-2xl border-2 border-accent bg-accent/10 p-6 text-center">
        <div className="h-14 w-14 mx-auto rounded-full bg-accent text-matcha-900 flex items-center justify-center mb-3">
          <Check size={28} />
        </div>
        <div className="font-display text-lg font-bold">Installiert!</div>
        <p className="text-sm text-matcha-200 mt-1">Öffne die App vom Homescreen-Icon.</p>
      </div>
    );
  }

  // iPhone ohne Safari → Bitte in Safari öffnen
  if (env.ios && !env.safari) {
    return (
      <div className="rounded-2xl border-2 border-amber-400 bg-amber-500/10 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-amber-400 text-matcha-900 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="font-display font-bold">Bitte in Safari öffnen</div>
            <div className="text-xs text-amber-200">Installation klappt auf iPhone nur mit Safari</div>
          </div>
        </div>
        <ol className="space-y-2 text-sm text-matcha-100 mb-4">
          <li className="flex items-start gap-2"><span className="font-mono text-accent font-bold">1.</span><span>Tippe unten auf „Link kopieren"</span></li>
          <li className="flex items-start gap-2"><span className="font-mono text-accent font-bold">2.</span><span>Öffne die <strong>Safari</strong>-App (blauer Kompass)</span></li>
          <li className="flex items-start gap-2"><span className="font-mono text-accent font-bold">3.</span><span>In Adresszeile tippen → Einfügen → Öffnen</span></li>
        </ol>
        <button onClick={copyUrl} className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent text-matcha-900 py-3 font-bold text-sm active:scale-[0.98]">
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? 'Link kopiert!' : 'mise-gastro.de/fahrer kopieren'}
        </button>
      </div>
    );
  }

  // Android ohne Chrome und kein Install-Prompt
  if (env.android && !env.chrome && !deferred) {
    return (
      <div className="rounded-2xl border-2 border-amber-400 bg-amber-500/10 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-amber-400 text-matcha-900 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="font-display font-bold">Öffne in Chrome</div>
            <div className="text-xs text-amber-200">Push + Installation gehen am besten mit Chrome</div>
          </div>
        </div>
        <ol className="space-y-2 text-sm text-matcha-100 mb-4">
          <li className="flex items-start gap-2"><span className="font-mono text-accent font-bold">1.</span><span>Tippe unten auf „Link kopieren"</span></li>
          <li className="flex items-start gap-2"><span className="font-mono text-accent font-bold">2.</span><span>Öffne <strong>Chrome</strong></span></li>
          <li className="flex items-start gap-2"><span className="font-mono text-accent font-bold">3.</span><span>Link einfügen → „App installieren" erscheint</span></li>
        </ol>
        <button onClick={copyUrl} className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent text-matcha-900 py-3 font-bold text-sm active:scale-[0.98]">
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? 'Link kopiert!' : 'Link kopieren'}
        </button>
      </div>
    );
  }

  // iPhone + Safari — große visuelle Anleitung mit Pfeilen
  if (env.ios && env.safari) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl bg-gradient-to-br from-accent to-amber-500 text-matcha-900 p-6 text-center shadow-2xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.3em] opacity-70">So installierst du</div>
          <div className="font-display text-2xl font-black mt-1 leading-tight">
            In 3 Schritten<br/>auf deinen Homescreen
          </div>
        </div>

        {/* Schritt 1 */}
        <div className="rounded-2xl bg-white/10 border-2 border-accent p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-2xl bg-accent text-matcha-900 grid place-items-center font-display font-black text-xl">1</div>
            <div className="flex-1">
              <div className="font-display font-black text-lg leading-tight">Teilen-Button tippen</div>
              <div className="text-xs text-matcha-200">Unten mittig in Safari</div>
            </div>
          </div>
          <div className="bg-matcha-700 rounded-xl p-3 flex items-center justify-center relative">
            <div className="text-xs text-matcha-200 mr-3">Safari-Leiste unten:</div>
            <div className="h-12 w-12 rounded-lg bg-white/20 grid place-items-center text-2xl animate-bounce">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
            </div>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent text-matcha-900 text-[10px] font-black px-2 py-0.5">DAS HIER ⤵</div>
          </div>
        </div>

        {/* Schritt 2 */}
        <div className="rounded-2xl bg-white/10 border-2 border-accent p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-2xl bg-accent text-matcha-900 grid place-items-center font-display font-black text-xl">2</div>
            <div className="flex-1">
              <div className="font-display font-black text-lg leading-tight">„Zum Home-Bildschirm"</div>
              <div className="text-xs text-matcha-200">Im Menü runterscrollen und antippen</div>
            </div>
          </div>
          <div className="bg-matcha-700 rounded-xl p-3 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 p-2 rounded bg-white/5 opacity-50">📋 Kopieren</div>
            <div className="flex items-center gap-2 p-2 rounded bg-white/5 opacity-50">🔖 Lesezeichen</div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-accent text-matcha-900 font-black border-2 border-white/50 animate-pulse">
              📱 Zum Home-Bildschirm
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-white/5 opacity-50">🖨 Drucken</div>
          </div>
        </div>

        {/* Schritt 3 */}
        <div className="rounded-2xl bg-white/10 border-2 border-accent p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-2xl bg-accent text-matcha-900 grid place-items-center font-display font-black text-xl">3</div>
            <div className="flex-1">
              <div className="font-display font-black text-lg leading-tight">„Hinzufügen" tippen</div>
              <div className="text-xs text-matcha-200">Oben rechts — fertig!</div>
            </div>
          </div>
          <div className="bg-matcha-700 rounded-xl p-3 flex items-center justify-between">
            <div className="text-xs text-matcha-300">Abbrechen</div>
            <div className="font-bold text-sm">Zum Home-Bildschirm</div>
            <div className="px-3 py-1.5 rounded-lg bg-accent text-matcha-900 text-xs font-black animate-pulse border-2 border-white">
              Hinzufügen →
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-accent/20 border border-accent/40 p-4 text-sm text-matcha-100 leading-relaxed">
          <strong className="text-accent">Tipp:</strong> Nach dem Hinzufügen erscheint ein <strong>Mise-Icon</strong> auf deinem Homescreen. Einfach antippen → App öffnet im Vollbild, wie eine echte App.
        </div>
      </div>
    );
  }

  // Chrome Android mit Install-Prompt
  if (deferred) {
    return (
      <button onClick={install} className="w-full flex items-center justify-center gap-2 rounded-2xl bg-accent text-matcha-900 py-4 font-display font-bold text-lg active:scale-[0.98] transition">
        <Download size={22} /> Jetzt installieren
      </button>
    );
  }

  // Desktop
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center">
          <Smartphone size={20} />
        </div>
        <div>
          <div className="font-display font-bold">Öffne auf deinem Handy</div>
          <p className="text-sm text-matcha-200 mt-0.5">Die App installierst du auf iPhone (Safari) oder Android (Chrome).</p>
        </div>
      </div>
      <button onClick={copyUrl} className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-white/10 text-white py-2.5 text-xs font-bold">
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'Link kopiert!' : 'Link kopieren für Handy'}
      </button>
      {swOk && <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-accent"><Check size={12} /> Offline-Modus aktiv</div>}
    </div>
  );
}
