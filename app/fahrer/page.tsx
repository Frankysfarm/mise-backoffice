import Link from 'next/link';
import { ArrowRight, Bell, Bike, MapPin, Smartphone } from 'lucide-react';
import { FahrerInstall } from './install';

export const dynamic = 'force-dynamic';

export default function FahrerPWAHome() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-16 pb-8 bg-gradient-to-br from-matcha-900 to-matcha-700">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-accent text-matcha-900 flex items-center justify-center">
              <Bike size={24} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-matcha-200">Mise</div>
              <div className="font-display text-xl font-bold">Fahrer</div>
            </div>
          </div>
          <h1 className="mt-8 font-display text-4xl font-bold tracking-tight leading-[0.95]">
            Deine Lieferungen.<br />
            <span className="text-accent">Direkt am Handgelenk.</span>
          </h1>
          <p className="mt-4 text-matcha-100 text-sm leading-relaxed">
            Installiere die App auf deinem Homescreen — Push-Notifications, Offline-Modus, direkt loslegen.
          </p>
        </div>
      </section>

      {/* Install-Flow */}
      <section className="flex-1 px-6 py-8 space-y-4">
        <FahrerInstall />

        {/* Features */}
        <div className="mt-8 space-y-3">
          <Feature
            icon={<MapPin size={20} />}
            title="Live-Navigation"
            body="Adresse, Etage, Türcode — alles in einem Blick. Route-optimiert bei mehreren Orders."
          />
          <Feature
            icon={<Bell size={20} />}
            title="Push bei neuer Order"
            body="Dein Handy piept, sobald eine Bestellung fertig ist. Kein ständiges Nachschauen."
          />
          <Feature
            icon={<Smartphone size={20} />}
            title="Auf dem Homescreen"
            body="Wie eine echte App. Ein Tap, du bist drin — auch offline verfügbar."
          />
        </div>

        {/* Login-Link */}
        <Link
          href="/fahrer/login"
          className="mt-8 flex items-center justify-center gap-2 rounded-2xl bg-accent text-matcha-900 py-4 font-display font-bold"
        >
          Als Fahrer einloggen <ArrowRight size={16} />
        </Link>

        <p className="text-xs text-matcha-300 text-center mt-4">
          Du bist schon Fahrer:in bei einem Restaurant mit Mise? Einfach einloggen.
        </p>
      </section>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white/5 border border-white/10 p-4">
      <div className="h-10 w-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="font-display font-bold">{title}</div>
        <p className="text-sm text-matcha-200 mt-0.5">{body}</p>
      </div>
    </div>
  );
}
