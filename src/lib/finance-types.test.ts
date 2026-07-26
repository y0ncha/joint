import { expect, it } from "vitest";

import { subcategoryFromRow } from "./finance-types";

it("retains a subcategory row's persisted color and optional icon", () => {
  expect(
    subcategoryFromRow({
      id: "groceries",
      name: "Groceries",
      category_id: "food",
      color: "#D8F0D0",
      icon: "shopping-cart",
      archived_at: null,
      created_at: "2026-07-26T00:00:00Z",
      household_id: "household-id",
      updated_at: "2026-07-26T00:00:00Z",
    }),
  ).toEqual({
    id: "groceries",
    name: "Groceries",
    categoryId: "food",
    color: "#D8F0D0",
    icon: "shopping-cart",
    archivedAt: null,
  });
});
