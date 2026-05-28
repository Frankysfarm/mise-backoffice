'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Bell, Bike, Check, ChevronDown, MapPin, Package, Phone, User, X } from 'lucide-react';
import { T, R, SHADOW, LAYOUT } from '@design/tokens/tokens';
import { FONT } from '@design/tokens/fonts';
import { formatEURfromNumeric } from '@design/tokens/helpers';

interface OrderItem {
  id: string;
  name: string;
  menge: number;
  einzelpreis: number;
  notiz: string | null;
}

interface Order {
  id: string;
  bestellnummer: string;
  typ: 'lieferung' | 'abholung' | 'vor_ort';
  kunde_name: string;
  kunde_telefon: string | null;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_stadt: string | null;
  kunde_notiz: string | null;
  gesamtbetrag: number;
  bestellt_am: string;
  order_items: OrderItem[] | null;
}

interface Props {
  order: Order;
  queueCount: number;
  onAccept: () => void;
  onReject: () => void;
  onDismiss: () => void;
}

const TYP_LABEL: Record<string, string> = {
  lieferung: 'Lieferung',
  abholung: 'Abholung',
  vor_ort: 'Vor Ort',
};

const TYP_ICON: Record<string, React.ComponentType<{ size?: number | string; style?: React.CSSProperties }>> = {
  lieferung: Bike,
  abholung: Package,
  vor_ort: User,
};

function elapsedSec(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
}

export function NewOrderOverlay({ order, queueCount, onAccept, onReject, onDismiss }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const sec = elapsedSec(order.bestellt_am, now);
  const min = Math.floor(sec / 60);
  const Icon = TYP_ICON[order.typ] ?? Package;
  const itemCount = (order.order_items ?? []).reduce((s, it) => s + (it.menge ?? 0), 0);
  const urgent = sec > 60;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 70,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'grid', placeItems: 'center',
      padding: 12,
      animation: 'miseFadeIn 0.2s ease-out',
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 720,
        backgroundColor: T.surface,
        borderRadius: R['2xl'],
        overflow: 'hidden',
        boxShadow: SHADOW.modal,
        border: `2px solid ${urgent ? T.err : T.action}`,
        animation: 'miseSlideUp 0.25s ease-out',
      }}>
        {/* TOP-Banner */}
        <div style={{
          padding: '20px 24px',
          color: T.surfaceTop,
          display: 'flex', alignItems: 'center', gap: 16,
          backgroundColor: urgent ? T.err : T.action,
        }}>
          <div style={{
            height: 56, width: 56,
            borderRadius: R.round,
            backgroundColor: 'rgba(255,255,255,0.2)',
            display: 'grid', placeItems: 'center',
            backdropFilter: 'blur(8px)',
            flexShrink: 0,
            animation: 'misePulse 1.8s ease-in-out infinite',
          }}>
            <Bell size={28} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: FONT.ui, fontSize: 24, fontWeight: 800,
              letterSpacing: '-0.02em', lineHeight: 1,
              textTransform: 'uppercase',
            }}>
              {urgent ? 'Dringend!' : 'Neue Bestellung'}
            </div>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13,
              marginTop: 6, opacity: 0.9,
              fontVariantNumeric: 'tabular-nums',
            }}>
              #{order.bestellnummer} · {TYP_LABEL[order.typ]} · vor {min > 0 ? `${min} Min ${sec % 60} Sek` : `${sec} Sek`}
            </div>
          </div>
          {queueCount > 1 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '6px 14px',
              borderRadius: R['2xl'],
              backgroundColor: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                fontFamily: FONT.ui, fontSize: 20, fontWeight: 800,
                lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              }}>+{queueCount - 1}</div>
              <div style={{
                fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase', marginTop: 4, opacity: 0.9,
              }}>Warten</div>
            </div>
          )}
        </div>

        {/* BODY */}
        <div style={{
          padding: 24,
          backgroundColor: T.surface,
          maxHeight: '55vh', overflowY: 'auto',
        }}>
          {/* Kunde */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 10, fontWeight: 500,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: T.textMute, marginBottom: 4,
            }}>Kunde</div>
            <div style={{
              fontFamily: FONT.ui, fontSize: 36, fontWeight: 800,
              letterSpacing: '-0.03em', lineHeight: 1,
              color: T.text,
            }}>{order.kunde_name}</div>
            {order.kunde_telefon && (
              <a
                href={`tel:${order.kunde_telefon}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  marginTop: 8,
                  color: T.info,
                  fontFamily: FONT.body, fontSize: 14, fontWeight: 600,
                  textDecoration: 'none',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Phone size={15} /> {order.kunde_telefon}
              </a>
            )}
          </div>

          {/* Adresse */}
          {order.typ === 'lieferung' && order.kunde_adresse && (
            <div style={{
              borderRadius: R.lg,
              backgroundColor: T.surfaceHi,
              border: `1px solid ${T.border}`,
              padding: 16, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                <MapPin size={20} style={{ color: T.action, marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{
                    fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: T.textMute,
                  }}>Liefer-Adresse</div>
                  <div style={{
                    fontFamily: FONT.body, fontSize: 16, fontWeight: 600,
                    color: T.text, marginTop: 2,
                  }}>{order.kunde_adresse}</div>
                  <div style={{
                    fontFamily: FONT.body, fontSize: 14, color: T.textMute,
                  }}>{order.kunde_plz} {order.kunde_stadt}</div>
                </div>
              </div>
            </div>
          )}

          {/* Kunde-Notiz */}
          {order.kunde_notiz && (
            <div style={{
              borderRadius: R.lg,
              backgroundColor: 'rgba(214, 150, 56, 0.12)',
              border: `1px solid ${T.warn}`,
              padding: 16, marginBottom: 16,
            }}>
              <div style={{
                fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: T.warn, fontWeight: 600,
                marginBottom: 6,
              }}>📝 Notiz vom Kunden</div>
              <div style={{
                fontFamily: FONT.body, fontSize: 15, color: T.text,
                lineHeight: 1.4,
              }}>{order.kunde_notiz}</div>
            </div>
          )}

          {/* Items */}
          {order.order_items && order.order_items.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: T.textMute,
                marginBottom: 8, fontWeight: 500,
              }}>
                {itemCount} Artikel
              </div>
              <div style={{
                borderRadius: R.lg,
                border: `1px solid ${T.border}`,
                overflow: 'hidden',
              }}>
                {order.order_items.map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px',
                      backgroundColor: T.surfaceHi,
                      borderTop: idx > 0 ? `1px solid ${T.border}` : 'none',
                    }}
                  >
                    <div style={{
                      height: 36, width: 36,
                      borderRadius: R.round,
                      backgroundColor: T.actionTint,
                      color: T.action,
                      display: 'grid', placeItems: 'center',
                      fontFamily: FONT.mono, fontSize: 14, fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}>
                      {item.menge}×
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: FONT.body, fontSize: 15, fontWeight: 600,
                        color: T.text, lineHeight: 1.3,
                      }}>{item.name}</div>
                      {item.notiz && (
                        <div style={{
                          fontFamily: FONT.body, fontSize: 12,
                          color: T.warn,
                          backgroundColor: 'rgba(214, 150, 56, 0.12)',
                          borderRadius: 4, padding: '2px 6px',
                          marginTop: 4, display: 'inline-block',
                          fontWeight: 600,
                        }}>📝 {item.notiz}</div>
                      )}
                    </div>
                    <div style={{
                      fontFamily: FONT.mono, fontSize: 14, fontWeight: 600,
                      color: T.textMute,
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}>
                      {formatEURfromNumeric(Number(item.einzelpreis) * item.menge)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            borderTop: `1px solid ${T.borderHi}`, paddingTop: 16,
          }}>
            <div>
              <div style={{
                fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: T.textMute, fontWeight: 500,
              }}>Gesamtbetrag</div>
              <div style={{
                fontFamily: FONT.mono, fontSize: 32, fontWeight: 700,
                color: T.text, fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4,
              }}>
                {formatEURfromNumeric(order.gesamtbetrag)}
              </div>
            </div>
            {queueCount > 1 && (
              <button
                onClick={onDismiss}
                style={{
                  fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.04em',
                  color: T.textMute,
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: 4,
                }}
              >
                <ChevronDown size={12} />
                In Liste sehen ({queueCount - 1} weitere warten)
              </button>
            )}
          </div>
        </div>

        {/* BUTTONS */}
        <div style={{
          padding: '20px 24px',
          backgroundColor: T.surfaceTop,
          borderTop: `1px solid ${T.border}`,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 12,
        }}>
          <button
            onClick={onAccept}
            style={{
              padding: '20px 24px',
              borderRadius: R.lg,
              backgroundColor: T.action,
              color: T.surfaceTop,
              border: 'none',
              fontFamily: FONT.ui,
              fontSize: 20, fontWeight: 800,
              letterSpacing: '-0.02em',
              cursor: 'pointer',
              boxShadow: SHADOW.saffronButton,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: 8,
              transition: 'opacity 0.12s',
            }}
          >
            <Check size={24} /> Annehmen
            <ArrowRight size={20} style={{ opacity: 0.75 }} />
          </button>
          <button
            onClick={onReject}
            style={{
              padding: '20px',
              borderRadius: R.lg,
              backgroundColor: 'transparent',
              color: T.errBright,
              border: `2px solid ${T.err}`,
              fontFamily: FONT.ui,
              fontSize: 15, fontWeight: 700,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: 8,
              transition: 'opacity 0.12s',
            }}
          >
            <X size={20} /> Ablehnen
          </button>
        </div>
      </div>
    </div>
  );
}
