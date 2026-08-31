import { describe, expect, it } from "vitest";
import {
  groupReorderProposals,
  inventoryDeviation,
  nextStock,
  validateWarehouseHierarchy,
} from "@/lib/inventory/warehouse-plan";

describe("warehouse hierarchy", () => {
  it("accepts unit and place in one room", () =>
    expect(
      validateWarehouseHierarchy([
        { id: "u", areaId: "a", parentId: null, kind: "unit" },
        { id: "p", areaId: "a", parentId: "u", kind: "place" },
      ]).valid,
    ).toBe(true));
  it("rejects cycles and cross-room parents", () => {
    expect(
      validateWarehouseHierarchy([
        { id: "u", areaId: "a", parentId: "p", kind: "unit" },
        { id: "p", areaId: "a", parentId: "u", kind: "place" },
      ]).valid,
    ).toBe(false);
    expect(
      validateWarehouseHierarchy([
        { id: "u", areaId: "a", parentId: null, kind: "unit" },
        { id: "p", areaId: "b", parentId: "u", kind: "place" },
      ]).reason,
    ).toMatch(/selben Raum/);
  });
});
describe("stock math", () => {
  it("books, withdraws and counts", () => {
    expect(nextStock(4, 3, "book")).toBe(7);
    expect(nextStock(4, 3, "withdraw")).toBe(1);
    expect(nextStock(4, 3, "count")).toBe(3);
    expect(inventoryDeviation(4, 3)).toBe(-1);
  });
  it("never allows negative stock", () =>
    expect(() => nextStock(2, 3, "withdraw")).toThrow(/negativ/));
});
it("groups reorder proposals by supplier and location", () =>
  expect(
    groupReorderProposals([
      {
        id: "one",
        supplierId: "s",
        supplierName: "S",
        locationId: "l",
        target: 10,
        current: 4,
      },
      {
        id: "two",
        supplierId: "s",
        supplierName: "S",
        locationId: "l",
        target: 5,
        current: 3,
      },
      {
        id: "three",
        supplierId: "s",
        supplierName: "S",
        locationId: "x",
        target: 2,
        current: 2,
      },
    ]),
  ).toEqual([
    {
      supplierId: "s",
      supplierName: "S",
      locationId: "l",
      amount: 8,
      itemCount: 2,
      itemIds: ["one", "two"],
    },
    {
      supplierId: "s",
      supplierName: "S",
      locationId: "x",
      amount: 0,
      itemCount: 1,
      itemIds: ["three"],
    },
  ]));

it("keeps exact reorder membership and zero-quantity under-minimum lines", () =>
  expect(
    groupReorderProposals([
      {
        id: "supplier-item",
        supplierId: "supplier",
        supplierName: null,
        locationId: "location",
        target: 2,
        current: 2,
      },
      {
        id: "unassigned-item",
        supplierId: null,
        supplierName: null,
        locationId: "location",
        target: 1,
        current: 0,
      },
    ]),
  ).toEqual([
    {
      supplierId: "supplier",
      supplierName: "Lieferant ohne Namen",
      locationId: "location",
      amount: 0,
      itemCount: 1,
      itemIds: ["supplier-item"],
    },
    {
      supplierId: null,
      supplierName: "Ohne Lieferant",
      locationId: "location",
      amount: 1,
      itemCount: 1,
      itemIds: ["unassigned-item"],
    },
  ]));
