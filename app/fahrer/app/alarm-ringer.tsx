'use client';

import { useEffect, useRef } from 'react';

/**
 * Klingel-Loop — klingelt DURCHGEHEND, solange eine Tour auf Annahme wartet.
 *
 * - Piept + vibriert alle 1,2s, solange es eine offene (pending_acceptance)
 *   oder frisch zugewiesene Tour gibt.
 * - Stoppt AUTOMATISCH, sobald die Tour angenommen/verschwunden ist
 *   (openBatchIds + assignedBatchId werden leer).
 * - KEIN 30-Sekunden-Limit. KEIN Stopp bei zufälligem Tap.
 * - iOS-Autoplay: AudioContext wird beim ersten User-Tap entsperrt,
 *   OHNE den Alarm zu stoppen.
 */
export function AlarmRinger({
  openBatchIds,
  assignedBatchId,
}: {
  openBatchIds: string[];
  assignedBatchId: string | null;
}) {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<any>(null);

  const pendingCount = openBatchIds.length + (assignedBatchId ? 1 : 0);
  const shouldRing = pendingCount > 0;

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
    if (shouldRing) start();
    else stop();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRing]);

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
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1320, now + 0.15);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.85, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.4);
    // zweiter, hoeherer Ton fuer mehr Durchdringung
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.frequency.setValueAtTime(1760, now + 0.18);
    gain2.gain.setValueAtTime(0.0001, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.85, now + 0.19);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc2.start(now + 0.18); osc2.stop(now + 0.55);
    if ('vibrate' in navigator) navigator.vibrate([500, 120, 500, 120, 500]);
  }

  function start() {
    if (intervalRef.current) return;
    beep();
    intervalRef.current = setInterval(beep, 700);
  }

  function stop() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  return null;
}
