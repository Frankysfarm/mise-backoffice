'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe, Check } from 'lucide-react';

type Lang = { code: string; flag: string; label: string };

const LANGS: Lang[] = [
  { code: 'de',    flag: '🇩🇪', label: 'Deutsch' },
  { code: 'en',    flag: '🇬🇧', label: 'English' },
  { code: 'fr',    flag: '🇫🇷', label: 'Français' },
  { code: 'es',    flag: '🇪🇸', label: 'Español' },
  { code: 'it',    flag: '🇮🇹', label: 'Italiano' },
  { code: 'tr',    flag: '🇹🇷', label: 'Türkçe' },
  { code: 'nl',    flag: '🇳🇱', label: 'Nederlands' },
  { code: 'pl',    flag: '🇵🇱', label: 'Polski' },
  { code: 'pt',    flag: '🇵🇹', label: 'Português' },
  { code: 'ar',    flag: '🇸🇦', label: 'العربية' },
  { code: 'zh-CN', flag: '🇨🇳', label: '中文' },
  { code: 'ru',    flag: '🇷🇺', label: 'Русский' },
];

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: any;
  }
}

export function LangSwitcher({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>('de');
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Init Google Translate Widget (versteckt)
    if (!document.getElementById('gt-script')) {
      window.googleTranslateElementInit = () => {
        try {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: 'de',
              includedLanguages: LANGS.map((l) => l.code).join(','),
              autoDisplay: false,
              layout: 0,
            },
            'google_translate_element',
          );
          setReady(true);
        } catch {}
      };
      const s = document.createElement('script');
      s.id = 'gt-script';
      s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      s.async = true;
      document.body.appendChild(s);
    } else {
      setReady(true);
    }

    // Saved lang
    const saved = localStorage.getItem('mise_lang');
    if (saved) setCurrent(saved);

    // Close on outside click
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function pick(l: Lang) {
    localStorage.setItem('mise_lang', l.code);
    setCurrent(l.code);
    setOpen(false);

    if (l.code === 'de') {
      // Zurück zu Original: Cookie löschen + reload
      document.cookie = 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'googtrans=; path=/; domain=.mise-gastro.de; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      window.location.reload();
      return;
    }
    // Google-Translate-Cookie setzen: "/de/en" = quelle/ziel
    document.cookie = `googtrans=/de/${l.code}; path=/`;
    document.cookie = `googtrans=/de/${l.code}; path=/; domain=.mise-gastro.de`;
    window.location.reload();
  }

  const active = LANGS.find((l) => l.code === current) ?? LANGS[0];

  const btn = variant === 'dark'
    ? 'text-matcha-100 hover:text-white hover:bg-white/10'
    : 'text-matcha-900 hover:bg-matcha-900/5';

  return (
    <>
      {/* Versteckter Widget-Container */}
      <div id="google_translate_element" style={{ display: 'none' }} />

      <div ref={ref} className="relative notranslate" translate="no">
        <button
          onClick={() => setOpen(!open)}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-semibold ${btn}`}
          aria-label="Sprache wählen"
        >
          <Globe className="h-4 w-4" />
          <span className="text-base leading-none">{active.flag}</span>
          <span className="hidden sm:inline text-xs uppercase tracking-wider">{active.code.split('-')[0]}</span>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 p-1.5 z-[70] max-h-[70vh] overflow-y-auto">
            {LANGS.map((l) => {
              const isActive = l.code === current;
              return (
                <button
                  key={l.code}
                  onClick={() => pick(l)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${
                    isActive ? 'bg-matcha-50 text-matcha-900 font-bold' : 'hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  <span className="text-xl leading-none">{l.flag}</span>
                  <span className="flex-1">{l.label}</span>
                  {isActive && <Check className="h-4 w-4 text-matcha-700" />}
                </button>
              );
            })}
            <div className="px-3 py-2 border-t mt-1 text-[10px] text-gray-400 leading-snug">
              Nicht-DE via Google Translate · Beta
            </div>
          </div>
        )}
      </div>

      {/* Google-Translate CSS-Fixes: Banner oben entfernen */}
      <style jsx global>{`
        .goog-te-banner-frame.skiptranslate,
        .goog-te-gadget,
        #goog-gt-tt,
        .goog-te-balloon-frame { display: none !important; }
        body { top: 0 !important; }
        .goog-tooltip, .goog-tooltip:hover { display: none !important; }
        .goog-text-highlight { background-color: transparent !important; box-shadow: none !important; }
      `}</style>
    </>
  );
}
