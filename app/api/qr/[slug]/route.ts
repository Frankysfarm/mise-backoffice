import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/qr/[slug]?format=png|svg&size=320
 *
 * Generiert QR-Code on-the-fly. Encoded URL ist immer https://mise-gastro.de/go/[slug].
 * Egal wieviele Tenants — keine statischen Dateien nötig.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return new NextResponse('invalid slug', { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get('format') ?? 'png').toLowerCase();
  const size = Math.max(120, Math.min(2400, Number(searchParams.get('size') ?? '600')));

  const url = `https://mise-gastro.de/go/${slug}`;
  const opts = {
    errorCorrectionLevel: 'H' as const,
    margin: 2,
    color: { dark: '#0f2922', light: '#ffffff' },
    width: size,
  };

  if (format === 'svg') {
    const svg = await QRCode.toString(url, { ...opts, type: 'svg' });
    return new NextResponse(svg, {
      headers: {
        'content-type': 'image/svg+xml',
        'cache-control': 'public, max-age=3600',
      },
    });
  }

  const buf = await QRCode.toBuffer(url, opts);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=3600',
      'content-disposition': `inline; filename="qr-${slug}.png"`,
    },
  });
}
