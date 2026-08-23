import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  contrastText,
  isHexColor,
  readableTextColor,
} from '../../lib/branding/contrast';

describe('QR branding contrast', () => {
  it('accepts only six-digit hexadecimal theme colors', () => {
    expect(isHexColor('#14532d')).toBe(true);
    expect(isHexColor('#FFFfff')).toBe(true);
    expect(isHexColor('#fff')).toBe(false);
    expect(isHexColor('red')).toBe(false);
  });

  it('chooses a readable foreground for light and dark brand colors', () => {
    expect(contrastText('#fef08a')).toBe('#111827');
    expect(contrastText('#14532d')).toBe('#ffffff');
    expect(contrastRatio(contrastText('#4ae68a'), '#4ae68a')).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps a brand foreground only when it meets WCAG AA contrast', () => {
    expect(readableTextColor('#14532d', '#ffffff')).toBe('#14532d');
    expect(readableTextColor('#fef08a', '#ffffff')).toBe('#111827');
    expect(readableTextColor('#4ae68a', '#14532d', '#ffffff')).toBe('#4ae68a');
  });
});
