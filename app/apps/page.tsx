/**
 * /apps — App-Auswahl-Landing
 *
 * Zeigt dem Mitarbeiter beim Öffnen der Native-App (Capacitor-WebView) zwei große
 * Buttons: POS oder Lieferstation. Kein Login (DEV-Modus für Pilot-Phase).
 */
import Link from 'next/link';
import { Truck, Monitor } from 'lucide-react';

export const dynamic = 'force-static';
export const metadata = { title: 'Mise · App-Auswahl' };

export default function AppsSelectPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="px-8 pt-14 pb-6 text-center">
        <div className="inline-flex items-baseline gap-1 text-3xl font-bold tracking-tight">
          Mise<span className="text-amber-400">.</span>
        </div>
        <p className="mt-3 text-zinc-400 text-sm">
          Wähle, womit du arbeitest
        </p>
      </header>

      <main className="flex-1 px-6 pb-12 flex items-center justify-center">
        <div className="w-full max-w-md space-y-4">
          <Link
            href="/pos/terminal-v5"
            className="group flex items-center gap-5 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-6 shadow-lg hover:shadow-2xl active:scale-[0.98] transition-all"
          >
            <div className="flex-shrink-0 grid place-items-center w-16 h-16 rounded-xl bg-white/15 backdrop-blur">
              <Monitor className="w-8 h-8 text-white" strokeWidth={2} />
            </div>
            <div className="flex-1 text-left">
              <div className="text-2xl font-bold text-white">POS</div>
              <div className="text-sm text-amber-100/90">Kasse · Tische · Counter</div>
            </div>
            <div className="text-white/60 text-2xl group-hover:translate-x-1 transition-transform">→</div>
          </Link>

          <Link
            href="/lieferdienst"
            className="group flex items-center gap-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 shadow-lg hover:shadow-2xl active:scale-[0.98] transition-all"
          >
            <div className="flex-shrink-0 grid place-items-center w-16 h-16 rounded-xl bg-white/15 backdrop-blur">
              <Truck className="w-8 h-8 text-white" strokeWidth={2} />
            </div>
            <div className="flex-1 text-left">
              <div className="text-2xl font-bold text-white">Lieferstation</div>
              <div className="text-sm text-emerald-100/90">Bestellungen · Fahrer · Karte</div>
            </div>
            <div className="text-white/60 text-2xl group-hover:translate-x-1 transition-transform">→</div>
          </Link>

          <div className="pt-6 text-center">
            <Link href="/driver" className="text-xs text-zinc-500 hover:text-zinc-300 underline">
              Fahrer-App öffnen
            </Link>
          </div>
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-[10px] uppercase tracking-wider text-zinc-600">
        DEV-Modus · ohne Login
      </footer>
    </div>
  );
}
