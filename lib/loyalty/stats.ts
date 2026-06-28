import { createServiceClient } from '@/lib/supabase/server';

export interface MonthlyStats {
  totalRedemptions: number;
  topItems: Array<{ menuItemId: string; name: string; count: number }>;
  dailyTrend: Array<{ date: string; count: number }>;
}

export async function getMonthlyStats(
  tenantId: string,
  programId?: string
): Promise<MonthlyStats> {
  const svc = createServiceClient();
  
  // Get date range for current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  
  // Fetch all redemptions for this month
  let query = svc
    .from('loyalty_redemptions')
    .select('redeemed_menu_item_ids, redeemed_at, order_id')
    .eq('tenant_id', tenantId)
    .gte('redeemed_at', monthStart)
    .lte('redeemed_at', monthEnd);
    
  if (programId) {
    query = query.eq('program_id', programId);
  }
  
  const { data: redemptions, error } = await query;
  
  if (error) {
    console.error('Error fetching redemptions:', error);
    return { totalRedemptions: 0, topItems: [], dailyTrend: [] };
  }
  
  const items = (redemptions || []) as any[];
  
  // Total redemptions count
  const totalRedemptions = items.length;
  
  // Build top items map (flatten all redeemed_menu_item_ids arrays)
  const itemCounts = new Map<string, number>();
  const itemNames = new Map<string, string>();
  
  for (const redemption of items) {
    const menuIds = redemption.redeemed_menu_item_ids || [];
    for (const menuId of menuIds) {
      itemCounts.set(menuId, (itemCounts.get(menuId) ?? 0) + 1);
    }
  }
  
  // Get menu item names
  if (itemCounts.size > 0) {
    const { data: menuItems } = await svc
      .from('menu_items')
      .select('id, name')
      .in('id', Array.from(itemCounts.keys()));
    
    if (menuItems) {
      for (const item of menuItems) {
        itemNames.set(item.id, item.name);
      }
    }
  }
  
  // Build top 5 items
  const topItems = Array.from(itemCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([menuItemId, count]) => ({
      menuItemId,
      name: itemNames.get(menuItemId) || 'Unbekannt',
      count,
    }));
  
  // Build daily trend
  const dailyMap = new Map<string, number>();
  for (const redemption of items) {
    const date = redemption.redeemed_at?.split('T')[0] || '2026-01-01';
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + 1);
  }
  
  const dailyTrend = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));
  
  return { totalRedemptions, topItems, dailyTrend };
}
