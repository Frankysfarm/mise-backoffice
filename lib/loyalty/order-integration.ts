import { createServiceClient } from '@/lib/supabase/server';

/**
 * Inject free loyalty items into an order
 * Call this after order_id is created
 */
export async function injectLoyaltyItemsIntoOrder(
  orderId: string,
  kundeEmail: string,
  kundeTelefon: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const svc = createServiceClient();

    // Get order to find location
    const { data: order } = await svc
      .from('customer_orders')
      .select('id, location_id')
      .eq('id', orderId)
      .single();

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    // Check for pending loyalty redemption
    const { data: redemption } = await svc
      .from('loyalty_redemptions')
      .select('redeemed_menu_item_ids')
      .eq('order_id', orderId)
      .single();

    if (!redemption || redemption.redeemed_menu_item_ids.length === 0) {
      return { success: true }; // No loyalty bonus for this order
    }

    // Get menu item details for free items
    const { data: menuItems } = await svc
      .from('menu_items')
      .select('id, name')
      .in('id', redemption.redeemed_menu_item_ids);

    if (!menuItems) {
      return { success: false, error: 'Menu items not found' };
    }

    // Insert free items as order_items with price 0.00
    const freeItems = menuItems.map(item => ({
      order_id: orderId,
      menu_item_id: item.id,
      name: item.name,
      menge: 1,
      einzelpreis: 0.00,
      extras: null,
      notiz: 'Gratis - Bonusprogramm',
    }));

    const { error: insertError } = await svc
      .from('order_items')
      .insert(freeItems);

    if (insertError) {
      console.error('Failed to insert free items:', insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Order integration error:', error);
    return { success: false, error: String(error) };
  }
}
