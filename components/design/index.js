/**
 * Mise Design System — Index
 *
 * Verwendung in deinem Projekt:
 *   import { T, FONT, formatEUR, PrimaryButton, Modal } from '@/mise-design';
 *
 * Oder einzeln:
 *   import { T } from '@/mise-design/tokens/tokens';
 *   import { PrimaryButton } from '@/mise-design/components/buttons';
 */

// Tokens
export { T, R, SHADOW, SPACE, LAYOUT, DURATION, Z } from './tokens/tokens.js';
export { FONT, FONT_SIZE, textStyles } from './tokens/fonts.js';
export { miseAnimations, useMiseAnimations } from './tokens/animations.js';

// Helpers
export {
  formatEUR,
  formatEURLarge,
  formatTime,
  formatTimeWithSeconds,
  formatDate,
  generateTransactionId,
  calcItemTotal,
  calcOrderTotal,
  calcCouponDiscount,
  calcTaxSplit,
  formatEURfromNumeric,
} from './tokens/helpers.js';

// Atoms
export { Eyebrow, Stat, StatusPill, Divider, Logomark, Toggle } from './components/atoms.jsx';

// Buttons
export {
  PrimaryButton,
  SecondaryButton,
  GhostButton,
  DestructiveButton,
  IconButton,
} from './components/buttons.jsx';

// Modal
export { Modal, ModalHeader, Toast, useToast } from './components/modal.jsx';

// Forms
export { FormGroup, Input, Select, SegmentedControl } from './components/forms.jsx';
