'use client';

import { useEffect, useRef, useState } from 'react';
import { UserCircle, X, ScanLine, Sparkles, Star, Coffee, Calendar, Loader2 } from 'lucide-react';
import jsQR from 'jsqr';

interface Member {
  found: true;
  id: string;
  name: string;
  email: string | null;
  telefon: string | null;
  bonus_points: number | null;
  umsatz_total: number | null;
  anzahl_bestellungen: number | null;
  stamps: number | null;
  rewards_redeemed: number | null;
  letzter_besuch: string | null;
  birthday: string | null;
  coupons: Array<{
    id: string; code: string; name: string;
    beschreibung: string | null;
    typ: string; wert: number;
    mindestbestellwert: number | null;
    gueltig_bis: string | null;
  }>;
}

export function MemberScannerFAB() {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'camera' | 'lookup' | 'result'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  function close() {
    stopCamera();
    setOpen(false);
    setMember(null);
    setError(null);
    setPhase('idle');
  }

  function stopCamera() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }

  async function startScan() {
    setError(null);
    setMember(null);
    setPhase('camera');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Kamera nicht verfügbar');
      setPhase('idle');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }, audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      setScanning(true);

      if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        setError('Canvas-Fehler');
        return;
      }

      const Detector = (globalThis as any).BarcodeDetector;
      const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        let code: string | null = null;
        try {
          if (detector) {
            const codes = await detector.detect(videoRef.current);
            if (codes?.length > 0) code = String(codes[0].rawValue ?? '');
          } else {
            const w = videoRef.current.videoWidth;
            const h = videoRef.current.videoHeight;
            if (w > 0 && h > 0) {
              if (canvas.width !== w) canvas.width = w;
              if (canvas.height !== h) canvas.height = h;
              ctx.drawImage(videoRef.current, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const r = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
              if (r?.data) code = r.data;
            }
          }
        } catch {}

        if (code) {
          stopCamera();
          await lookupMember(code);
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      setError(e?.message ?? 'Kamera blockiert');
      setPhase('idle');
    }
  }

  async function lookupMember(code: string) {
    setPhase('lookup');
    // Extract UUID from QR — könnte URL sein oder direkt ID
    let id = code.trim();
    const match = id.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (match) id = match[0];
    try {
      const r = await fetch(`/api/pos/member/lookup?id=${encodeURIComponent(id)}`);
      const d = await r.json();
      if (!r.ok || !d.found) {
        setError(d.error ?? 'Kein Member mit diesem Code gefunden');
        setPhase('idle');
        return;
      }
      setMember(d);
      setPhase('result');
    } catch (e: any) {
      setError(e?.message ?? 'Lookup fehlgeschlagen');
      setPhase('idle');
    }
  }

  function applyMember() {
    if (!member) return;
    // Custom event für POS — der MisePOSv5 hört (falls Listener implementiert) darauf
    window.dispatchEvent(new CustomEvent('mise:member-applied', { detail: member }));
    close();
  }

  return (
    <>
      {/* Floating Button — unten rechts auf v5 */}
      <button
        onClick={() => { setOpen(true); setTimeout(startScan, 200); }}
        aria-label="Member-Code scannen"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 60,
          width: 64, height: 64, borderRadius: '50%',
          backgroundColor: '#E68A2C', color: '#0A0908',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(230, 138, 44, 0.5)',
        }}
      >
        <UserCircle size={28} />
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 80,
          backgroundColor: 'rgba(10, 9, 8, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'grid', placeItems: 'center', padding: 16,
        }} onClick={close}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 440,
              backgroundColor: '#171614',
              border: '1px solid #2A2724',
              borderRadius: 20,
              overflow: 'hidden',
              fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            }}
          >
            <div style={{
              padding: 18,
              borderBottom: '1px solid #2A2724',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <UserCircle size={22} style={{ color: '#E68A2C' }} />
              <div style={{
                flex: 1,
                color: '#F2EDE3',
                fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em',
              }}>Member-Code scannen</div>
              <button onClick={close} aria-label="Schließen" style={{
                width: 30, height: 30, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#1F1D1A', color: '#8E8579',
                border: '1px solid #2A2724', cursor: 'pointer',
              }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: 18, minHeight: 280 }}>
              {phase === 'camera' && (
                <div style={{
                  position: 'relative', aspectRatio: '1', width: '100%',
                  borderRadius: 12, overflow: 'hidden',
                  backgroundColor: '#0A0908', border: '1px solid #2A2724',
                }}>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    style={{
                      position: 'absolute', inset: 0,
                      width: '100%', height: '100%', objectFit: 'cover',
                    }}
                  />
                  {scanning && (
                    <div style={{
                      position: 'absolute', inset: 36,
                      border: '3px solid rgba(230, 138, 44, 0.8)',
                      borderRadius: 12,
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)',
                    }} />
                  )}
                </div>
              )}
              {phase === 'lookup' && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: 40, gap: 12,
                }}>
                  <Loader2 size={36} style={{ color: '#E68A2C', animation: 'miseSpin 1s linear infinite' }} />
                  <div style={{ color: '#8E8579', fontSize: 13 }}>Member wird geladen …</div>
                </div>
              )}
              {phase === 'result' && member && (
                <div>
                  <div style={{
                    padding: 16, marginBottom: 12,
                    borderRadius: 12,
                    backgroundColor: 'rgba(230, 138, 44, 0.10)',
                    border: '1px solid rgba(230, 138, 44, 0.30)',
                  }}>
                    <div style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                      color: '#D69638', fontWeight: 600, marginBottom: 4,
                    }}>Member · gefunden</div>
                    <div style={{
                      color: '#F2EDE3',
                      fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em',
                      lineHeight: 1,
                    }}>{member.name}</div>
                    {member.email && (
                      <div style={{ color: '#8E8579', fontSize: 12, marginTop: 4 }}>{member.email}</div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    {member.stamps != null && (
                      <Stat icon={Star} label="Stempel" value={String(member.stamps)} />
                    )}
                    {member.bonus_points != null && (
                      <Stat icon={Sparkles} label="Bonus" value={String(member.bonus_points)} />
                    )}
                    {member.anzahl_bestellungen != null && (
                      <Stat icon={Coffee} label="Besuche" value={String(member.anzahl_bestellungen)} />
                    )}
                    {member.umsatz_total != null && (
                      <Stat
                        icon={Sparkles}
                        label="Umsatz"
                        value={`${Math.round(Number(member.umsatz_total))}€`}
                      />
                    )}
                  </div>
                  {member.coupons.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                        color: '#8E8579', fontWeight: 600, marginBottom: 6,
                      }}>Verfügbare Coupons</div>
                      {member.coupons.map((c) => (
                        <div key={c.id} style={{
                          padding: '8px 12px', marginBottom: 6,
                          borderRadius: 8,
                          backgroundColor: '#1F1D1A',
                          border: '1px solid #2A2724',
                        }}>
                          <div style={{ color: '#F2EDE3', fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                          <div style={{
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: 10, color: '#8E8579', marginTop: 2,
                          }}>{c.code}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={applyMember}
                    style={{
                      width: '100%',
                      padding: '14px 18px',
                      backgroundColor: '#E68A2C', color: '#0A0908',
                      border: 'none', borderRadius: 10,
                      fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
                      cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(230, 138, 44, 0.30)',
                    }}
                  >
                    Auf aktuellen Bon anwenden
                  </button>
                </div>
              )}
              {error && (
                <div style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: 'rgba(184, 74, 58, 0.10)',
                  border: '1px solid #B84A3A',
                  color: '#D45B47',
                  fontSize: 13, fontWeight: 500,
                }}>{error}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string; value: string;
}) {
  return (
    <div style={{
      padding: 10, borderRadius: 8,
      backgroundColor: '#1F1D1A',
      border: '1px solid #2A2724',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Icon size={11} style={{ color: '#8E8579' }} />
        <span style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: '#8E8579', fontWeight: 500,
        }}>{label}</span>
      </div>
      <div style={{
        color: '#F2EDE3',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 16, fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.01em',
      }}>{value}</div>
    </div>
  );
}
