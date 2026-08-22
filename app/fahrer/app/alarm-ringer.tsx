'use client';

import { useEffect, useRef } from 'react';

/**
 * Kurzer Hinweis für externe Angebote.
 *
 * Interne Schichtfahrer erhalten Touren direkt und werden hier nie alarmiert.
 * Externe Angebote bekommen höchstens drei ruhige Hinweise; die Angebotskarte
 * bleibt sichtbar, ohne den Fahrer während der Fahrt zu einer Reaktion zu
 * zwingen.
 * - iOS-Autoplay: AudioContext wird beim ersten User-Tap entsperrt,
 *   OHNE den Alarm zu stoppen.
 */
export function AlarmRinger({ openBatchIds }: { openBatchIds: string[] }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<any>(null);

  const offerKey = openBatchIds.slice().sort().join(',');

  // AudioContext einmalig bei erster User-Interaktion entsperren (iOS-Autoplay-Policy).
  // Stoppt den Alarm NICHT — entsperrt nur den Ton.
  useEffect(() => {
    const unlock = () => {
      const Ctor: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctor && !ctxRef.current) ctxRef.current = new Ctor();
      ctxRef.current?.resume?.().catch(() => {});
    };
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('click', unlock);
    return () => {
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
    };
  }, []);

  useEffect(() => {
    if (offerKey) start();
    else stop();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerKey]);

  function ensureCtx() {
    if (!ctxRef.current) {
      const Ctor: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctor) ctxRef.current = new Ctor();
    }
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume().catch(() => {});
  }

  function beep() {
    ensureCtx();
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(880, now + 0.15);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.4);
    if ('vibrate' in navigator) navigator.vibrate([180, 100, 180]);
  }

  function start() {
    stop();
    let played = 1;
    beep();
    intervalRef.current = setInterval(() => {
      if (played >= 3) { stop(); return; }
      played += 1;
      beep();
    }, 8000);
  }

  function stop() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  return null;
}
