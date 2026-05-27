import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { euro } from '@/lib/utils';
import {
  Package, AlertTriangle, TrendingDown, Truck, Trash2,
  BarChart3, ClipboardList, ShoppingCart, Warehouse,
} from 'lucide-react';

export default async function InventoryDashboard() {
  await requireManagerPlus();
  const supabase = await createClient();

  const [
    { count: totalItems },
    { count: activeItems },
    { data: belowPar },
    { data: recentWaste },
    { count: pendingOrders },
    { data: reorderSuggestions },
    { count: expiringSoon },
  ] = await Promise.all([
    supabase.from('inventory_items').select('id', { count: 'exact', head: true }),
    supabase.from('inventory_items').select('id', { count: 'exact', head: true }).eq('aktiv', true),
    supabase.rpc('generate_reorder_list' as any).select('*') as any,
    supabase.from('inventory_waste').select('wert_euro,created_at').gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()).order('created_at', { ascending: false }),
    supabase.from('order_lists').select('id', { count: 'exact', head: true }).in('status', ['entwurf', 'bestellt']),
    supabase.rpc('generate_reorder_list' as any).select('*') as any,
    supabase.from('inventory_batches').select('id', { count: 'exact', head: true })
      .lte('mhd', new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10))
      .gt('rest_menge', 0),
  ]);

  const wasteTotal30d = (recentWaste ?? []).reduce((s: number, w: any) => s + Number(w.wert_euro ?? 0), 0);
  const suggestions = (reorderSuggestions ?? []) as any[];

  const tiles = [
    { href: '/inventory/products',   icon: Package,        label: 'Produkte',       value: `${activeItems ?? 0} aktiv`, desc: 'Stammdaten + Bestände' },
    { href: '/inventory/suppliers',  icon: Truck,          label: 'Lieferanten',    value: '',                          desc: 'Kontakte + Lieferkonditionen' },
    { href: '/inventory/sessions',   icon: ClipboardList,  label: 'Inventuren',     value: '',                          desc: 'Zählen + Differenzen' },
    { href: '/inventory/orders',     icon: ShoppingCart,    label: 'Bestellungen',   value: `${pendingOrders ?? 0} offen`, desc: 'Bestellen + Wareneingang' },
    { href: '/inventory/waste',      icon: Trash2,         label: 'Schwund',        value: euro(wasteTotal30d) + ' / 30T', desc: 'Was weggeworfen wird' },
    { href: '/inventory/movements',  icon: BarChart3,      label: 'Bewegungen',     value: '',                          desc: 'Audit-Trail aller Änderungen' },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Lagerverwaltung" description="Bestände, Lieferanten, Bestellungen, Schwund — alles auf einen Blick." />

      {/* KPI-Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPI icon={<Package className="h-5 w-5" />} label="Produkte" value={`${activeItems ?? 0}`} sub={`von ${totalItems ?? 0} gesamt`} />
        <KPI icon={<AlertTriangle className="h-5 w-5 text-destructive" />} label="Unter Minimum" value={`${suggestions.length}`} sub="Produkte nachbestellen" warn={suggestions.length > 0} />
        <KPI icon={<TrendingDown className="h-5 w-5 text-gold" />} label="Schwund 30 Tage" value={euro(wasteTotal30d)} sub={`${(recentWaste ?? []).length} Einträge`} />
        <KPI icon={<Warehouse className="h-5 w-5" />} label="MHD < 7 Tage" value={`${expiringSoon ?? 0}`} sub="Chargen ablaufend" warn={(expiringSoon ?? 0) > 0} />
      </div>

      {/* Navigation Tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {tiles.map(t => (
          <Link key={t.href} href={t.href} className="hub-tile">
            <div className="hub-tile-icon"><t.icon className="h-6 w-6" /></div>
            <div className="font-display text-lg font-semibold mt-2">{t.label}</div>
            {t.value && <Badge variant="muted" className="w-fit">{t.value}</Badge>}
            <div className="text-sm text-muted-foreground">{t.desc}</div>
          </Link>
        ))}
      </div>

      {/* Auto-Reorder Suggestions */}
      {suggestions.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Nachbestellungs-Vorschlag
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Lieferant</TableHead>
                <TableHead className="text-right">Produkte</TableHead>
                <TableHead className="text-right">Geschätzter Wert</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {suggestions.map((s: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{s.supplier_name}</TableCell>
                    <TableCell className="text-right font-mono">{s.item_count}</TableCell>
                    <TableCell className="text-right font-mono">{euro(s.total_value)}</TableCell>
                    <TableCell>
                      <Link href="/inventory/orders">
                        <Button size="sm" variant="secondary">Bestellen →</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KPI({ icon, label, value, sub, warn }: {
  icon: React.ReactNode; label: string; value: string; sub: string; warn?: boolean;
}) {
  return (
    <Card className={warn ? 'border-destructive/40' : ''}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className={`font-display text-3xl font-bold ${warn ? 'text-destructive' : ''}`}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}
