import type { Metadata, Viewport } from 'next';
import { BUILD_VERSION } from './build-version';
import { PwaAudioListener } from './pwa-audio-listener';

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
      <PwaAudioListener />
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
          /* Light & Clean Premium Branding: Airy background, soft white surfaces, crisp dark text */
          --accent:#248A3D; --accent-press:#1D7131; --on-accent:#FFFFFF; --accent-tint:#E9F4EC;
          --bg:#F7F7F9; --surface:#FFFFFF; --surface-2:#F0F0F2;
          --ink:#111111; --ink-2:#666666; --ink-3:#999999;
          --line:#E5E5E5; --line-2:#D4D4D4;
          --danger:#E52B12; --danger-tint:#FCECE9; --warn:#FFC043; --warn-tint:#FFF9E6;
          background:var(--bg); color:var(--ink);
          font-family:'Hanken Grotesk',-apple-system,system-ui,sans-serif; letter-spacing:-0.01em;
        }
        .drive .bg-white { background: var(--surface) !important; }
        .drive iframe { color-scheme: light; }
        /* Dark mode fallback, falls das Handy dunkel eingestellt ist, aber clean gehalten */
        .drive.drive-dark {
          --accent:#248A3D; --accent-press:#1D7131; --on-accent:#FFFFFF; --accent-tint:#08220F;
          --bg:#0A0A0A; --surface:#141414; --surface-2:#222222;
          --ink:#FFFFFF; --ink-2:#A3A3A3; --ink-3:#737373;
          --line:#2E2E2E; --line-2:#3B3B3B;
          --danger:#FF453A; --danger-tint:#330A04; --warn:#FFD60A; --warn-tint:#332A02;
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
        @keyframes drv-pulse { 0% { box-shadow: 0 0 0 0 var(--accent); opacity: .7; } 70% { box-shadow: 0 0 0 45px transparent; opacity: 0; } 100% { opacity: 0; } }
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
