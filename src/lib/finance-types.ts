import type { Database } from "@/lib/database.types";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

function number(value: number) {
  if (!Number.isFinite(value)) throw new Error("Invalid monetary value from the database.");
  return value;
}

export function accountFromRow(row: AccountRow) {
  return { id: row.id, name: row.name, kind: row.kind, openingBalance: number(Number(row.opening_balance)), openingBalanceDate: row.opening_balance_date, archivedAt: row.archived_at };
}

export function categoryFromRow(row: CategoryRow) {
  return { id: row.id, name: row.name, kind: row.kind, archivedAt: row.archived_at };
}

export function transactionFromRow(row: TransactionRow) {
  return { id: row.id, kind: row.kind, amount: number(Number(row.amount)), occurredOn: row.occurred_on, accountId: row.account_id, destinationAccountId: row.destination_account_id, categoryId: row.category_id, note: row.note, createdAt: row.created_at, paidBy: row.paid_by };
}
