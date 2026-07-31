import type { Database } from "@/lib/database.types";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type SubcategoryRow = Database["public"]["Tables"]["subcategories"]["Row"];
type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

function number(value: number) {
  if (!Number.isFinite(value)) throw new Error("Invalid monetary value from the database.");
  return value;
}

export function categoryFromRow(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    systemKey: row.system_key,
    archivedAt: row.archived_at,
    color: row.color,
    icon: row.icon,
  };
}

export function subcategoryFromRow(row: SubcategoryRow) {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    systemKey: row.system_key,
    color: row.color,
    icon: row.icon,
    archivedAt: row.archived_at,
  };
}

export function transactionFromRow(row: TransactionRow) {
  return {
    id: row.id,
    kind: row.kind,
    amount: number(Number(row.amount)),
    occurredOn: row.occurred_on,
    servicePeriodStart: row.service_period_start,
    servicePeriodEnd: row.service_period_end,
    subcategoryId: row.subcategory_id,
    note: row.note,
    merchant: row.merchant,
    source: row.source,
    createdAt: row.created_at,
    paidBy: row.paid_by,
  };
}
