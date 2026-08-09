"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DuplicatePreview } from "@/lib/transaction-duplicates";

const currency = new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS" });
const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function summary(transaction: DuplicatePreview["matches"][number]["candidate"]) {
  return `${transaction.merchant || "No merchant"} · ${currency.format(transaction.amount)} · ${date.format(new Date(`${transaction.occurredOn}T12:00:00`))}`;
}

export function TransactionDuplicatePreviewDialog({
  onConfirm,
  onOpenChange,
  open,
  preview,
}: {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  preview: DuplicatePreview;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {preview.matches.length} possible duplicate{preview.matches.length === 1 ? "" : "s"}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <ul className="flex flex-col gap-3">
          {preview.matches.map(({ candidate, existing }) => (
            <li key={candidate.id} className="rounded-xl border border-border bg-white/60 p-3 text-sm">
              {summary(existing)}
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Edit</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Discard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
