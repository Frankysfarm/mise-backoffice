const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string): number {
  if (!isHexColor(color)) return 0;
  const red = channelToLinear(Number.parseInt(color.slice(1, 3), 16));
  const green = channelToLinear(Number.parseInt(color.slice(3, 5), 16));
  const blue = channelToLinear(Number.parseInt(color.slice(5, 7), 16));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastText(background: string): '#111827' | '#ffffff' {
  if (!isHexColor(background)) return '#111827';
  const darkRatio = contrastRatio('#111827', background);
  const lightRatio = contrastRatio('#ffffff', background);
  return darkRatio >= lightRatio ? '#111827' : '#ffffff';
}

export function readableTextColor(
  foreground: string,
  background: string,
  fallback?: string,
  minimumRatio = 4.5,
): string {
  if (isHexColor(foreground) && isHexColor(background) && contrastRatio(foreground, background) >= minimumRatio) {
    return foreground;
  }
  const preferredFallback = fallback && isHexColor(fallback) ? fallback : contrastText(background);
  if (contrastRatio(preferredFallback, background) >= minimumRatio) return preferredFallback;
  return contrastText(background);
}
