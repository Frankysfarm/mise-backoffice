'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X, ShieldAlert } from 'lucide-react';
import jsQR from 'jsqr';

interface Props {
  open: boolean;
  onClose: () => void;
  onScan: (url: string) => void;
  expectedOrigin: string;
}

type Phase = 'requesting' | 'scanning' | 'denied' | 'unsupported' | 'error';

export function QRScanner({ open, onClose, onScan, expectedOrigin }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>('requesting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let stopped = false;
    setPhase('requesting');
    setErrorMsg(null);

    // Kamera-API verfügbar? (Wenn nicht: unsupported)
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('unsupported');
      return;
    }

    // BarcodeDetector als bevorzugte (native) Variante, jsQR als universeller Fallback
    const Detector = (globalThis as any).BarcodeDetector;
    let nativeDetector: any = null;
    if (Detector) {
      try {
        nativeDetector = new Detector({ formats: ['qr_code'] });
      } catch {
        nativeDetector = null;
      }
    }

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        setPhase('scanning');

        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setPhase('error');
          setErrorMsg('Canvas-Kontext nicht verfügbar');
          return;
        }

        const tick = async () => {
          if (stopped || !videoRef.current) return;
          const v = videoRef.current;
          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            try {
              if (nativeDetector) {
                const codes = await nativeDetector.detect(v);
                if (codes && codes.length > 0) {
                  if (tryAccept(String(codes[0].rawValue ?? ''))) return;
                }
              } else {
                // JS-Fallback via jsQR (läuft auf jedem iPhone/iPad)
                const w = v.videoWidth;
                const h = v.videoHeight;
                if (w > 0 && h > 0) {
                  if (canvas.width !== w) canvas.width = w;
                  if (canvas.height !== h) canvas.height = h;
                  ctx.drawImage(v, 0, 0, w, h);
                  const img = ctx.getImageData(0, 0, w, h);
                  const result = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
                  if (result?.data) {
                    if (tryAccept(result.data)) return;
                  }
                }
              }
            } catch {
              // transient errors — keep scanning
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };

        function tryAccept(raw: string): boolean {
          if (raw.startsWith(expectedOrigin) && raw.includes('/auth/qr-login')) {
            stopped = true;
            cleanup();
            onScan(raw);
            return true;
          }
          return false;
        }

        rafRef.current = requestAnimationFrame(tick);
      } catch (e: any) {
        if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError' || e?.name === 'PermissionDeniedError') {
          setPhase('denied');
        } else if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') {
          setPhase('error');
          setErrorMsg('Keine Kamera gefunden');
        } else {
          setPhase('error');
          setErrorMsg(e?.message ?? 'Kamera konnte nicht gestartet werden');
        }
      }
    })();

    return cleanup;

    function cleanup() {
      stopped = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  }, [open, expectedOrigin, onScan]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4">
      <div className="bg-white rounded-3xl border-2 border-zinc-900 max-w-md w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-display text-xl font-black">QR-Code scannen</h4>
            <p className="text-sm text-zinc-600 mt-1">
              Halte den QR-Code vom Backoffice-Bildschirm in die Kamera.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 h-9 w-9 rounded-full border-2 border-zinc-200 grid place-items-center hover:bg-zinc-50"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative aspect-square rounded-2xl bg-zinc-900 overflow-hidden border-2 border-zinc-200">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          {phase === 'scanning' && (
            <div className="pointer-events-none absolute inset-12 border-4 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          )}
          {phase !== 'scanning' && (
            <div className="absolute inset-0 grid place-items-center bg-zinc-50">
              <div className="text-center px-6">
                {phase === 'requesting' && (
                  <>
                    <Camera className="h-10 w-10 text-zinc-400 mx-auto mb-3" />
                    <p className="text-sm text-zinc-600">Kamera wird geöffnet…</p>
                  </>
                )}
                {phase === 'denied' && (
                  <>
                    <ShieldAlert className="h-10 w-10 text-amber-600 mx-auto mb-3" />
                    <p className="font-bold text-zinc-900">Kamera-Zugriff verweigert</p>
                    <p className="text-sm text-zinc-600 mt-2">
                      Einstellungen → Safari (bzw. Mise POS) → Kamera erlauben.
                    </p>
                  </>
                )}
                {phase === 'unsupported' && (
                  <>
                    <ShieldAlert className="h-10 w-10 text-zinc-400 mx-auto mb-3" />
                    <p className="font-bold text-zinc-900">Kamera nicht verfügbar</p>
                    <p className="text-sm text-zinc-600 mt-2">
                      Bitte über HTTPS aufrufen oder Email/Passwort manuell eingeben.
                    </p>
                  </>
                )}
                {phase === 'error' && (
                  <>
                    <ShieldAlert className="h-10 w-10 text-red-600 mx-auto mb-3" />
                    <p className="font-bold text-zinc-900">Fehler</p>
                    <p className="text-sm text-zinc-600 mt-2">{errorMsg}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-zinc-500 text-center">
          QR-Code wird automatisch erkannt — kein Klick nötig.
        </p>
      </div>
    </div>
  );
}
