'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { MiseOsScreen } from '@/lib/mise-os';
import { MISE_OS_SCREENS } from '@/lib/mise-os';

type LaunchState = 'connecting' | 'error';

export function MiseOsLaunchClient({ screen }: { screen: MiseOsScreen }) {
  const [state, setState] = useState<LaunchState>('connecting');
  const [message, setMessage] = useState('Neo verbindet deinen Zugang …');

  const launch = useCallback(async () => {
    setState('connecting');
    setMessage('Neo verbindet deinen Zugang …');
    try {
      const response = await fetch('/api/mise-os/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screen }),
        cache: 'no-store',
      });
      const data = await response.json() as { token?: string; appUrl?: string; error?: string };
      if (!response.ok || !data.token || !data.appUrl) {
        throw new Error(data.error ?? 'Verbindung fehlgeschlagen.');
      }

      const target = new URL('/office', data.appUrl);
      target.searchParams.set('neo', '1');
      target.searchParams.set('screen', screen);
      target.hash = new URLSearchParams({ sso: data.token }).toString();
      window.location.replace(target.toString());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Verbindung fehlgeschlagen.');
      setState('error');
    }
  }, [screen]);

  useEffect(() => { void launch(); }, [launch]);

  return (
    <main className="min-h-screen bg-[#0F0E0D] text-[#F2EDE3] grid place-items-center px-6 font-sans">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-11 w-11 rounded-2xl bg-[#E68A2C] text-[#0F0E0D] grid place-items-center font-black text-xl">m.</div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#807A70]">Neo · Betriebssystem</div>
            <h1 className="text-xl font-bold mt-1">{MISE_OS_SCREENS[screen]}</h1>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#171614] p-7 shadow-2xl shadow-black/30">
          <div className="h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className={state === 'connecting' ? 'mise-os-progress h-full w-1/2 rounded-full bg-[#E68A2C]' : 'h-full w-full rounded-full bg-[#B84A3A]'} />
          </div>
          <p className="mt-6 text-sm leading-6 text-[#B7B1A6]" role={state === 'error' ? 'alert' : 'status'}>{message}</p>

          {state === 'error' && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => void launch()} className="rounded-xl bg-[#E68A2C] px-4 py-2.5 text-sm font-bold text-[#0F0E0D] focus:outline-none focus:ring-2 focus:ring-[#E68A2C] focus:ring-offset-2 focus:ring-offset-[#171614]">
                Erneut verbinden
              </button>
              <Link href="/neo" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-[#F2EDE3] hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/40">
                Zurück zu Neo
              </Link>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes mise-os-slide { from { transform: translateX(-110%); } to { transform: translateX(210%); } }
        .mise-os-progress { animation: mise-os-slide 1.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .mise-os-progress { animation: none; width: 100%; } }
      `}</style>
    </main>
  );
}
