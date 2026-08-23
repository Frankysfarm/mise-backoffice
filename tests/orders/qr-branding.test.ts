import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('QR table branding', () => {
  it('persists restaurant-scoped colors and copy through a manager-only route', () => {
    const route = source('app/api/shop/qr-branding/route.ts');
    expect(route).toContain('requireManagerPlus()');
    expect(route).toContain(".eq('id', employee.tenant_id)");
    expect(route).toContain("origin !== req.nextUrl.origin");
    expect(route.indexOf('requireManagerPlus()')).toBeLessThan(route.indexOf(".from('tenants')"));
  });

  it('uses the real table route for previews and exposes editable brand controls', () => {
    const page = source('app/(admin)/shop/qr-design/page.tsx');
    const form = source('app/(admin)/shop/qr-design/qr-branding-form.tsx');
    expect(page).toContain('/t/');
    expect(page).not.toContain('/biss-app/t/');
    expect(page).toContain('<QRBrandingForm');
    expect(form).toContain("fetch('/api/shop/qr-branding'");
    expect(form).toContain('type="color"');
  });

  it('validates branding in both the route and database migration', () => {
    const route = source('app/api/shop/qr-branding/route.ts');
    const migration = source('scripts/migrations/082_table_order_foundation.sql');
    expect(route).toContain('HEX_COLOR');
    expect(route).toContain('optionalText(body?.welcomeText, 160)');
    expect(migration).toContain('tenants_qr_theme_primary_check');
    expect(migration).toContain('tenants_qr_welcome_text_check');
  });
});
