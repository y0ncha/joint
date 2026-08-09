"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
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
          <AlertDialogTitle>Possible duplicates</AlertDialogTitle>
          <AlertDialogDescription>Keep the existing transactions and skip the incoming matches?</AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="flex flex-col gap-3">
          {preview.matches.map(({ candidate, existing }) => (
            <li key={candidate.id} className="grid gap-2 rounded-xl border border-border p-3 text-sm sm:grid-cols-2">
              <p>
                <span className="block font-medium">Incoming</span>
                {summary(candidate)}
              </p>
              <p>
                <span className="block font-medium">Existing</span>
                {summary(existing)}
              </p>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Keep existing</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
