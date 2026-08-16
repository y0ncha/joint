import { expect, it } from "vitest";

import { categoryFromRow, subcategoryFromRow, transactionFromRow } from "./finance-types";

it("maps Analytics system keys and Bills service periods", () => {
  expect({
    category: categoryFromRow({
      id: "bills",
      name: "Bills",
      kind: "expense",
      system_key: "bills",
      archived_at: null,
      color: "#ccebef",
      icon: "receipt",
      created_at: "2026-07-30T00:00:00Z",
      household_id: "household-id",
      monthly_budget: null,
      updated_at: "2026-07-30T00:00:00Z",
    }),
    subcategory: subcategoryFromRow({
      id: "electricity",
      name: "Electricity",
      category_id: "bills",
      system_key: null,
      color: "#ccebef",
      icon: null,
      archived_at: null,
      created_at: "2026-07-30T00:00:00Z",
      household_id: "household-id",
      monthly_budget: null,
      updated_at: "2026-07-30T00:00:00Z",
    }),
    transaction: transactionFromRow({
      id: "bill",
      kind: "expense",
      amount: 100,
      occurred_on: "2026-07-31",
      service_period_start: "2026-07-31",
      service_period_end: "2026-08-03",
      subcategory_id: "electricity",
      note: "",
      merchant: "Utility",
      source: "manual",
      created_at: "2026-07-30T00:00:00Z",
      paid_by: null,
      recurring_schedule_id: null,
      scheduled_for: null,
      import_file_hash: null,
      import_row_number: null,
      created_by: "member-id",
      household_id: "household-id",
      updated_at: "2026-07-30T00:00:00Z",
    }),
  }).toMatchObject({
    category: { systemKey: "bills" },
    subcategory: { systemKey: null },
    transaction: { servicePeriodStart: "2026-07-31", servicePeriodEnd: "2026-08-03" },
  });
});

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
      system_key: null,
      monthly_budget: null,
      updated_at: "2026-07-26T00:00:00Z",
    }),
  ).toEqual({
    id: "groceries",
    name: "Groceries",
    categoryId: "food",
    color: "#D8F0D0",
    icon: "shopping-cart",
    archivedAt: null,
    systemKey: null,
  });
});
