"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";

import { createTransaction, deleteTransaction, updateTransaction } from "@/app/actions/transactions";
import type { ActionResult } from "@/app/actions/result";
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
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PillSelect } from "@/components/pill-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ReportTransaction } from "@/lib/financial-report";

type Category = { id: string; name: string; kind: "income" | "expense"; color?: string };
type Member = { id: string; label: string; color?: string };

const displayDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
const transactionKindItemClassName = "transition-[background-color,border-color,color,box-shadow] duration-300 ease-in-out motion-reduce:transition-none data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm hover:data-[state=on]:bg-primary hover:data-[state=on]:text-primary-foreground";

function todayIso() {
  return dateOnlyFromLocalDate(new Date());
}

function dateFromIso(value: string) {
  return new Date(`${value}T12:00:00`);
}

function isoFromDate(value: Date) {
  return dateOnlyFromLocalDate(value);
}

function dateOnlyFromLocalDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TransactionSheet({
  categories = [],
  currentUserId = "",
  members = [],
  onOpenChange,
  open,
  transaction,
  trigger,
}: {
  categories?: Category[];
  currentUserId?: string;
  members?: Member[];
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  transaction?: ReportTransaction | null;
  trigger?: ReactNode;
}) {
  const initialKind = transaction?.kind === "income" ? "income" : "expense";
  const isEditing = Boolean(transaction);
  const [kind, setKind] = useState<"income" | "expense">(initialKind);
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    async (_state, formData) => (transaction ? updateTransaction(transaction.id, formData) : createTransaction(formData)),
    null,
  );
  const selectableCategories = useMemo(() => categories.filter((category) => category.kind === kind), [categories, kind]);
  const [occurredOn, setOccurredOn] = useState(transaction?.occurredOn ?? todayIso);
  const [paidBy, setPaidBy] = useState(() => transaction?.paidBy ?? currentUserId ?? members[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(() => transaction ? (transaction.categoryId ?? "") : (categories.find((category) => category.kind === initialKind)?.id ?? ""));
  const selectedCategoryId = selectableCategories.some((category) => category.id === categoryId) ? categoryId : "";
  const selectedPaidBy = paidBy === "" ? "" : (members.some((member) => member.id === paidBy) ? paidBy : (currentUserId || members[0]?.id || ""));
  const shouldRenderDefaultTrigger = !isEditing && open === undefined && onOpenChange === undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ?? (shouldRenderDefaultTrigger ? (
        <SheetTrigger asChild>
          <Button size="icon" variant="ghost" className="size-11 rounded-full text-primary hover:bg-primary/10 hover:text-primary" aria-label="Add transaction">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-sm transition-colors group-hover/button:bg-primary">
              <Plus aria-hidden="true" />
            </span>
          </Button>
        </SheetTrigger>
      ) : null)}
      <SheetContent side="right" className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg">
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">{isEditing ? "Edit transaction" : "Add transaction"}</SheetTitle>
          <SheetDescription>{isEditing ? "Update or remove this shared ledger entry." : "Log shared household money."}</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="px-6 pb-6">
          <FieldGroup>
            <input name="kind" type="hidden" value={kind} />
            <input name="occurredOn" type="hidden" value={occurredOn} />
            <input name="categoryId" type="hidden" value={selectedCategoryId} />
            <input name="paidBy" type="hidden" value={selectedPaidBy} />
            <Field>
              <FieldLabel id="transaction-kind-label">Type</FieldLabel>
              <ToggleGroup aria-labelledby="transaction-kind-label" type="single" value={kind} onValueChange={(value) => { if (value) { setKind(value as typeof kind); setCategoryId(""); } }} variant="outline" spacing={0}>
                <ToggleGroupItem value="income" className={transactionKindItemClassName}>Income</ToggleGroupItem>
                <ToggleGroupItem value="expense" className={transactionKindItemClassName}>Expense</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.amount)}>
              <FieldLabel htmlFor="amount">Amount</FieldLabel>
              <Input id="amount" name="amount" inputMode="decimal" required defaultValue={transaction?.amount ?? undefined} aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.amount)} />
              {state?.status === "error" ? <FieldError>{state.fieldErrors.amount}</FieldError> : null}
            </Field>
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.occurredOn)}>
              <FieldLabel id="transaction-date-label">Date</FieldLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="h-11 w-full justify-start rounded-xl bg-white/55" aria-labelledby="transaction-date-label">
                    <span className="sr-only">Choose date</span>
                    {displayDate.format(dateFromIso(occurredOn))}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto rounded-2xl border-white/70 bg-card p-3 shadow-[0_20px_60px_rgba(15,44,55,0.18)]">
                  <Calendar
                    mode="single"
                    selected={dateFromIso(occurredOn)}
                    onSelect={(date) => date && setOccurredOn(isoFromDate(date))}
                    buttonVariant="ghost"
                  />
                </PopoverContent>
              </Popover>
              {state?.status === "error" ? <FieldError>{state.fieldErrors.occurredOn}</FieldError> : null}
            </Field>
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.paidBy)}>
              <FieldLabel>Paid by</FieldLabel>
              <PillSelect ariaLabel="Members" value={selectedPaidBy || "unassigned"} onValueChange={(value) => setPaidBy(value === "unassigned" ? "" : value)} disabled={members.length === 0} options={[{ value: "unassigned", label: "Unassigned" }, ...members.map((member) => ({ value: member.id, label: member.label, color: member.color }))]} />
              {state?.status === "error" ? <FieldError>{state.fieldErrors.paidBy}</FieldError> : null}
            </Field>
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.categoryId)}>
              <FieldLabel>Category</FieldLabel>
              <PillSelect ariaLabel="Categories" value={selectedCategoryId} onValueChange={setCategoryId} disabled={selectableCategories.length === 0} emptyLabel="Uncategorized" options={selectableCategories.map((category) => ({ value: category.id, label: category.name, color: category.color }))} />
              {state?.status === "error" ? <FieldError>{state.fieldErrors.categoryId}</FieldError> : null}
            </Field>
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.merchant)}>
              <FieldLabel htmlFor="merchant">Merchant</FieldLabel>
              <Input id="merchant" name="merchant" defaultValue={transaction?.merchant ?? undefined} aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.merchant)} />
              {state?.status === "error" ? <FieldError>{state.fieldErrors.merchant}</FieldError> : null}
            </Field>
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.note)}>
              <FieldLabel htmlFor="note">Note</FieldLabel>
              <Input id="note" name="note" defaultValue={transaction?.note ?? undefined} aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.note)} />
              {state?.status === "error" ? <FieldError>{state.fieldErrors.note}</FieldError> : null}
            </Field>
            {state?.status === "error" ? <FieldError>{state.formError}</FieldError> : null}
            <Button disabled={isPending} type="submit" className="rounded-xl">{isEditing ? "Save changes" : "Save transaction"}</Button>
          </FieldGroup>
        </form>
        {transaction ? (
          <div className="px-6 pb-6">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="w-full rounded-xl">Delete transaction</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
                  <AlertDialogDescription>This removes the entry from the shared household ledger.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <form action={async () => { await deleteTransaction(transaction.id); }}>
                    <AlertDialogAction type="submit" variant="destructive">Delete transaction</AlertDialogAction>
                  </form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
