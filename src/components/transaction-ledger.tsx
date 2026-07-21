"use client";

import { useState, type KeyboardEvent } from "react";

import { TransactionSheet } from "@/components/transaction-sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReportCategory, ReportTransaction } from "@/lib/financial-report";

const currency = new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS" });
const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export function TransactionLedger({ transactions, categories, members }: { transactions: ReportTransaction[]; categories: ReportCategory[]; members: Array<{ id: string; label: string }> }) {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const memberNames = new Map(members.map((member) => [member.id, member.label]));
  const [selectedTransaction, setSelectedTransaction] = useState<ReportTransaction | null>(null);
  const editableCategories = categories
    .filter((category) => category.archivedAt === null)
    .map((category) => ({ id: category.id, name: category.name, kind: category.kind }));

  function openTransaction(transaction: ReportTransaction) {
    setSelectedTransaction(transaction);
  }

  function openTransactionFromKeyboard(event: KeyboardEvent<HTMLTableRowElement>, transaction: ReportTransaction) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openTransaction(transaction);
  }

  if (transactions.length === 0) {
    return <p className="text-sm text-muted-foreground">No transactions for this month.</p>;
  }

  return (
    <>
    <Table className="min-w-[680px] table-fixed">
      <colgroup>
        <col className="w-[16%]" />
        <col className="w-[13%]" />
        <col className="w-[15%]" />
        <col className="w-[16%]" />
        <col className="w-[25%]" />
        <col className="w-[15%]" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Paid by</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Note</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => (
          <TableRow
            key={transaction.id}
            role="button"
            tabIndex={0}
            aria-label={`Edit ${transaction.merchant || transaction.note || transaction.kind} transaction`}
            className="cursor-pointer outline-none hover:bg-muted/35 focus-visible:bg-muted/45 focus-visible:ring-3 focus-visible:ring-ring/45"
            onClick={() => openTransaction(transaction)}
            onKeyDown={(event) => openTransactionFromKeyboard(event, transaction)}
          >
            <TableCell className="font-mono text-muted-foreground">{date.format(new Date(`${transaction.occurredOn}T00:00:00Z`))}</TableCell>
            <TableCell className="capitalize">{transaction.kind}</TableCell>
            <TableCell className="truncate">{memberNames.get(transaction.paidBy ?? "") ?? "Unassigned"}</TableCell>
            <TableCell className="truncate">{categoryNames.get(transaction.categoryId ?? "") ?? "Uncategorized"}</TableCell>
            <TableCell className="max-w-[14rem] truncate">{transaction.merchant || transaction.note || "-"}{transaction.source === "statement_import" ? " (Imported)" : ""}</TableCell>
            <TableCell className="text-right font-mono">{currency.format(transaction.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    <TransactionSheet
      key={selectedTransaction?.id ?? "transaction-edit"}
      categories={editableCategories}
      members={members}
      open={Boolean(selectedTransaction)}
      onOpenChange={(open) => {
        if (!open) setSelectedTransaction(null);
      }}
      transaction={selectedTransaction}
    />
    </>
  );
}
