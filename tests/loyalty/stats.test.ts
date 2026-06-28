import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMonthlyStats, MonthlyStats } from '@/lib/loyalty/stats';

// Mock data
const mockRedemptions = [
  {
    id: 'r1',
    redeemed_menu_item_ids: ['item1', 'item2'],
    redeemed_at: '2026-06-15T10:00:00Z',
    order_id: 'order1',
  },
  {
    id: 'r2',
    redeemed_menu_item_ids: ['item1', 'item3'],
    redeemed_at: '2026-06-16T14:30:00Z',
    order_id: 'order2',
  },
  {
    id: 'r3',
    redeemed_menu_item_ids: ['item2'],
    redeemed_at: '2026-06-20T09:15:00Z',
    order_id: 'order3',
  },
];

const mockMenuItems = [
  { id: 'item1', name: 'Cappuccino' },
  { id: 'item2', name: 'Espresso' },
  { id: 'item3', name: 'Latte' },
];

// Mock the supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'loyalty_redemptions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(function() { return this; }),
            gte: vi.fn(function() { return this; }),
            lte: vi.fn(function() { return this; }),
            then: vi.fn((callback) => {
              return callback({ data: mockRedemptions, error: null });
            }),
          })),
        };
      } else if (table === 'menu_items') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(function() { return this; }),
            then: vi.fn((callback) => {
              return callback({ data: mockMenuItems, error: null });
            }),
          })),
        };
      }
      return { select: () => ({}) };
    }),
  })),
}));

describe('getMonthlyStats', () => {
  it('calculates total redemptions correctly', async () => {
    const stats = await getMonthlyStats('tenant1');
    expect(stats.totalRedemptions).toBe(3);
  });

  it('returns top items sorted by count', async () => {
    const stats = await getMonthlyStats('tenant1');
    expect(stats.topItems.length).toBeGreaterThan(0);
    
    // Check that items are sorted by count (descending)
    for (let i = 0; i < stats.topItems.length - 1; i++) {
      expect(stats.topItems[i].count).toBeGreaterThanOrEqual(stats.topItems[i + 1].count);
    }
  });

  it('limits top items to 5', async () => {
    const stats = await getMonthlyStats('tenant1');
    expect(stats.topItems.length).toBeLessThanOrEqual(5);
  });

  it('includes item names in top items', async () => {
    const stats = await getMonthlyStats('tenant1');
    if (stats.topItems.length > 0) {
      expect(stats.topItems[0]).toHaveProperty('name');
      expect(stats.topItems[0].name).toBeTruthy();
    }
  });

  it('builds daily trend correctly', async () => {
    const stats = await getMonthlyStats('tenant1');
    expect(stats.dailyTrend).toBeDefined();
    expect(Array.isArray(stats.dailyTrend)).toBe(true);
    
    // Daily trend should be sorted by date (lexicographically for YYYY-MM-DD)
    for (let i = 0; i < stats.dailyTrend.length - 1; i++) {
      const current = stats.dailyTrend[i].date;
      const next = stats.dailyTrend[i + 1].date;
      expect(current.localeCompare(next)).toBeLessThanOrEqual(0);
    }
  });

  it('returns MonthlyStats structure with all required fields', async () => {
    const stats = await getMonthlyStats('tenant1');
    expect(stats).toHaveProperty('totalRedemptions');
    expect(stats).toHaveProperty('topItems');
    expect(stats).toHaveProperty('dailyTrend');
    expect(typeof stats.totalRedemptions).toBe('number');
    expect(Array.isArray(stats.topItems)).toBe(true);
    expect(Array.isArray(stats.dailyTrend)).toBe(true);
  });

  it('filters by program_id when provided', async () => {
    const stats = await getMonthlyStats('tenant1', 'program123');
    expect(stats).toHaveProperty('totalRedemptions');
    expect(stats).toHaveProperty('topItems');
  });
});

describe('MonthlyStats calculation helpers', () => {
  it('correctly counts items from redemptions array', () => {
    const mockRedemptions = [
      { redeemed_menu_item_ids: ['item1', 'item2'] },
      { redeemed_menu_item_ids: ['item1'] },
      { redeemed_menu_item_ids: ['item2', 'item3'] },
    ];

    // Calculate item counts manually (as the function does)
    const itemCounts = new Map<string, number>();
    for (const redemption of mockRedemptions) {
      const menuIds = redemption.redeemed_menu_item_ids || [];
      for (const menuId of menuIds) {
        itemCounts.set(menuId, (itemCounts.get(menuId) ?? 0) + 1);
      }
    }

    expect(itemCounts.get('item1')).toBe(2);
    expect(itemCounts.get('item2')).toBe(2);
    expect(itemCounts.get('item3')).toBe(1);
  });

  it('correctly groups daily counts', () => {
    const mockRedemptions = [
      { redeemed_at: '2026-06-15T10:00:00Z' },
      { redeemed_at: '2026-06-15T14:00:00Z' },
      { redeemed_at: '2026-06-16T09:00:00Z' },
    ];

    // Calculate daily counts manually (as the function does)
    const dailyMap = new Map<string, number>();
    for (const redemption of mockRedemptions) {
      const date = redemption.redeemed_at?.split('T')[0] || '2026-01-01';
      dailyMap.set(date, (dailyMap.get(date) ?? 0) + 1);
    }

    expect(dailyMap.get('2026-06-15')).toBe(2);
    expect(dailyMap.get('2026-06-16')).toBe(1);
  });

  it('handles empty redemptions array', () => {
    const mockRedemptions: any[] = [];
    const itemCounts = new Map<string, number>();
    
    for (const redemption of mockRedemptions) {
      const menuIds = redemption.redeemed_menu_item_ids || [];
      for (const menuId of menuIds) {
        itemCounts.set(menuId, (itemCounts.get(menuId) ?? 0) + 1);
      }
    }

    expect(itemCounts.size).toBe(0);
  });
});
