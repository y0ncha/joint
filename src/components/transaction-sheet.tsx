"use client";

import { useActionState, useMemo, useState } from "react";

import { createTransaction } from "@/app/actions/transactions";
import type { ActionResult } from "@/app/actions/result";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Category = { id: string; name: string; kind: "income" | "expense" };
type Member = { id: string; label: string };

const displayDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
const transactionKindItemClassName = "transition-[background-color,border-color,color,box-shadow] duration-300 ease-in-out motion-reduce:transition-none data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm hover:data-[state=on]:bg-primary hover:data-[state=on]:text-primary-foreground";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dateFromIso(value: string) {
  return new Date(`${value}T12:00:00`);
}

function isoFromDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function TransactionSheet({
  categories = [],
  currentUserId = "",
  members = [],
}: {
  categories?: Category[];
  currentUserId?: string;
  members?: Member[];
}) {
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(async (_state, formData) => createTransaction(formData), null);
  const selectableCategories = useMemo(() => categories.filter((category) => category.kind === kind), [categories, kind]);
  const [occurredOn, setOccurredOn] = useState(todayIso);
  const [paidBy, setPaidBy] = useState(() => currentUserId || members[0]?.id || "");
  const [categoryId, setCategoryId] = useState(() => categories.find((category) => category.kind === "expense")?.id ?? "");
  const selectedCategoryId = selectableCategories.some((category) => category.id === categoryId) ? categoryId : (selectableCategories[0]?.id ?? "");
  const selectedPaidBy = members.some((member) => member.id === paidBy) ? paidBy : (currentUserId || members[0]?.id || "");

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="rounded-xl">
          <span className="sm:hidden">Add</span>
          <span className="hidden sm:inline">Add transaction</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="inset-x-0 h-full w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl sm:inset-x-auto sm:w-3/4 sm:max-w-lg">
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Add transaction</SheetTitle>
          <SheetDescription>Log shared household money.</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="px-6 pb-6">
          <FieldGroup>
            <input name="kind" type="hidden" value={kind} />
            <input name="occurredOn" type="hidden" value={occurredOn} />
            <input name="categoryId" type="hidden" value={selectedCategoryId} />
            <input name="paidBy" type="hidden" value={selectedPaidBy} />
            <Field>
              <FieldLabel id="transaction-kind-label">Type</FieldLabel>
              <ToggleGroup aria-labelledby="transaction-kind-label" type="single" value={kind} onValueChange={(value) => value && setKind(value as typeof kind)} variant="outline" spacing={0}>
                <ToggleGroupItem value="income" className={transactionKindItemClassName}>Income</ToggleGroupItem>
                <ToggleGroupItem value="expense" className={transactionKindItemClassName}>Expense</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.amount)}>
              <FieldLabel htmlFor="amount">Amount</FieldLabel>
              <Input id="amount" name="amount" inputMode="decimal" required aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.amount)} />
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
              <Select value={selectedPaidBy} onValueChange={setPaidBy} disabled={members.length === 0}>
                <SelectTrigger className="w-full" aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.paidBy)}>
                  <SelectValue placeholder="Choose member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>{member.label}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {state?.status === "error" ? <FieldError>{state.fieldErrors.paidBy}</FieldError> : null}
            </Field>
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.categoryId)}>
              <FieldLabel>Category</FieldLabel>
              <Select value={selectedCategoryId} onValueChange={setCategoryId} disabled={selectableCategories.length === 0}>
                <SelectTrigger className="w-full" aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.categoryId)}>
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {selectableCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {state?.status === "error" ? <FieldError>{state.fieldErrors.categoryId}</FieldError> : null}
            </Field>
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.note)}>
              <FieldLabel htmlFor="note">Note</FieldLabel>
              <Input id="note" name="note" aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.note)} />
              {state?.status === "error" ? <FieldError>{state.fieldErrors.note}</FieldError> : null}
            </Field>
            {state?.status === "error" ? <FieldError>{state.formError}</FieldError> : null}
            <Button disabled={isPending} type="submit" className="rounded-xl">Save transaction</Button>
          </FieldGroup>
        </form>
      </SheetContent>
    </Sheet>
  );
}
