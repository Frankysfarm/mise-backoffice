import type { Metadata, Viewport } from 'next';
import { BUILD_VERSION } from './build-version';

export const metadata: Metadata = {
  title: 'Mise Fahrer',
  description: 'Deine Fahrer-App für Mise',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mise Fahrer',
  },
  icons: {
    apple: [{ url: '/fahrer-icon-192.png' }],
    shortcut: '/fahrer-icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0C100E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

/* Drive-Design (Wald) — helle Farbwelt, Logik bleibt unveraendert */
export default function FahrerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap"
      />
      <div className="drive min-h-screen">{children}</div>
      <div className="mono" style={{ position: 'fixed', bottom: 3, right: 6, zIndex: 9999, fontSize: 9, lineHeight: 1, color: 'var(--ink-3)', opacity: 0.5, pointerEvents: 'none' }}>v {BUILD_VERSION}</div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .drive {
          /* Dark-first: die Fahrer-App ist eine Nacht-und-Tag-Arbeitsmaschine wie Uber Driver —
             dunkle Flächen immer, Grün als einziges lautes Signal. */
          --accent:#2FBF6B; --accent-press:#27A65C; --on-accent:#08130C; --accent-tint:#14301F;
          --bg:#0C100E; --surface:#161B18; --surface-2:#1D2320;
          --ink:#F0F4F1; --ink-2:#ADB7B1; --ink-3:#7C867F;
          --line:#293029; --line-2:#22282A;
          --danger:#F26D72; --danger-tint:#3A1D1F; --warn:#F0A33B; --warn-tint:#37290F;
          background:var(--bg); color:var(--ink);
          font-family:'Hanken Grotesk',-apple-system,system-ui,sans-serif; letter-spacing:-0.01em;
        }
        .drive .bg-white { background: var(--surface) !important; }
        .drive iframe { color-scheme: light; }
        /* Nachtmodus für Fahrten nach Sonnenuntergang — gleiche Hierarchie, dunkle Flächen,
           Akzent einen Tick heller für Kontrast auf dunklem Grund. */
        .drive.drive-dark {
          --accent:#2FBF6B; --accent-press:#27A65C; --on-accent:#08130C; --accent-tint:#14301F;
          --bg:#0E1210; --surface:#171C19; --surface-2:#1E2420;
          --ink:#F0F4F1; --ink-2:#ADB7B1; --ink-3:#7C867F;
          --line:#2A312C; --line-2:#232925;
          --danger:#F26D72; --danger-tint:#3A1D1F; --warn:#F0A33B; --warn-tint:#37290F;
        }
        .drive.drive-dark .bg-white { background: var(--surface) !important; }
        .drive .mono { font-family:'JetBrains Mono',ui-monospace,monospace; letter-spacing:-0.02em; }
        .drive button { font-family: inherit; cursor: pointer; }
        .drive .scroll { overflow-y: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .drive .scroll::-webkit-scrollbar { display: none; }
        .drive .press { transition: transform .12s ease, opacity .12s ease, background .15s ease; }
        .drive .press:active { transform: scale(0.97); }
        .drive .tap { transition: opacity .12s ease, background .15s ease; }
        .drive .tap:active { opacity: 0.6; }
        @keyframes drv-pop { 0% { transform: scale(0); } 60% { transform: scale(1.12); } 100% { transform: scale(1); } }
        @keyframes drv-sheet-in { from { transform: translateY(40px); } to { transform: translateY(0); } }
        @keyframes drv-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes drv-spin { to { transform: rotate(360deg); } }
        @keyframes drv-pulse { 0% { box-shadow: 0 0 0 0 var(--accent); opacity: .55; } 70% { box-shadow: 0 0 0 22px transparent; opacity: 0; } 100% { opacity: 0; } }
        @keyframes drv-slide-up { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes drv-ring { 0%,100% { transform: rotate(-8deg); } 25% { transform: rotate(8deg); } 50% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
        .drive .ring-anim { animation: drv-ring 1s ease-in-out infinite; transform-origin: 50% 15%; }
        .drv-sheet-in { animation: drv-sheet-in .34s cubic-bezier(.2,.8,.2,1); }
        .drv-fade-in { animation: drv-fade-in .25s ease; }
      `,
        }}
      />
    </>
  );
}
