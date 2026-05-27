'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Klingel-Loop — piept NUR wenn eine NEUE Tour reinkommt.
 * - Trackt welche Batch-IDs schon "gesehen" wurden (localStorage)
 * - Spielt Ton alle 1s für max 30 Sekunden pro neuer Tour
 * - User-Tap irgendwo = stoppt sofort
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
  const timeoutRef = useRef<any>(null);
  const [isRinging, setIsRinging] = useState(false);

  // Was ist "neu"? Alles was nicht in seenIds ist.
  const allCurrentIds = [...openBatchIds, ...(assignedBatchId ? [assignedBatchId] : [])];

  useEffect(() => {
    const seen: string[] = JSON.parse(localStorage.getItem('mise_seen_batches') ?? '[]');
    const newOnes = allCurrentIds.filter((id) => !seen.includes(id));

    if (newOnes.length === 0) {
      stop();
      return;
    }

    start();
    // Nach 30s auto-stop (auch wenn nicht weggetippt)
    timeoutRef.current = setTimeout(() => {
      markAllSeen();
      stop();
    }, 30_000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCurrentIds.join(',')]);

  // Stop alarm wenn User irgendwo hintappt/klickt
  useEffect(() => {
    if (!isRinging) return;
    const stopper = () => { markAllSeen(); stop(); };
    window.addEventListener('touchstart', stopper, { once: true, passive: true });
    window.addEventListener('click', stopper, { once: true });
    return () => {
      window.removeEventListener('touchstart', stopper);
      window.removeEventListener('click', stopper);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRinging]);

  // Cleanup wenn alle Batches weg sind
  useEffect(() => {
    if (allCurrentIds.length === 0) {
      // Alle assignments gelöst → seen zurücksetzen
      localStorage.setItem('mise_seen_batches', '[]');
    } else {
      // Nur noch aktuelle IDs in seen behalten
      const seen: string[] = JSON.parse(localStorage.getItem('mise_seen_batches') ?? '[]');
      const keep = seen.filter((id) => allCurrentIds.includes(id));
      localStorage.setItem('mise_seen_batches', JSON.stringify(keep));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCurrentIds.join(',')]);

  function markAllSeen() {
    localStorage.setItem('mise_seen_batches', JSON.stringify(allCurrentIds));
  }

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
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1320, now + 0.15);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.start(now); osc.stop(now + 0.4);
    if ('vibrate' in navigator) navigator.vibrate([150, 50, 150]);
  }

  function start() {
    if (intervalRef.current) return;
    setIsRinging(true);
    beep();
    intervalRef.current = setInterval(beep, 1000);
  }

  function stop() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    setIsRinging(false);
  }

  return null;
}
