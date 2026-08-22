'use client';

import { useEffect, useRef } from 'react';

export function PwaAudioListener() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    audioRef.current = new Audio('/ringtone.wav');
    audioRef.current.loop = true;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PLAY_ALARM') {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.warn('Audio play blocked:', e));
        }
      }
      if (event.data?.type === 'STOP_ALARM') {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    
    // Also stop alarm if the user clicks anywhere on the page
    const stopOnInteraction = () => {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
    window.addEventListener('click', stopOnInteraction);
    window.addEventListener('touchstart', stopOnInteraction);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      window.removeEventListener('click', stopOnInteraction);
      window.removeEventListener('touchstart', stopOnInteraction);
    };
  }, []);

  return null;
}
