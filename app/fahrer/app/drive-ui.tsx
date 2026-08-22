'use client';

/**
 * drive-ui.tsx — Drive-Design UI-Primitives, portiert nach TSX.
 *
 * Quelle: docs/drive-design/source/ui.jsx + theme.jsx (Wald-Farbwelt).
 * Alle Inline-Styles nutzen var(--token); die Tokens leben in app/fahrer/layout.tsx.
 * Icons werden auf lucide-react gemappt (Drive-Icon-Namen -> Lucide-Aequivalente).
 *
 * Exporte: Btn, IconBtn, Sheet, Badge, Avatar, Progress, Stepper, Spinner,
 *          Header, Eyebrow, Icon, Screen.
 * KEINE CityMap — die echte Leaflet-Karte bleibt in delivery-view.tsx.
 */

import React from 'react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  X,
  Phone,
  Lock,
  User,
  Package,
  ShoppingBag,
  MapPin,
  Clock,
  Navigation,
  Route as RouteIcon,
  Power,
  Zap,
  ScanLine,
  Plus,
  Minus,
  List,
  AlertTriangle,
  Bell,
  Star,
  Truck,
  ArrowRight,
  Home,
  type LucideIcon,
} from 'lucide-react';

export const SAFE_TOP = 54;
export const SAFE_BOTTOM = 30;

/* ── Icon ──────────────────────────────────────────────────────────────────
 * Mappt die Drive-Icon-Namen (aus theme.jsx) auf lucide-react-Komponenten.
 * currentColor + stroke wie im Original; aria-hidden.
 */
export type IconName =
  | 'check'
  | 'check-circle'
  | 'chevron'
  | 'chevron-down'
  | 'back'
  | 'close'
  | 'phone'
  | 'lock'
  | 'user'
  | 'box'
  | 'bag'
  | 'pin'
  | 'pin-fill'
  | 'clock'
  | 'nav'
  | 'route'
  | 'power'
  | 'bolt'
  | 'scan'
  | 'plus'
  | 'minus'
  | 'list'
  | 'alert'
  | 'bell'
  | 'star'
  | 'truck'
  | 'arrow'
  | 'home';

const ICONS: Record<IconName, LucideIcon> = {
  check: Check,
  'check-circle': CheckCircle2,
  chevron: ChevronRight,
  'chevron-down': ChevronDown,
  back: ChevronLeft,
  close: X,
  phone: Phone,
  lock: Lock,
  user: User,
  box: Package,
  bag: ShoppingBag,
  pin: MapPin,
  'pin-fill': MapPin,
  clock: Clock,
  nav: Navigation,
  route: RouteIcon,
  power: Power,
  bolt: Zap,
  scan: ScanLine,
  plus: Plus,
  minus: Minus,
  list: List,
  alert: AlertTriangle,
  bell: Bell,
  star: Star,
  truck: Truck,
  arrow: ArrowRight,
  home: Home,
};

export interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  style?: React.CSSProperties;
  className?: string;
}

export function Icon({ name, size = 24, stroke = 2, style, className }: IconProps) {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  return (
    <Cmp
      size={size}
      strokeWidth={stroke}
      style={style}
      className={className}
      // pin-fill wird im Original gefuellt gerendert; lucide nutzt currentColor-fill
      fill={name === 'pin-fill' ? 'currentColor' : 'none'}
      aria-hidden="true"
    />
  );
}

/* ── Btn ───────────────────────────────────────────────────────────────────*/
export type BtnVariant =
  | 'primary'
  | 'dark'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'danger-solid';
export type BtnSize = 'lg' | 'md' | 'sm';

export interface BtnProps {
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  style?: React.CSSProperties;
  full?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function Btn({
  children,
  onClick,
  variant = 'primary',
  size = 'lg',
  icon,
  iconRight,
  disabled,
  style = {},
  full = true,
  type = 'button',
}: BtnProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    width: full ? '100%' : undefined,
    whiteSpace: 'nowrap',
    height: size === 'lg' ? 56 : size === 'md' ? 46 : 44,
    padding: size === 'sm' ? '0 16px' : '0 22px',
    borderRadius: size === 'lg' ? 17 : 13,
    fontSize: size === 'lg' ? 18 : size === 'md' ? 16 : 14.5,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
  };
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: {
      background: 'var(--accent)',
      color: 'var(--on-accent)',
      boxShadow: '0 6px 18px -8px var(--accent)',
    },
    dark: { background: 'var(--ink)', color: 'var(--bg)' },
    secondary: {
      background: 'var(--surface-2)',
      color: 'var(--ink)',
      boxShadow: 'inset 0 0 0 1.5px var(--line)',
    },
    ghost: { background: 'transparent', color: 'var(--ink-2)' },
    danger: { background: 'var(--danger-tint)', color: 'var(--danger)' },
    'danger-solid': { background: 'var(--danger)', color: '#fff' },
  };
  const iconSize = size === 'lg' ? 21 : 18;
  return (
    <button
      type={type}
      className="press"
      style={{ ...base, ...variants[variant], ...style }}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={iconSize} stroke={2.2} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} stroke={2.2} />}
    </button>
  );
}

/* ── IconBtn ───────────────────────────────────────────────────────────────*/
export type IconBtnVariant = 'surface' | 'tint' | 'plain';

export interface IconBtnProps {
  name: IconName;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  size?: number;
  iconSize?: number;
  variant?: IconBtnVariant;
  style?: React.CSSProperties;
  disabled?: boolean;
  'aria-label'?: string;
}

export function IconBtn({
  name,
  onClick,
  size = 44,
  iconSize = 22,
  variant = 'surface',
  style = {},
  disabled,
  'aria-label': ariaLabel,
}: IconBtnProps) {
  const v: Record<IconBtnVariant, React.CSSProperties> = {
    surface: {
      background: 'var(--surface)',
      color: 'var(--ink)',
      boxShadow: '0 1px 3px rgba(0,0,0,.08), inset 0 0 0 1px var(--line)',
    },
    tint: { background: 'var(--accent-tint)', color: 'var(--accent)' },
    plain: { background: 'transparent', color: 'var(--ink)' },
  };
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="press"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        ...v[variant],
        ...style,
      }}
    >
      <Icon name={name} size={iconSize} stroke={2.1} />
    </button>
  );
}

/* ── Badge ─────────────────────────────────────────────────────────────────*/
export type BadgeTone = 'neutral' | 'accent' | 'warn' | 'danger' | 'solid';

export interface BadgeProps {
  children?: React.ReactNode;
  tone?: BadgeTone;
  icon?: IconName;
  style?: React.CSSProperties;
}

export function Badge({ children, tone = 'neutral', icon, style = {} }: BadgeProps) {
  const tones: Record<BadgeTone, React.CSSProperties> = {
    neutral: { background: 'var(--surface-2)', color: 'var(--ink-2)' },
    accent: { background: 'var(--accent-tint)', color: 'var(--accent)' },
    warn: { background: 'var(--warn-tint)', color: 'var(--warn)' },
    danger: { background: 'var(--danger-tint)', color: 'var(--danger)' },
    solid: { background: 'var(--accent)', color: 'var(--on-accent)' },
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: icon ? '5px 11px 5px 9px' : '5px 11px',
        borderRadius: 9,
        fontSize: 12.5,
        fontWeight: 700,
        letterSpacing: '0.01em',
        lineHeight: 1,
        ...tones[tone],
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={14} stroke={2.4} />}
      {children}
    </span>
  );
}

/* ── Avatar ────────────────────────────────────────────────────────────────*/
export interface AvatarProps {
  name: string;
  size?: number;
  /** Hintergrund-Override (z.B. echte Farbe). Wenn gesetzt -> weiße Initialen. */
  tone?: string;
}

export function Avatar({ name, size = 44, tone }: AvatarProps) {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: tone || 'var(--accent-tint)',
        color: tone ? '#fff' : 'var(--accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size * 0.36,
      }}
    >
      {initials}
    </div>
  );
}

/* ── Progress ──────────────────────────────────────────────────────────────*/
export interface ProgressProps {
  value: number;
  max: number;
  height?: number;
}

export function Progress({ value, max, height = 8 }: ProgressProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      style={{
        background: 'var(--line)',
        borderRadius: 99,
        height,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: pct + '%',
          height: '100%',
          background: 'var(--accent)',
          borderRadius: 99,
          transition: 'width .45s cubic-bezier(.2,.7,.2,1)',
        }}
      />
    </div>
  );
}

/* ── Stepper ───────────────────────────────────────────────────────────────
 * Mengen-Counter (−  N  +), wie im Pick-Sheet (screens-pick.jsx). Controlled.
 */
export interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: number;
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  size = 40,
}: StepperProps) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: 'var(--surface-2)',
        borderRadius: 14,
        padding: 5,
      }}
    >
      <IconBtn
        name="minus"
        onClick={dec}
        size={size}
        iconSize={20}
        variant="surface"
        disabled={value <= min}
        aria-label="weniger"
      />
      <div
        className="mono"
        style={{ width: size, textAlign: 'center', fontWeight: 700, fontSize: 20 }}
      >
        {value}
      </div>
      <IconBtn
        name="plus"
        onClick={inc}
        size={size}
        iconSize={20}
        variant="surface"
        disabled={value >= max}
        aria-label="mehr"
      />
    </div>
  );
}

/* ── Spinner ───────────────────────────────────────────────────────────────*/
export interface SpinnerProps {
  size?: number;
  color?: string;
}

export function Spinner({ size = 20, color = 'var(--on-accent)' }: SpinnerProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${Math.max(2, size / 10)}px solid color-mix(in srgb, ${color} 30%, transparent)`,
        borderTopColor: color,
        animation: 'drv-spin .7s linear infinite',
      }}
    />
  );
}

/* ── Sheet ─────────────────────────────────────────────────────────────────
 * Bottom-Sheet mit abgedunkeltem Backdrop. Kinder gestapelt; dismissable + onClose.
 */
export interface SheetProps {
  children?: React.ReactNode;
  onClose?: () => void;
  dismissable?: boolean;
  pad?: number;
}

export function Sheet({ children, onClose, dismissable = true, pad = 20 }: SheetProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={dismissable ? onClose : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(8,12,10,.42)',
          animation: 'drv-fade-in .25s ease',
        }}
      />
      <div
        style={{
          position: 'relative',
          background: 'var(--surface)',
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          padding: `12px ${pad}px calc(${SAFE_BOTTOM}px + 16px)`,
          boxShadow: '0 -10px 40px rgba(0,0,0,.18)',
          animation: 'drv-sheet-in .34s cubic-bezier(.2,.8,.2,1)',
          maxHeight: '88%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            width: 38,
            height: 5,
            borderRadius: 99,
            background: 'var(--line)',
            margin: '0 auto 10px',
          }}
        />
        {children}
      </div>
    </div>
  );
}

/* ── Screen ────────────────────────────────────────────────────────────────
 * App-Screen-Wrapper: Safe-Area-Top-Padding + Hintergrund.
 */
export interface ScreenProps {
  children?: React.ReactNode;
  bg?: string;
  noTop?: boolean;
  style?: React.CSSProperties;
}

export function Screen({ children, bg = 'var(--bg)', noTop = false, style = {} }: ScreenProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: bg,
        paddingTop: noTop ? 0 : SAFE_TOP,
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Header ────────────────────────────────────────────────────────────────*/
export interface HeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onBack?: () => void;
  transparent?: boolean;
}

export function Header({ title, subtitle, left, right, onBack, transparent }: HeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 18px 12px',
        background: transparent ? 'transparent' : 'var(--bg)',
        flexShrink: 0,
      }}
    >
      {onBack && <IconBtn name="back" onClick={onBack} size={42} iconSize={22} aria-label="zurück" />}
      {left}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 500, marginTop: 2 }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

/* ── Eyebrow ───────────────────────────────────────────────────────────────
 * Kleines Uppercase-Label (Sektions-Kopf), wie in screens-auth.jsx.
 */
export interface EyebrowProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Eyebrow({ children, style = {} }: EyebrowProps) {
  return (
    <div
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        color: 'var(--ink-3)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
