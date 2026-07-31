"use client";

import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DateRange } from "react-day-picker";
import { Plus } from "lucide-react";
import { toast } from "sonner";

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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PillSelect } from "@/components/pill-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { categoryIcon } from "@/lib/category-icons";
import type { ReportTransaction } from "@/lib/financial-report";

type Subcategory = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  kind: "income" | "expense";
  color: string;
  icon: string | null;
  categorySystemKey?: string | null;
  systemKey?: string | null;
};
type Member = { id: string; label: string; color?: string };

const displayDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
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

function billingPeriodFor(occurredOn: string): DateRange {
  const date = dateFromIso(occurredOn);
  return { from: date, to: date };
}

export function TransactionSheet({
  subcategories = [],
  currentUserId = "",
  members = [],
  onOpenChange,
  open,
  transaction,
  trigger,
}: {
  subcategories?: Subcategory[];
  currentUserId?: string;
  members?: Member[];
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  transaction?: ReportTransaction | null;
  trigger?: ReactNode;
}) {
  const initialKind = transaction?.kind === "income" ? "income" : "expense";
  const isEditing = Boolean(transaction);
  const initialOccurredOn = transaction?.occurredOn ?? todayIso();
  const initialSubcategoryId = transaction
    ? (transaction.subcategoryId ?? "")
    : (subcategories.find((subcategory) => subcategory.kind === initialKind)?.id ?? "");
  const [kind, setKind] = useState<"income" | "expense">(initialKind);
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    async (_state, formData) => (transaction ? updateTransaction(transaction.id, formData) : createTransaction(formData)),
    null,
  );
  useEffect(() => {
    if (state?.status === "success") toast.success(isEditing ? "Transaction updated" : "Transaction added", { id: "transaction-save" });
    if (state?.status === "error") toast.error(state.formError, { id: "transaction-save" });
  }, [isEditing, state]);
  const selectableSubcategories = useMemo(() => subcategories.filter((subcategory) => subcategory.kind === kind), [subcategories, kind]);
  const [occurredOn, setOccurredOn] = useState(initialOccurredOn);
  const [paidBy, setPaidBy] = useState(() => transaction?.paidBy ?? currentUserId ?? members[0]?.id ?? "");
  const [subcategoryId, setSubcategoryId] = useState(initialSubcategoryId);
  const selectedSubcategoryId = selectableSubcategories.some((subcategory) => subcategory.id === subcategoryId) ? subcategoryId : "";
  const selectedSubcategory = selectableSubcategories.find((subcategory) => subcategory.id === selectedSubcategoryId);
  const isBillsSubcategory = selectedSubcategory?.categorySystemKey === "bills" || selectedSubcategory?.systemKey === "bills";
  const [billingPeriod, setBillingPeriod] = useState<DateRange | undefined>(() => {
    const initialSubcategory = subcategories.find((subcategory) => subcategory.id === initialSubcategoryId);
    const isBills = initialSubcategory?.categorySystemKey === "bills" || initialSubcategory?.systemKey === "bills";
    if (!isBills) return undefined;
    return {
      from: dateFromIso(transaction?.servicePeriodStart ?? initialOccurredOn),
      to: dateFromIso(transaction?.servicePeriodEnd ?? transaction?.servicePeriodStart ?? initialOccurredOn),
    };
  });
  const selectedPaidBy =
    paidBy === "" ? "" : members.some((member) => member.id === paidBy) ? paidBy : currentUserId || members[0]?.id || "";
  const shouldRenderDefaultTrigger = !isEditing && open === undefined && onOpenChange === undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ??
        (shouldRenderDefaultTrigger ? (
          <SheetTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-11 rounded-full text-primary hover:bg-primary/10 hover:text-primary"
              aria-label="Add transaction"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-sm transition-colors group-hover/button:bg-primary">
                <Plus aria-hidden="true" />
              </span>
            </Button>
          </SheetTrigger>
        ) : null)}
      <SheetContent
        side="right"
        className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg"
      >
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">{isEditing ? "Edit transaction" : "Add transaction"}</SheetTitle>
          <SheetDescription>{isEditing ? "Update or remove this shared ledger entry." : "Log shared household money."}</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="px-6 pb-6">
          <FieldGroup>
            <input name="kind" type="hidden" value={kind} />
            <input name="occurredOn" type="hidden" value={occurredOn} />
            <input name="subcategoryId" type="hidden" value={selectedSubcategoryId} />
            <input name="paidBy" type="hidden" value={selectedPaidBy} />
            <input name="servicePeriodStart" type="hidden" value={billingPeriod?.from ? isoFromDate(billingPeriod.from) : ""} />
            <input name="servicePeriodEnd" type="hidden" value={billingPeriod?.to ? isoFromDate(billingPeriod.to) : ""} />
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.amount)}>
              <FieldLabel htmlFor="amount">Amount</FieldLabel>
              <Input
                id="amount"
                name="amount"
                inputMode="decimal"
                required
                defaultValue={transaction?.amount ?? undefined}
                aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.amount)}
              />
              {state?.status === "error" ? <FieldError>{state.fieldErrors.amount}</FieldError> : null}
            </Field>
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.occurredOn)}>
              <FieldLabel id="transaction-date-label">Date</FieldLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full justify-start rounded-xl bg-white/55"
                    aria-labelledby="transaction-date-label"
                  >
                    <span className="sr-only">Choose date</span>
                    {displayDate.format(dateFromIso(occurredOn))}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-auto rounded-2xl border-white/70 bg-card p-3 shadow-[0_20px_60px_rgba(15,44,55,0.18)]"
                >
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
            <Field>
              <FieldLabel>Type</FieldLabel>
              <PillSelect
                ariaLabel="Type"
                value={kind}
                onValueChange={(value) => {
                  setKind(value as typeof kind);
                  setSubcategoryId("");
                  setBillingPeriod(undefined);
                }}
                options={[
                  { value: "income", label: "Income", className: "border-positive/20 bg-positive/10 text-positive" },
                  { value: "expense", label: "Expense", className: "border-negative/20 bg-negative/10 text-negative" },
                ]}
              />
            </Field>
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.paidBy)}>
              <FieldLabel>Paid by</FieldLabel>
              <PillSelect
                ariaLabel="Members"
                value={selectedPaidBy || "unassigned"}
                onValueChange={(value) => setPaidBy(value === "unassigned" ? "" : value)}
                disabled={members.length === 0}
                options={[
                  { value: "unassigned", label: "Unassigned" },
                  ...members.map((member) => ({ value: member.id, label: member.label, color: member.color })),
                ]}
              />
              {state?.status === "error" ? <FieldError>{state.fieldErrors.paidBy}</FieldError> : null}
            </Field>
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.subcategoryId)}>
              <FieldLabel>Category</FieldLabel>
              <PillSelect
                ariaLabel="Categories"
                value={selectedSubcategoryId}
                onValueChange={(value) => {
                  setSubcategoryId(value);
                  setBillingPeriod((current) =>
                    selectableSubcategories.find((subcategory) => subcategory.id === value)?.systemKey === "bills"
                      ? (current ?? billingPeriodFor(occurredOn))
                      : undefined,
                  );
                }}
                disabled={selectableSubcategories.length === 0}
                emptyLabel="Uncategorized"
                options={selectableSubcategories.map((subcategory) => ({
                  value: subcategory.id,
                  label: `${subcategory.categoryName} → ${subcategory.name}`,
                  color: subcategory.color,
                  icon: categoryIcon(subcategory.icon),
                }))}
              />
              {state?.status === "error" ? <FieldError>{state.fieldErrors.subcategoryId}</FieldError> : null}
            </Field>
            {isBillsSubcategory ? (
              <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.servicePeriodEnd)}>
                <FieldLabel id="billing-period-label">Billing period</FieldLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full justify-start rounded-xl bg-white/55"
                      aria-label="Choose billing period"
                      aria-describedby="billing-period-feedback"
                    >
                      {billingPeriod?.from && billingPeriod.to
                        ? `${displayDate.format(billingPeriod.from)} – ${displayDate.format(billingPeriod.to)}`
                        : "Choose billing period"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-auto max-w-[calc(100vw-2rem)] rounded-2xl border-white/70 bg-card p-3 shadow-[0_20px_60px_rgba(15,44,55,0.18)]"
                  >
                    <FieldGroup className="grid grid-cols-2 gap-3">
                      <Field>
                        <FieldLabel htmlFor="billing-period-from">From</FieldLabel>
                        <Input id="billing-period-from" value={billingPeriod?.from ? isoFromDate(billingPeriod.from) : ""} readOnly />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="billing-period-to">To</FieldLabel>
                        <Input id="billing-period-to" value={billingPeriod?.to ? isoFromDate(billingPeriod.to) : ""} readOnly />
                      </Field>
                    </FieldGroup>
                    <Calendar mode="range" selected={billingPeriod} onSelect={setBillingPeriod} buttonVariant="ghost" />
                  </PopoverContent>
                </Popover>
                <FieldDescription id="billing-period-feedback" aria-live="polite">
                  {billingPeriod?.from && billingPeriod.to
                    ? `Inclusive range from ${isoFromDate(billingPeriod.from)} to ${isoFromDate(billingPeriod.to)}.`
                    : "Choose an inclusive range."}
                </FieldDescription>
                {state?.status === "error" ? <FieldError>{state.fieldErrors.servicePeriodEnd}</FieldError> : null}
              </Field>
            ) : null}
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.merchant)}>
              <FieldLabel htmlFor="merchant">Merchant</FieldLabel>
              <Input
                id="merchant"
                name="merchant"
                defaultValue={transaction?.merchant ?? undefined}
                aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.merchant)}
              />
              {state?.status === "error" ? <FieldError>{state.fieldErrors.merchant}</FieldError> : null}
            </Field>
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.note)}>
              <FieldLabel htmlFor="note">Note</FieldLabel>
              <Textarea
                id="note"
                name="note"
                rows={4}
                className="bg-white/55"
                defaultValue={transaction?.note ?? undefined}
                aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.note)}
              />
              {state?.status === "error" ? <FieldError>{state.fieldErrors.note}</FieldError> : null}
            </Field>
            <Button disabled={isPending} type="submit" className="rounded-xl">
              {isEditing ? "Save changes" : "Save transaction"}
            </Button>
          </FieldGroup>
        </form>
        {transaction ? (
          <div className="px-6 pb-6">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="w-full rounded-xl">
                  Delete transaction
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
                  <AlertDialogDescription>This removes the entry from the shared household ledger.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <form
                    action={async () => {
                      await deleteTransaction(transaction.id);
                    }}
                  >
                    <AlertDialogAction type="submit" variant="destructive">
                      Delete transaction
                    </AlertDialogAction>
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
