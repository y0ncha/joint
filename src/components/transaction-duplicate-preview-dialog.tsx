"use client";

import { useState } from "react";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import type { DuplicatePreview } from "@/lib/transaction-duplicates";

const currency = new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS" });
const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

function summary(transaction: DuplicatePreview["matches"][number]["candidate"]) {
  return (
    <span className="ml-2 flex min-w-0 flex-wrap gap-x-1" dir="ltr">
      <bdi className="min-w-0 break-words">{transaction.merchant || "No merchant"}</bdi>
      <span className="shrink-0 text-muted-foreground">
        · {currency.format(transaction.amount)} · {date.format(new Date(`${transaction.occurredOn}T12:00:00`))}
      </span>
    </span>
  );
}

export function TransactionDuplicatePreviewDialog({
  onConfirm,
  onOpenChange,
  open,
  preview,
}: {
  onConfirm: (discardedDuplicateIds: string[]) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  preview: DuplicatePreview;
}) {
  const [discardedDuplicateIds, setDiscardedDuplicateIds] = useState(() => new Set(preview.matches.map(({ candidate }) => candidate.id)));
  const discardedCount = discardedDuplicateIds.size;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] data-[size=default]:sm:max-w-5xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {preview.matches.length} possible duplicate{preview.matches.length === 1 ? "" : "s"}
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">Review duplicate transactions.</AlertDialogDescription>
        </AlertDialogHeader>
        <FieldGroup
          className="max-h-[min(50dvh,28rem)] overflow-y-auto overscroll-contain pr-1"
          role="group"
          aria-label="Duplicate transactions"
        >
          {preview.matches.map(({ candidate, existing }) => {
            const id = `discard-duplicate-${candidate.id}`;
            return (
              <Field
                key={candidate.id}
                orientation="horizontal"
                className="items-center rounded-xl border border-border bg-white/60 p-4 text-sm"
              >
                <Checkbox
                  id={id}
                  checked={discardedDuplicateIds.has(candidate.id)}
                  onCheckedChange={(checked) =>
                    setDiscardedDuplicateIds((current) => {
                      const next = new Set(current);
                      if (checked) next.add(candidate.id);
                      else next.delete(candidate.id);
                      return next;
                    })
                  }
                />
                <FieldLabel htmlFor={id} className="min-w-0 flex-1 cursor-pointer font-normal">
                  {summary(existing)}
                </FieldLabel>
              </Field>
            );
          })}
        </FieldGroup>
        <AlertDialogFooter>
          <p className="mr-auto text-sm text-muted-foreground">Unchecked transactions will be imported.</p>
          <AlertDialogCancel>Edit</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm([...discardedDuplicateIds])}>
            {discardedCount ? `Discard ${discardedCount}` : "Import all"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
