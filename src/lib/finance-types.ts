import type { Database } from "@/lib/database.types";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

function number(value: number) {
  if (!Number.isFinite(value)) throw new Error("Invalid monetary value from the database.");
  return value;
}

export function categoryFromRow(row: CategoryRow) {
  return { id: row.id, name: row.name, kind: row.kind, archivedAt: row.archived_at };
}

export function transactionFromRow(row: TransactionRow) {
  return { id: row.id, kind: row.kind, amount: number(Number(row.amount)), occurredOn: row.occurred_on, categoryId: row.category_id, note: row.note, merchant: row.merchant, source: row.source, createdAt: row.created_at, paidBy: row.paid_by };
}
