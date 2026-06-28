"use client";

import { use, useState, useEffect } from "react";
import { ItemsSelector } from "../components/items-selector";
import { RulesEditor } from "../components/rules-editor";
import { LoyaltyProgramItem, LoyaltyProgramRule } from "@/lib/loyalty/types";

interface MenuItem {
  id: string;
  name: string;
  preis: number;
  category_id: string | null;
  beschreibung?: string | null;
  verfuegbar?: boolean;
}

interface LoyaltyProgramPageProps {
  params: Promise<{ programId: string }>;
}

export default function LoyaltyProgramPage(props: LoyaltyProgramPageProps) {
  const params = use(props.params);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<LoyaltyProgramItem[]>([]);
  const [rules, setRules] = useState<LoyaltyProgramRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Fetch menu items from API
        const menuRes = await fetch("/api/menu/items");
        if (!menuRes.ok) throw new Error("Failed to load menu items");
        const menuData = await menuRes.json();
        setMenuItems(menuData);

        // Fetch selected items for this program
        const selectedRes = await fetch(
          `/api/loyalty/programs/${params.programId}/items`
        );
        if (!selectedRes.ok) throw new Error("Failed to load selected items");
        const selectedData = await selectedRes.json();
        setSelectedItems(selectedData);

        // Fetch rules for this program
        const rulesRes = await fetch(
          `/api/loyalty/programs/${params.programId}/rules`
        );
        if (rulesRes.ok) {
          const rulesData = await rulesRes.json();
          setRules(rulesData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [params.programId]);

  const handleSelectionChange = async (itemId: string) => {
    const isSelected = selectedItems.some((item) => item.menu_item_id === itemId);

    if (isSelected) {
      // Remove the item
      const itemToDelete = selectedItems.find(
        (item) => item.menu_item_id === itemId
      );
      if (!itemToDelete) return;

      try {
        const res = await fetch(
          `/api/loyalty/programs/${params.programId}/items/${itemToDelete.id}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Failed to remove item");
        setSelectedItems((prev) =>
          prev.filter((item) => item.menu_item_id !== itemId)
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    } else {
      // Add the item
      try {
        const res = await fetch(
          `/api/loyalty/programs/${params.programId}/items`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ menu_item_id: itemId }),
          }
        );
        if (!res.ok) throw new Error("Failed to add item");
        const newItem = await res.json();
        setSelectedItems((prev) => [...prev, newItem]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }
  };

  const handleAddRule = () => {
    // Placeholder for adding a new rule
    // Full implementation in next task
    console.log("Add rule clicked");
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const res = await fetch(
        `/api/loyalty/programs/${params.programId}/rules/${ruleId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete rule");
      setRules((prev) => prev.filter((rule) => rule.id !== ruleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">Lädt...</div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
        Fehler: {error}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Loyalty-Programm verwalten
        </h1>
        <p className="text-gray-600">
          Verwalten Sie die Regeln und Artikel für dieses Loyalty-Programm.
        </p>
      </div>

      <div className="mb-8">
        <RulesEditor
          rules={rules}
          onAddRule={handleAddRule}
          onDeleteRule={handleDeleteRule}
        />
      </div>

      <div>
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Artikel auswählen
          </h2>
          <p className="text-gray-600 mb-4">
            Wählen Sie die Artikel aus, die Kunden mit diesem Loyalty-Programm
            erhalten können.
          </p>
        </div>
        <ItemsSelector
          menuItems={menuItems}
          selectedItems={selectedItems}
          onSelectionChange={handleSelectionChange}
        />
      </div>
    </div>
  );
}
