import Link from 'next/link';
import { ArrowRight, Bell, Bike, MapPin, Smartphone } from 'lucide-react';
import { FahrerInstall } from './install';
import { BUILD_VERSION } from './build-version';

export const dynamic = 'force-dynamic';

export default function FahrerPWAHome() {
  return (
    <div className="min-h-screen bg-[#F4F6F2] text-[#102218] flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-matcha-900 via-matcha-800 to-matcha-700 text-white">
        <div className="pointer-events-none absolute -top-24 right-[-4rem] h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-6 pb-12 pt-16 sm:px-10 sm:pb-16 sm:pt-20">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#B7DDC7] text-matcha-900 flex items-center justify-center">
              <Bike size={24} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-matcha-200">Mise</div>
              <div className="font-display text-xl font-bold text-white">Fahrer</div>
            </div>
          </div>
          <h1 className="mt-10 max-w-3xl font-display text-4xl font-bold tracking-tight leading-[0.98] text-white sm:text-6xl">
            Deine Lieferungen.<br />
            <span className="text-[#B7DDC7]">Direkt am Handgelenk.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-matcha-100 text-base leading-relaxed sm:text-lg">
            Installiere die App auf deinem Homescreen — Push-Notifications, Offline-Modus, direkt loslegen.
          </p>
        </div>
      </section>

      {/* Install-Flow */}
      <section className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 sm:px-10 sm:py-12">
        <div className="driver-install rounded-[1.75rem] bg-matcha-900 p-4 text-white shadow-strong sm:p-6">
          <FahrerInstall />
        </div>

        {/* Features */}
        <div className="mt-8 grid gap-3 md:grid-cols-3">
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
          className="mt-8 flex items-center justify-center gap-2 rounded-2xl bg-[#1F7A35] py-4 font-display font-bold text-white shadow-soft transition hover:bg-[#185F29] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#86C3A2] focus-visible:ring-offset-2"
        >
          Als Fahrer einloggen <ArrowRight size={16} />
        </Link>

        <p className="mt-4 text-center text-xs text-[#52685B]">
          Du bist schon Fahrer:in bei einem Restaurant mit Mise? Einfach einloggen.
        </p>
        <p className="mt-8 text-center font-mono text-[10px] text-[#6A7A70]">v {BUILD_VERSION}</p>
      </section>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#DDE5DF] bg-white p-4 shadow-subtle">
      <div className="h-10 w-10 rounded-xl bg-[#E9F4EC] text-[#1F7A35] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="font-display font-bold">{title}</div>
        <p className="mt-1 text-sm leading-relaxed text-[#52685B]">{body}</p>
      </div>
    </div>
  );
}
