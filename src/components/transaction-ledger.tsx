"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { deleteTransactions } from "@/app/actions/transactions";
import { TransactionSheet } from "@/components/transaction-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LedgerFilterKind, LedgerSort } from "@/components/ledger-controls";
import type { ReportCategory, ReportTransaction } from "@/lib/financial-report";

const currency = new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS" });
const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export function TransactionLedger({ transactions, categories, filterKind = "all", members, sort = "date-desc" }: { transactions: ReportTransaction[]; categories: ReportCategory[]; filterKind?: LedgerFilterKind; members: Array<{ id: string; label: string; color?: string }>; sort?: LedgerSort }) {
  const categoryNames = new Map(categories.map((category) => [category.id, category]));
  const memberNames = new Map(members.map((member) => [member.id, member]));
  const [selectedTransaction, setSelectedTransaction] = useState<ReportTransaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, startDeleting] = useTransition();
  const editableCategories = categories
    .filter((category) => category.archivedAt === null)
    .map((category) => ({ id: category.id, name: category.name, kind: category.kind, color: category.color }));

  function openTransaction(transaction: ReportTransaction) {
    setSelectedTransaction(transaction);
  }

  const visibleTransactions = transactions
    .filter((transaction) => filterKind === "all" || transaction.kind === filterKind)
    .sort((left, right) => sort === "date-asc"
      ? left.occurredOn.localeCompare(right.occurredOn) || left.createdAt.localeCompare(right.createdAt)
      : sort === "amount-desc"
        ? right.amount - left.amount
        : sort === "amount-asc"
          ? left.amount - right.amount
          : right.occurredOn.localeCompare(left.occurredOn) || right.createdAt.localeCompare(left.createdAt));

  function toggleSelected(id: string) {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((selectedId) => selectedId !== id) : [...ids, id]);
  }

  function toggleAll() {
    setSelectedIds(selectedIds.length === visibleTransactions.length ? [] : visibleTransactions.map((transaction) => transaction.id));
  }

  if (visibleTransactions.length === 0) {
    return <p className="text-sm text-muted-foreground">No transactions for this month.</p>;
  }

  return (
    <>
    <Table className="min-w-[680px] table-fixed">
      <colgroup>
        <col className="w-11" />
        <col className="w-[16%]" />
        <col className="w-[13%]" />
        <col className="w-[15%]" />
        <col className="w-[16%]" />
        <col className="w-[25%]" />
        <col className="w-[15%]" />
        <col className="w-11" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead><div className="flex min-h-11 min-w-11 items-center justify-center"><Checkbox aria-label="Select all transactions" checked={selectedIds.length > 0 && selectedIds.length === visibleTransactions.length} onCheckedChange={toggleAll} className="after:-inset-4" /></div></TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Paid by</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Note</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead><span className="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visibleTransactions.map((transaction) => (
          <TableRow key={transaction.id}>
            <TableCell><div className="flex min-h-11 min-w-11 items-center justify-center"><Checkbox aria-label={`Select ${transaction.merchant || transaction.note || transaction.kind} transaction`} checked={selectedIds.includes(transaction.id)} onCheckedChange={() => toggleSelected(transaction.id)} className="after:-inset-4" /></div></TableCell>
            <TableCell className="font-mono text-muted-foreground">{date.format(new Date(`${transaction.occurredOn}T00:00:00Z`))}</TableCell>
            <TableCell><Badge className={transaction.kind === "income" ? "border-positive/20 bg-positive/10 text-positive" : "border-negative/20 bg-negative/10 text-negative"}>{transaction.kind}</Badge></TableCell>
            <TableCell className="truncate">{(() => { const member = memberNames.get(transaction.paidBy ?? ""); return <Badge color={member?.color} className={member ? "max-w-full truncate" : "max-w-full truncate border-muted-foreground/20 bg-muted text-muted-foreground"}>{member?.label ?? "Unassigned"}</Badge>; })()}</TableCell>
            <TableCell className="truncate">{(() => { const category = categoryNames.get(transaction.categoryId ?? ""); return <Badge color={category?.color} className={category ? "max-w-full truncate" : "max-w-full truncate border-muted-foreground/20 bg-muted text-muted-foreground"}>{category?.name ?? "Uncategorized"}</Badge>; })()}</TableCell>
            <TableCell className="max-w-[14rem] truncate">{transaction.merchant || transaction.note || "-"}</TableCell>
            <TableCell className="text-right font-mono">{currency.format(transaction.amount)}</TableCell>
            <TableCell><Button type="button" size="icon" variant="ghost" className="size-11" aria-label={`Edit ${transaction.merchant || transaction.note || transaction.kind} transaction`} onClick={() => openTransaction(transaction)}><Pencil aria-hidden="true" /></Button></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-live="polite">
      <p className="text-sm text-muted-foreground">{selectedIds.length} selected</p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="size-11 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label="Delete selected transactions" disabled={selectedIds.length === 0 || isDeleting}><Trash2 aria-hidden="true" /></Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected transactions?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes {selectedIds.length} transaction{selectedIds.length === 1 ? "" : "s"} from the shared household ledger.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" variant="destructive" onClick={() => startDeleting(async () => {
              const result = await deleteTransactions(selectedIds);
              if (result.status === "error") setDeleteError(result.formError);
              else setSelectedIds([]);
            })} className="min-h-11">Delete transactions</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {deleteError ? <p className="w-full text-sm text-destructive">{deleteError}</p> : null}
    </div>
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
