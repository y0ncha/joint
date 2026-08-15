"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Clock3, Pencil, Trash2 } from "lucide-react";

import { deleteTransactions } from "@/app/actions/transactions";
import { CategoryIcon } from "@/components/category-icon-picker";
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
import type { ReportTransaction } from "@/lib/financial-report";
import type { DateRange } from "@/lib/date-range";
import { defaultLedgerFilterState, readLedgerFilterState, type LedgerFilterKind, type LedgerSort } from "@/lib/ledger-filters";

const currency = new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS" });
const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export function getLedgerShortcutAction(key: string, selectedCount: number) {
  if (selectedCount === 0) return null;
  if (key === "Delete" || key === "Backspace") return "confirm-delete";
  return key === "Escape" ? "clear-selection" : null;
}

export function TransactionLedger({
  transactions,
  subcategories = [],
  directCategories = [],
  categoryIds = [],
  dateRange,
  filterKind = "all",
  members,
  paidByIds = [],
  sort = "date-desc",
}: {
  transactions: ReportTransaction[];
  subcategories?: Array<{
    id: string;
    name: string;
    categoryId: string;
    categoryName: string;
    kind: "income" | "expense";
    color: string;
    icon: string | null;
    archivedAt: string | null;
    categoryArchivedAt: string | null;
  }>;
  directCategories?: Array<{
    id: string;
    name: string;
    kind: "income" | "expense";
    color: string;
    icon?: string | null;
    systemKey?: string | null;
  }>;
  categoryIds?: string[];
  dateRange?: DateRange;
  filterKind?: LedgerFilterKind;
  members: Array<{ id: string; label: string; color?: string }>;
  paidByIds?: string[];
  sort?: LedgerSort;
}) {
  const searchParams = useSearchParams();
  const [activeState, setActiveState] = useState(() => readLedgerFilterState(searchParams, { categoryIds, filterKind, paidByIds, sort }));
  const { categoryIds: activeCategoryIds, filterKind: activeFilterKind, paidByIds: activePaidByIds, sort: activeSort } = activeState;
  useEffect(() => {
    const sync = () => setActiveState(readLedgerFilterState(new URLSearchParams(window.location.search), defaultLedgerFilterState));
    window.addEventListener("ledger-filter-change", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("ledger-filter-change", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  const subcategoriesById = new Map(subcategories.map((subcategory) => [subcategory.id, subcategory]));
  const directCategoriesById = new Map(directCategories.map((category) => [category.id, category]));
  const memberNames = new Map(members.map((member) => [member.id, member]));
  const [selectedTransaction, setSelectedTransaction] = useState<ReportTransaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, startDeleting] = useTransition();
  const editableSubcategories = subcategories.filter(
    (subcategory) => subcategory.archivedAt === null && subcategory.categoryArchivedAt === null,
  );

  function openTransaction(transaction: ReportTransaction) {
    setSelectedTransaction(transaction);
  }

  const visibleTransactions = transactions
    .filter((transaction) => !dateRange || (transaction.occurredOn >= dateRange.from && transaction.occurredOn <= dateRange.to))
    .filter((transaction) => activeFilterKind === "all" || transaction.kind === activeFilterKind)
    .filter(
      (transaction) =>
        activeCategoryIds.length === 0 ||
        activeCategoryIds.includes(
          transaction.categoryId ?? subcategoriesById.get(transaction.subcategoryId ?? "")?.categoryId ?? "uncategorized",
        ),
    )
    .filter((transaction) => activePaidByIds.length === 0 || activePaidByIds.includes(transaction.paidBy ?? "unassigned"))
    .sort((left, right) =>
      activeSort === "date-asc"
        ? left.occurredOn.localeCompare(right.occurredOn) || left.createdAt.localeCompare(right.createdAt)
        : activeSort === "amount-desc"
          ? right.amount - left.amount
          : activeSort === "amount-asc"
            ? left.amount - right.amount
            : right.occurredOn.localeCompare(left.occurredOn) || right.createdAt.localeCompare(left.createdAt),
    );

  function toggleSelected(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((selectedId) => selectedId !== id) : [...ids, id]));
  }

  function toggleAll() {
    setSelectedIds(selectedIds.length === visibleTransactions.length ? [] : visibleTransactions.map((transaction) => transaction.id));
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        isDeleteDialogOpen ||
        !(event.target instanceof HTMLElement) ||
        event.target.closest("input, textarea, select, [contenteditable='true']")
      )
        return;
      const action = getLedgerShortcutAction(event.key, selectedIds.length);
      if (action === "confirm-delete") {
        event.preventDefault();
        setIsDeleteDialogOpen(true);
      }
      if (action === "clear-selection") {
        event.preventDefault();
        setSelectedIds([]);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDeleteDialogOpen, selectedIds.length]);

  if (visibleTransactions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {dateRange ? "No transactions for this date range." : "No transactions for this month."}
      </p>
    );
  }

  return (
    <>
      <Table className="min-w-[840px]">
        <TableHeader>
          <TableRow>
            <TableHead>
              <div className="flex min-h-11 min-w-11 items-center justify-center">
                <Checkbox
                  aria-label="Select all transactions"
                  checked={selectedIds.length > 0 && selectedIds.length === visibleTransactions.length}
                  onCheckedChange={toggleAll}
                  className="after:-inset-4"
                />
              </div>
            </TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Paid by</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Merchant</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleTransactions.map((transaction) => (
            <TableRow
              key={transaction.id}
              className="hover:bg-foreground/5 data-[state=selected]:bg-foreground/10"
              data-state={selectedIds.includes(transaction.id) ? "selected" : undefined}
            >
              <TableCell>
                <div className="flex min-h-11 min-w-11 items-center justify-center">
                  <Checkbox
                    aria-label={`Select ${transaction.merchant || transaction.note || transaction.kind} transaction`}
                    checked={selectedIds.includes(transaction.id)}
                    onCheckedChange={() => toggleSelected(transaction.id)}
                    className="after:-inset-4"
                  />
                </div>
              </TableCell>
              <TableCell className="font-mono text-muted-foreground">
                {date.format(new Date(`${transaction.occurredOn}T00:00:00Z`))}
              </TableCell>
              <TableCell>
                <Badge
                  className={
                    transaction.kind === "income"
                      ? "border-positive/20 bg-positive/10 text-positive"
                      : "border-negative/20 bg-negative/10 text-negative"
                  }
                >
                  {transaction.kind}
                </Badge>
              </TableCell>
              <TableCell className="truncate">
                {(() => {
                  const member = memberNames.get(transaction.paidBy ?? "");
                  return (
                    <Badge
                      color={member?.color}
                      className={
                        member ? "max-w-full truncate" : "max-w-full truncate border-muted-foreground/20 bg-muted text-muted-foreground"
                      }
                    >
                      {member?.label ?? "Unassigned"}
                    </Badge>
                  );
                })()}
              </TableCell>
              <TableCell className="truncate">
                {(() => {
                  const subcategory = subcategoriesById.get(transaction.subcategoryId ?? "");
                  const directCategory = directCategoriesById.get(transaction.categoryId ?? "");
                  const category = subcategory ?? directCategory;
                  return (
                    <Badge
                      color={category?.color ? `color-mix(in srgb, ${category.color} 55%, var(--card))` : undefined}
                      className={
                        subcategory
                          ? "max-w-full truncate"
                          : "max-w-full truncate border-muted-foreground/20 bg-muted text-muted-foreground"
                      }
                    >
                      {category ? <CategoryIcon name={category.icon} data-icon="inline-start" /> : null}
                      {category?.name ?? "Uncategorized"}
                    </Badge>
                  );
                })()}
              </TableCell>
              <TableCell className="max-w-[14rem] truncate">{transaction.merchant || "-"}</TableCell>
              <TableCell className="font-mono">
                <span className="flex items-center justify-end gap-1">
                  {transaction.recurringScheduleId ? (
                    <>
                      <Clock3 aria-hidden="true" className="size-3" />
                      <span className="sr-only">Recurring transaction</span>
                    </>
                  ) : null}
                  {currency.format(transaction.amount)}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-11"
                  aria-label={`Edit ${transaction.merchant || transaction.note || transaction.kind} transaction`}
                  onClick={() => openTransaction(transaction)}
                >
                  <Pencil aria-hidden="true" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <p className="text-sm text-muted-foreground">{selectedIds.length} selected</p>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 text-destructive"
              aria-label="Delete selected transactions"
              disabled={selectedIds.length === 0 || isDeleting}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete selected transactions?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes {selectedIds.length} transaction{selectedIds.length === 1 ? "" : "s"} from the shared household
                ledger.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11">Cancel</AlertDialogCancel>
              <AlertDialogAction
                type="button"
                variant="destructive"
                onClick={() =>
                  startDeleting(async () => {
                    const result = await deleteTransactions(selectedIds);
                    if (result.status === "error") setDeleteError(result.formError);
                    else setSelectedIds([]);
                  })
                }
                className="min-h-11"
              >
                Delete transactions
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {deleteError ? <p className="w-full text-sm text-destructive">{deleteError}</p> : null}
      </div>
      <TransactionSheet
        directCategories={directCategories}
        key={selectedTransaction?.id ?? "transaction-edit"}
        subcategories={editableSubcategories}
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
