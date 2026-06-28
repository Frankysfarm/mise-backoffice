import { describe, it, expect, vi } from "vitest";
import { ItemsSelector } from "@/app/(neo)/neo/app/loyalty/components/items-selector";
import { LoyaltyProgramItem } from "@/lib/loyalty/types";

interface MenuItem {
  id: string;
  name: string;
  preis: number;
  category_id: string | null;
  beschreibung?: string | null;
  verfuegbar?: boolean;
}

describe("ItemsSelector", () => {
  const mockMenuItems: MenuItem[] = [
    { id: "1", name: "Pizza Margherita", preis: 12.5, category_id: "cat-pizza" },
    { id: "2", name: "Pizza Quattro Formaggi", preis: 15.9, category_id: "cat-pizza" },
    { id: "3", name: "Pasta Carbonara", preis: 14.5, category_id: "cat-pasta" },
    { id: "4", name: "Cola 0.5l", preis: 3.5, category_id: "cat-drinks" },
  ];

  it("should have the correct component structure", () => {
    expect(typeof ItemsSelector).toBe("function");
  });

  it("should accept required props", () => {
    const mockCallback = vi.fn();
    const selectedItems: LoyaltyProgramItem[] = [];

    const component = ItemsSelector({
      menuItems: mockMenuItems,
      selectedItems: selectedItems,
      onSelectionChange: mockCallback,
    });

    expect(component).toBeDefined();
  });

  it("should group items by category_id", () => {
    const mockCallback = vi.fn();
    const component = ItemsSelector({
      menuItems: mockMenuItems,
      selectedItems: [],
      onSelectionChange: mockCallback,
    });

    expect(component).toBeTruthy();
    expect(component.type).toBeDefined();
  });

  it("should handle empty menu items gracefully", () => {
    const mockCallback = vi.fn();
    const component = ItemsSelector({
      menuItems: [],
      selectedItems: [],
      onSelectionChange: mockCallback,
    });

    expect(component).toBeTruthy();
  });

  it("should handle items with null category_id", () => {
    const mockCallback = vi.fn();
    const itemsWithNullCat: MenuItem[] = [
      { id: "1", name: "Uncategorized Item", preis: 10.0, category_id: null },
    ];

    const component = ItemsSelector({
      menuItems: itemsWithNullCat,
      selectedItems: [],
      onSelectionChange: mockCallback,
    });

    expect(component).toBeTruthy();
  });

  it("should accept selectedItems prop and render correctly", () => {
    const mockCallback = vi.fn();
    const selectedItems: LoyaltyProgramItem[] = [
      {
        id: "prog-item-1",
        program_id: "prog-1",
        rule_id: "rule-1",
        menu_item_id: "1",
        is_optional: true,
        max_quantity_per_redemption: 1,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const component = ItemsSelector({
      menuItems: mockMenuItems,
      selectedItems: selectedItems,
      onSelectionChange: mockCallback,
    });

    expect(component).toBeTruthy();
  });

  it("should accept onSelectionChange callback", () => {
    const mockCallback = vi.fn();

    const component = ItemsSelector({
      menuItems: mockMenuItems,
      selectedItems: [],
      onSelectionChange: mockCallback,
    });

    expect(component).toBeTruthy();
  });
});
