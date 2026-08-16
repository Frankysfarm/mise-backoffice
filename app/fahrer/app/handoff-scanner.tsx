'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Keyboard, ScanLine, ShieldAlert, X } from 'lucide-react';
import jsQR from 'jsqr';

type ScanResult = {
  ok: true;
  scanned_orders: number;
  total_orders: number;
  scanned_bags: number[];
  required_bags: number;
  handoff_ready: boolean;
};

type Props = {
  open: boolean;
  batchId: string;
  accessToken: string | null;
  onClose: () => void;
  onUpdated: (result: ScanResult) => void | Promise<void>;
};

type CameraPhase = 'requesting' | 'scanning' | 'denied' | 'unsupported' | 'error';

export function HandoffScanner({ open, batchId, accessToken, onClose, onUpdated }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const lastValueRef = useRef<{ value: string; at: number } | null>(null);
  const [phase, setPhase] = useState<CameraPhase>('requesting');
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const submit = useCallback(async (value: string) => {
    const clean = value.trim();
    if (!clean || processingRef.current) return;
    const previous = lastValueRef.current;
    if (previous?.value === clean && Date.now() - previous.at < 2500) return;
    processingRef.current = true;
    lastValueRef.current = { value: clean, at: Date.now() };
    setMessage('Code wird geprüft …');
    try {
      const response = await fetch(`/api/driver/v1/batch/${encodeURIComponent(batchId)}/handoff/scan`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ value: clean }),
      });
      const result = await response.json() as ScanResult & { error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'Code konnte nicht bestätigt werden');
      setProgress({ done: result.scanned_orders, total: result.total_orders });
      setMessage(result.handoff_ready
        ? 'Übergabe vollständig. Die Tour ist abfahrbereit.'
        : `Beutel bestätigt · ${result.scanned_orders}/${result.total_orders} Bestellungen vollständig`);
      setManual('');
      await onUpdated(result);
      if (result.handoff_ready) window.setTimeout(onClose, 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Code konnte nicht bestätigt werden');
    } finally {
      window.setTimeout(() => { processingRef.current = false; }, 650);
    }
  }, [accessToken, batchId, onClose, onUpdated]);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    setPhase('requesting');
    setMessage(null);
    setProgress(null);
    lastValueRef.current = null;
    processingRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('unsupported');
      return;
    }

    const Detector = (globalThis as unknown as { BarcodeDetector?: new (config: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    let detector: { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } | null = null;
    try { detector = Detector ? new Detector({ formats: ['qr_code'] }) : null; } catch { detector = null; }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (stopped) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setPhase('scanning');

        const tick = async () => {
          if (stopped || !videoRef.current) return;
          const source = videoRef.current;
          if (source.readyState >= source.HAVE_CURRENT_DATA && !processingRef.current) {
            try {
              if (detector) {
                const codes = await detector.detect(source);
                if (codes[0]?.rawValue) void submit(codes[0].rawValue);
              } else if (context && source.videoWidth > 0 && source.videoHeight > 0) {
                canvas.width = source.videoWidth;
                canvas.height = source.videoHeight;
                context.drawImage(source, 0, 0, canvas.width, canvas.height);
                const image = context.getImageData(0, 0, canvas.width, canvas.height);
                const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
                if (result?.data) void submit(result.data);
              }
            } catch { /* transient camera frame; continue */ }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (error) {
        const name = error instanceof DOMException ? error.name : '';
        if (['NotAllowedError', 'SecurityError', 'PermissionDeniedError'].includes(name)) setPhase('denied');
        else { setPhase('error'); setMessage('Kamera konnte nicht gestartet werden'); }
      }
    })();

    return () => {
      stopped = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open, submit]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Beutel-Übergabe scannen" style={{ position: 'fixed', inset: 0, zIndex: 250, background: '#07100df2', color: '#f5fbf7', overflowY: 'auto' }}>
      <div style={{ width: 'min(520px, 100%)', minHeight: '100%', margin: '0 auto', padding: 'max(18px, env(safe-area-inset-top)) 18px max(24px, env(safe-area-inset-bottom))' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ color: '#7be7aa', fontSize: 12, fontWeight: 900, letterSpacing: '.14em', textTransform: 'uppercase' }}>Sichere Übergabe</div>
            <h2 style={{ margin: '4px 0 0', fontSize: 28, lineHeight: 1.05, letterSpacing: '-.03em' }}>Jeden Beutel scannen</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Scanner schließen" style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid #345044', background: '#13231c', color: '#fff', display: 'grid', placeItems: 'center' }}><X size={21} /></button>
        </header>

        <div style={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: 28, background: '#111b17', border: '1px solid #2d483b', boxShadow: '0 22px 70px #0008' }}>
          <video ref={videoRef} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          {phase === 'scanning' && <div style={{ position: 'absolute', inset: '15%', border: '3px solid #8ff0b7', borderRadius: 24, boxShadow: '0 0 0 999px #07100d66' }}><ScanLine size={34} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', color: '#8ff0b7' }} /></div>}
          {phase !== 'scanning' && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 28, textAlign: 'center', background: '#101a16' }}>
              <div>
                {phase === 'requesting' ? <Camera size={44} color="#7be7aa" /> : <ShieldAlert size={44} color="#f0b85a" />}
                <p style={{ margin: '12px 0 0', fontWeight: 800 }}>{phase === 'requesting' ? 'Kamera wird geöffnet …' : phase === 'denied' ? 'Kamerazugriff ist nicht erlaubt' : 'Kamera nicht verfügbar'}</p>
                <p style={{ margin: '6px 0 0', color: '#9bb0a6', fontSize: 14 }}>Der achtstellige Code unter dem QR funktioniert immer als Ersatz.</p>
              </div>
            </div>
          )}
        </div>

        <div aria-live="polite" style={{ minHeight: 72, marginTop: 14, padding: '14px 16px', borderRadius: 18, background: message?.startsWith('Übergabe vollständig') ? '#123b24' : '#11221a', border: '1px solid #294438', display: 'flex', alignItems: 'center', gap: 12 }}>
          {message?.startsWith('Übergabe vollständig') ? <CheckCircle2 size={25} color="#7be7aa" /> : <ScanLine size={25} color="#7be7aa" />}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800 }}>{message ?? 'QR ruhig in den Rahmen halten'}</div>
            {progress && <div style={{ marginTop: 4, color: '#9fb2a9', fontSize: 13 }}>{progress.done} von {progress.total} Bestellungen vollständig</div>}
          </div>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void submit(manual); }} style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <label style={{ flex: 1, position: 'relative' }}>
            <Keyboard size={18} style={{ position: 'absolute', left: 14, top: 15, color: '#839b90' }} />
            <input value={manual} onChange={(event) => setManual(event.target.value.toUpperCase())} maxLength={8} autoCapitalize="characters" placeholder="8-stelliger Ersatzcode" style={{ width: '100%', height: 48, borderRadius: 14, border: '1px solid #345044', background: '#101c17', color: '#fff', padding: '0 12px 0 42px', fontSize: 16, fontWeight: 800, letterSpacing: '.08em' }} />
          </label>
          <button type="submit" disabled={manual.trim().length !== 8} style={{ height: 48, padding: '0 18px', borderRadius: 14, border: 0, background: manual.trim().length === 8 ? '#7be7aa' : '#284036', color: '#07100d', fontWeight: 900 }}>Prüfen</button>
        </form>
      </div>
    </div>
  );
}
