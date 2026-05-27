import { updateSession } from '@/lib/supabase/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const PRIMARY_HOSTS = new Set(['mise-gastro.de', 'www.mise-gastro.de', 'localhost', 'localhost:3000', 'localhost:3300']);

// In-memory cache for custom-domain → tenant-slug lookup (60s TTL)
const domainCache = new Map<string, { slug: string; expires: number }>();
const NEG_CACHE = new Map<string, number>(); // domain → expires (cached miss)

async function resolveTenantSlug(host: string): Promise<string | null> {
  const cleanHost = host.toLowerCase().split(':')[0];
  const now = Date.now();
  const hit = domainCache.get(cleanHost);
  if (hit && hit.expires > now) return hit.slug;
  const miss = NEG_CACHE.get(cleanHost);
  if (miss && miss > now) return null;
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from('tenants')
      .select('slug')
      .eq('custom_domain', cleanHost)
      .eq('custom_domain_status', 'verified')
      .maybeSingle();
    if (data?.slug) {
      domainCache.set(cleanHost, { slug: data.slug, expires: now + 60_000 });
      return data.slug;
    }
    NEG_CACHE.set(cleanHost, now + 60_000);
    return null;
  } catch {
    NEG_CACHE.set(cleanHost, now + 10_000);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').toLowerCase();

  // ─── Custom-Domain-Rewrite ───────────────────────────────────────
  // Wenn der Host nicht mise-gastro.de ist, schau ob er auf einen Tenant zeigt.
  if (host && !PRIMARY_HOSTS.has(host.split(':')[0])) {
    const slug = await resolveTenantSlug(host);
    if (slug) {
      const url = request.nextUrl.clone();
      const path = url.pathname;
      // Pfade die NICHT umgeschrieben werden: Next-Assets + biss-app-API + auth + etc.
      const passthrough = path.startsWith('/_next') || path.startsWith('/api') ||
        path.startsWith('/auth') || path.startsWith('/biss-app/_next') ||
        path === '/favicon.ico' || path.startsWith('/manifest.json');
      if (!passthrough) {
        // Wenn Root: leite zu /biss-app/[slug] (Storefront)
        // Wenn /t/[token]: leite zu /biss-app/t/[token] (QR-Tisch)
        // Sonst Pfad anhängen
        let newPath: string;
        if (path === '/' || path === '') {
          newPath = `/biss-app/${slug}`;
        } else if (path.startsWith('/t/')) {
          newPath = `/biss-app${path}`;
        } else if (path.startsWith('/biss-app')) {
          newPath = path;
        } else {
          newPath = `/biss-app/${slug}${path}`;
        }
        url.pathname = newPath;
        const rewrite = NextResponse.rewrite(url);
        rewrite.headers.set('x-mise-tenant-slug', slug);
        rewrite.headers.set('x-mise-custom-domain', host);
        return rewrite;
      }
    } else {
      // Unbekannte Domain → Redirect zur Haupt-Site
      const url = request.nextUrl.clone();
      url.host = 'mise-gastro.de';
      url.protocol = 'https:';
      url.port = '';
      return NextResponse.redirect(url, 302);
    }
  }

  const res = await updateSession(request);

  // BISS-Internal-Token-Cookie setzen wenn User auf Design/Studio-Pfade zugreift.
  // Wird zu mise-gastro.de/biss-app/api/* mitgeschickt (gleicher Origin).
  const path = request.nextUrl.pathname;
  if (
    path.startsWith('/shop/design') ||
    path.startsWith('/shop/delivery') ||
    path.startsWith('/biss-app')
  ) {
    const token = process.env.BISS_INTERNAL_TOKEN;
    if (token) {
      const response = res instanceof NextResponse ? res : NextResponse.next();
      response.cookies.set('biss_token', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: true,
        path: '/',
        maxAge: 60 * 60 * 8,
      });
      return response;
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
