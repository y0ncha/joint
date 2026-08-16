"use client";

import { startTransition, useActionState, useEffect, useMemo, useReducer, useRef, useState, useTransition, type ReactNode } from "react";
import { CalendarRange, CircleStop, Pause, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createTransaction, deleteTransaction, updateTransaction } from "@/app/actions/transactions";
import {
  pauseRecurringTransactionSchedule,
  resumeRecurringTransactionSchedule,
  stopRecurringTransactionSchedule,
} from "@/app/actions/recurring-transactions";
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { TransactionDuplicatePreviewDialog } from "@/components/transaction-duplicate-preview-dialog";
import { AutomationPreviewDialog } from "@/components/automation-rules-workspace";
import { RecurringScheduleFields, type RecurrenceCadence } from "@/components/recurring-schedule-fields";
import { categoryIcon } from "@/lib/category-icons";
import { Badge } from "@/components/ui/badge";
import type { ReportTransaction } from "@/lib/financial-report";
import {
  initializeTransactionDraft,
  projectTransactionDraftFields,
  transactionDraftReducer,
  type TransactionDestination,
} from "@/lib/transaction-draft";
import { automationPreviewDestinations } from "@/lib/automation-preview-destinations";

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
type DirectCategory = {
  id: string;
  name: string;
  kind: "income" | "expense";
  color: string;
  icon?: string | null;
  systemKey?: string | null;
};

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

export function TransactionSheet({
  subcategories = [],
  directCategories = [],
  currentUserId = "",
  members = [],
  defaultMonth,
  onOpenChange,
  open,
  transaction,
  trigger,
}: {
  subcategories?: Subcategory[];
  directCategories?: DirectCategory[];
  currentUserId?: string;
  members?: Member[];
  defaultMonth?: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  transaction?: ReportTransaction | null;
  trigger?: ReactNode;
}) {
  const initialKind = transaction?.kind === "income" ? "income" : "expense";
  const isEditing = Boolean(transaction);
  const isRecurring = Boolean(transaction?.recurringScheduleId);
  const initialOccurredOn = transaction?.occurredOn ?? todayIso();
  const calendarDefaultMonth = dateFromIso(
    `${(transaction ? initialOccurredOn : (defaultMonth ?? initialOccurredOn.slice(0, 7))).slice(0, 7)}-01`,
  );
  const initialSubcategoryId = transaction?.subcategoryId ?? "";
  const initialSubcategory = subcategories.find((subcategory) => subcategory.id === initialSubcategoryId);
  const [sheetContent, setSheetContent] = useState<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const submittedFormData = useRef<FormData | null>(null);
  const [dismissedDuplicatePreview, setDismissedDuplicatePreview] = useState("");
  const [dismissedAutomationPreview, setDismissedAutomationPreview] = useState("");
  const [recurringUpdate, setRecurringUpdate] = useState<FormData | null>(null);
  const [recurrenceCadence, setRecurrenceCadence] = useState<RecurrenceCadence>(
    transaction?.recurrenceCadence ?? (isRecurring ? "monthly" : ""),
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState(String(transaction?.recurrenceInterval ?? 1));
  const [isSchedulePending, startScheduleTransition] = useTransition();
  const [draft, dispatchDraft] = useReducer(
    transactionDraftReducer,
    {
      kind: initialKind,
      occurredOn: initialOccurredOn,
      paidBy: transaction?.paidBy ?? currentUserId ?? members[0]?.id ?? "",
      categoryId: transaction?.categoryId ?? "",
      subcategoryId: initialSubcategoryId,
      isBillsSubcategory: initialSubcategory?.categorySystemKey === "bills",
      servicePeriodStart: transaction?.servicePeriodStart,
      servicePeriodEnd: transaction?.servicePeriodEnd,
    },
    initializeTransactionDraft,
  );
  const { kind, occurredOn, paidBy } = draft;
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    async (_state, formData) => (transaction ? updateTransaction(transaction.id, formData) : createTransaction(formData)),
    null,
  );
  function resetDiscardedTransaction() {
    formRef.current?.reset();
    dispatchDraft({ type: "kind_changed", kind: initialKind });
    dispatchDraft({ type: "occurred_on_changed", occurredOn: initialOccurredOn });
    dispatchDraft({ type: "paid_by_changed", paidBy: currentUserId || members[0]?.id || "" });
    setRecurrenceCadence(transaction?.recurrenceCadence ?? (isRecurring ? "monthly" : ""));
    setRecurrenceInterval(String(transaction?.recurrenceInterval ?? 1));
  }
  useEffect(() => {
    if (state?.status === "success") {
      toast.success(
        state.data?.skippedDuplicateCount ? "Existing transaction kept" : isEditing ? "Transaction updated" : "Transaction added",
        {
          id: "transaction-save",
        },
      );
    }
    if (state?.status === "error") toast.error(state.formError, { id: "transaction-save" });
  }, [isEditing, state]);
  const selectableSubcategories = useMemo(() => subcategories.filter((subcategory) => subcategory.kind === kind), [subcategories, kind]);
  const subcategoryId = draft.destination?.type === "subcategory" ? draft.destination.id : "";
  const categoryId = draft.destination?.type === "category" ? draft.destination.id : "";
  const selectedSubcategoryId = selectableSubcategories.some((subcategory) => subcategory.id === subcategoryId) ? subcategoryId : "";
  const selectedSubcategory = selectableSubcategories.find((subcategory) => subcategory.id === selectedSubcategoryId);
  const selectableCategories = useMemo(() => directCategories.filter((category) => category.kind === kind), [directCategories, kind]);
  const selectedCategoryId = selectableCategories.some((category) => category.id === categoryId) ? categoryId : "";
  const isBillsSubcategory = selectedSubcategory?.categorySystemKey === "bills";
  const billingPeriod = draft.servicePeriod
    ? { from: dateFromIso(draft.servicePeriod.start), to: dateFromIso(draft.servicePeriod.end) }
    : undefined;
  const [billingPeriodStartOpen, setBillingPeriodStartOpen] = useState(false);
  const [billingPeriodEndOpen, setBillingPeriodEndOpen] = useState(false);
  const billingPeriodError =
    state?.status === "error" ? (state.fieldErrors.servicePeriodStart ?? state.fieldErrors.servicePeriodEnd) : undefined;
  const selectedPaidBy =
    paidBy === "" ? "" : members.some((member) => member.id === paidBy) ? paidBy : currentUserId || members[0]?.id || "";
  const draftFields = projectTransactionDraftFields(draft, {
    categoryIds: selectableCategories.map((category) => category.id),
    subcategoryIds: selectableSubcategories.map((subcategory) => subcategory.id),
    memberIds: members.map((member) => member.id),
    defaultPaidBy: currentUserId || members[0]?.id || "",
  });
  const recurrenceFieldsVisible = !isEditing || transaction?.source !== "statement_import";
  const recurringIdentityChanged =
    isRecurring && (draftFields.kind !== transaction?.kind || draftFields.occurredOn !== transaction?.occurredOn);
  const shouldRenderDefaultTrigger = !isEditing && open === undefined && onOpenChange === undefined;
  const duplicatePreview = state?.status === "confirmation_required" ? state.duplicatePreview : null;
  const duplicatePreviewOpen = Boolean(duplicatePreview && dismissedDuplicatePreview !== duplicatePreview.fingerprint);
  const automationPreview = state?.status === "automation_confirmation_required" ? state.automationPreview : null;
  const automationPreviewOpen = Boolean(automationPreview && dismissedAutomationPreview !== automationPreview.fingerprint);
  const automationDestinations = useMemo(
    () => automationPreviewDestinations(subcategories, directCategories),
    [directCategories, subcategories],
  );

  function confirmDuplicates(discardedDuplicateIds: string[]) {
    if (!duplicatePreview || !submittedFormData.current) return;
    const confirmed = new FormData();
    submittedFormData.current.forEach((value, key) => confirmed.append(key, value));
    confirmed.set("duplicateFingerprint", duplicatePreview.fingerprint);
    discardedDuplicateIds.forEach((candidateId) => confirmed.append("discardDuplicateId", candidateId));
    setDismissedDuplicatePreview(duplicatePreview.fingerprint);
    if (!isEditing && discardedDuplicateIds.includes("manual")) resetDiscardedTransaction();
    startTransition(() => formAction(confirmed));
  }

  function confirmAutomationPreview() {
    if (!automationPreview || !submittedFormData.current) return;
    const confirmed = new FormData();
    submittedFormData.current.forEach((value, key) => confirmed.append(key, value));
    confirmed.set("automationFingerprint", automationPreview.fingerprint);
    startTransition(() => formAction(confirmed));
  }

  function submitRecurringScope(scope: "this" | "future" | "all") {
    if (!recurringUpdate || !transaction) return;
    const update = new FormData();
    recurringUpdate.forEach((value, key) => update.append(key, value));
    update.set("recurrenceScope", scope);
    if (scope === "this") {
      update.delete("recurrenceCadence");
      update.delete("recurrenceInterval");
    } else {
      update.set("kind", transaction.kind);
      update.set("occurredOn", transaction.occurredOn);
      update.set("recurrenceCadence", recurrenceCadence);
      update.set("recurrenceInterval", recurrenceCadence.startsWith("custom_") ? recurrenceInterval : "1");
    }
    setRecurringUpdate(null);
    startTransition(() => formAction(update));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ??
        (shouldRenderDefaultTrigger ? (
          <SheetTrigger asChild>
            <Button size="icon" variant="ghost" className="size-11 rounded-full text-primary" aria-label="Add transaction">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-sm">
                <Plus aria-hidden="true" />
              </span>
            </Button>
          </SheetTrigger>
        ) : null)}
      <SheetContent
        ref={setSheetContent}
        side="right"
        className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg"
      >
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">{isEditing ? "Edit transaction" : "Add transaction"}</SheetTitle>
          <SheetDescription>{isEditing ? "Update or remove this shared ledger entry." : "Log shared household money."}</SheetDescription>
        </SheetHeader>
        <form
          ref={formRef}
          action={formAction}
          onSubmit={(event) => {
            submittedFormData.current = new FormData(event.currentTarget);
            setDismissedDuplicatePreview("");
            setDismissedAutomationPreview("");
            if (isRecurring) {
              event.preventDefault();
              setRecurringUpdate(new FormData(event.currentTarget));
            }
          }}
          className="px-6 pb-6"
        >
          <FieldGroup>
            <input name="kind" type="hidden" value={draftFields.kind} />
            <input name="occurredOn" type="hidden" value={draftFields.occurredOn} />
            <input name="subcategoryId" type="hidden" value={draftFields.subcategoryId} />
            <input name="categoryId" type="hidden" value={draftFields.categoryId} />
            <input name="paidBy" type="hidden" value={draftFields.paidBy} />
            <input name="servicePeriodStart" type="hidden" value={draftFields.servicePeriodStart} />
            <input name="servicePeriodEnd" type="hidden" value={draftFields.servicePeriodEnd} />
            {recurrenceFieldsVisible ? (
              <>
                <input name="recurrenceCadence" type="hidden" value={recurrenceCadence} />
                <input
                  name="recurrenceInterval"
                  type="hidden"
                  value={recurrenceCadence ? (recurrenceCadence.startsWith("custom_") ? recurrenceInterval : "1") : ""}
                />
              </>
            ) : null}
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
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.subcategoryId)}>
              <FieldLabel>Category</FieldLabel>
              <PillSelect
                ariaLabel="Categories"
                grouped
                popoverContainer={sheetContent}
                value={selectedCategoryId ? `category:${selectedCategoryId}` : selectedSubcategoryId}
                onValueChange={(value) => {
                  const directCategoryId = value.startsWith("category:") ? value.slice("category:".length) : "";
                  const subcategory = selectableSubcategories.find((candidate) => candidate.id === value);
                  const destination: TransactionDestination = directCategoryId
                    ? { type: "category", id: directCategoryId }
                    : subcategory
                      ? { type: "subcategory", id: subcategory.id, isBills: subcategory.categorySystemKey === "bills" }
                      : null;
                  dispatchDraft({ type: "destination_changed", destination });
                }}
                disabled={selectableSubcategories.length + selectableCategories.length === 0}
                emptyLabel="Uncategorized"
                options={[
                  ...(!isEditing || transaction?.source === "statement_import" ? [{ value: "", label: "Uncategorized" }] : []),
                  ...selectableSubcategories.map((subcategory) => ({
                    value: subcategory.id,
                    label: subcategory.name,
                    section: { id: subcategory.categoryId, label: subcategory.categoryName },
                    color: subcategory.color,
                    icon: categoryIcon(subcategory.icon),
                  })),
                  ...selectableCategories.map((category) => ({
                    value: `category:${category.id}`,
                    label: "Other",
                    section: { id: "direct-categories", label: "Other" },
                    color: category.color,
                    icon: categoryIcon(category.icon ?? "tag"),
                  })),
                ]}
              />
              {state?.status === "error" ? <FieldError>{state.fieldErrors.subcategoryId}</FieldError> : null}
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
                  className="w-auto rounded-2xl border-white/70 bg-popover p-3 shadow-[0_20px_60px_rgba(15,44,55,0.18)]"
                >
                  <Calendar
                    mode="single"
                    defaultMonth={calendarDefaultMonth}
                    selected={dateFromIso(occurredOn)}
                    onSelect={(date) => date && dispatchDraft({ type: "occurred_on_changed", occurredOn: isoFromDate(date) })}
                    buttonVariant="ghost"
                  />
                </PopoverContent>
              </Popover>
              {state?.status === "error" ? <FieldError>{state.fieldErrors.occurredOn}</FieldError> : null}
            </Field>
            {isBillsSubcategory ? (
              <Field data-invalid={Boolean(billingPeriodError)}>
                <FieldLabel id="billing-period-label">Billing period</FieldLabel>
                <FieldGroup className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3">
                  <Field>
                    <FieldLabel id="billing-period-from-label" className="text-muted-foreground">
                      From
                    </FieldLabel>
                    <Popover open={billingPeriodStartOpen} onOpenChange={setBillingPeriodStartOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 w-full justify-start rounded-xl bg-white/55"
                          aria-label="Choose billing period start"
                          aria-invalid={Boolean(billingPeriodError)}
                        >
                          {billingPeriod?.from ? displayDate.format(billingPeriod.from) : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-auto max-w-[calc(100vw-2rem)] rounded-2xl border-white/70 bg-popover p-3 shadow-[0_20px_60px_rgba(15,44,55,0.18)]"
                      >
                        <Calendar
                          id="billing-period-start-calendar"
                          mode="single"
                          defaultMonth={transaction ? billingPeriod?.from : calendarDefaultMonth}
                          selected={billingPeriod?.from}
                          onSelect={(from) => {
                            if (!from) return;
                            dispatchDraft({ type: "service_period_start_changed", date: isoFromDate(from) });
                            setBillingPeriodStartOpen(false);
                          }}
                          buttonVariant="ghost"
                        />
                      </PopoverContent>
                    </Popover>
                  </Field>
                  <Field>
                    <FieldLabel id="billing-period-to-label" className="text-muted-foreground">
                      To
                    </FieldLabel>
                    <Popover open={billingPeriodEndOpen} onOpenChange={setBillingPeriodEndOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 w-full justify-start rounded-xl bg-white/55"
                          aria-label="Choose billing period end"
                          aria-invalid={Boolean(billingPeriodError)}
                        >
                          {billingPeriod?.to ? displayDate.format(billingPeriod.to) : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className="w-auto max-w-[calc(100vw-2rem)] rounded-2xl border-white/70 bg-popover p-3 shadow-[0_20px_60px_rgba(15,44,55,0.18)]"
                      >
                        <Calendar
                          id="billing-period-end-calendar"
                          mode="single"
                          defaultMonth={transaction ? billingPeriod?.to : calendarDefaultMonth}
                          selected={billingPeriod?.to}
                          onSelect={(to) => {
                            if (!to) return;
                            dispatchDraft({ type: "service_period_end_changed", date: isoFromDate(to) });
                            setBillingPeriodEndOpen(false);
                          }}
                          buttonVariant="ghost"
                        />
                      </PopoverContent>
                    </Popover>
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11 shrink-0 rounded-xl bg-white/55"
                    aria-label="Use current month"
                    title="Use current month"
                    onClick={() => dispatchDraft({ type: "service_period_month_changed", month: todayIso().slice(0, 7) })}
                  >
                    <CalendarRange aria-hidden="true" />
                  </Button>
                </FieldGroup>
                {billingPeriodError ? <FieldError>{billingPeriodError}</FieldError> : null}
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
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.paidBy)}>
              <FieldLabel>Paid by</FieldLabel>
              <PillSelect
                ariaLabel="Members"
                value={selectedPaidBy || "unassigned"}
                onValueChange={(value) => dispatchDraft({ type: "paid_by_changed", paidBy: value === "unassigned" ? "" : value })}
                disabled={members.length === 0}
                options={[
                  { value: "unassigned", label: "Unassigned" },
                  ...members.map((member) => ({ value: member.id, label: member.label, color: member.color })),
                ]}
              />
              {state?.status === "error" ? <FieldError>{state.fieldErrors.paidBy}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="transaction-kind">Type</FieldLabel>
              <Select value={kind} onValueChange={(value) => dispatchDraft({ type: "kind_changed", kind: value as typeof kind })}>
                <SelectTrigger id="transaction-kind" className="w-full rounded-xl">
                  <SelectValue placeholder="Choose type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="expense">
                      <Badge variant="outline" className="border-negative/20 bg-negative/10 text-negative">
                        Expense
                      </Badge>
                    </SelectItem>
                    <SelectItem value="income">
                      <Badge variant="outline" className="border-positive/20 bg-positive/10 text-positive">
                        Income
                      </Badge>
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {recurrenceFieldsVisible ? (
              <FieldGroup className="gap-4">
                <p className="font-medium">Recurring schedule</p>
                <RecurringScheduleFields
                  actions={
                    isRecurring && transaction?.recurringScheduleId ? (
                      <>
                        <Button
                          disabled={isSchedulePending}
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-11"
                          aria-label={transaction.recurringScheduleEnabled === false ? "Resume future repeats" : "Pause future repeats"}
                          title={transaction.recurringScheduleEnabled === false ? "Resume future repeats" : "Pause future repeats"}
                          onClick={() =>
                            startScheduleTransition(async () => {
                              const lifecycleAction =
                                transaction.recurringScheduleEnabled === false
                                  ? resumeRecurringTransactionSchedule
                                  : pauseRecurringTransactionSchedule;
                              const result = await lifecycleAction(transaction.recurringScheduleId!);
                              if (result.status === "error") {
                                toast.error(result.formError, { id: `schedule-${transaction.recurringScheduleId}` });
                              }
                            })
                          }
                        >
                          {transaction.recurringScheduleEnabled === false ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              disabled={isSchedulePending}
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="size-11"
                              aria-label="Stop future repeats"
                              title="Stop future repeats"
                            >
                              <CircleStop aria-hidden="true" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Stop future repeats?</AlertDialogTitle>
                              <AlertDialogDescription>Existing transactions will stay in the shared ledger.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                disabled={isSchedulePending}
                                type="button"
                                variant="destructive"
                                onClick={() =>
                                  startScheduleTransition(async () => {
                                    const result = await stopRecurringTransactionSchedule(transaction.recurringScheduleId!);
                                    if (result.status === "error") {
                                      toast.error(result.formError, { id: `schedule-${transaction.recurringScheduleId}` });
                                    }
                                  })
                                }
                              >
                                Stop future repeats
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    ) : undefined
                  }
                  allowNone={!isRecurring}
                  cadence={recurrenceCadence}
                  hideLabel={isRecurring}
                  interval={recurrenceInterval}
                  onCadenceChange={setRecurrenceCadence}
                  onIntervalChange={setRecurrenceInterval}
                />
              </FieldGroup>
            ) : null}
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
            <Button disabled={isPending || isSchedulePending} type="submit" className="h-11 rounded-xl">
              {isEditing ? "Save changes" : "Save transaction"}
            </Button>
          </FieldGroup>
        </form>
        <AlertDialog
          open={Boolean(recurringUpdate)}
          onOpenChange={(open) => {
            if (!open) setRecurringUpdate(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply these changes to recurring transactions?</AlertDialogTitle>
              <AlertDialogDescription>
                Future and all scopes update the repeat schedule while keeping each occurrence’s posting date. Date and type changes apply
                only to this transaction.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction type="button" onClick={() => submitRecurringScope("this")}>
                Apply to this transaction
              </AlertDialogAction>
              {recurringIdentityChanged ? null : (
                <>
                  <AlertDialogAction type="button" onClick={() => submitRecurringScope("future")}>
                    Apply to future transactions
                  </AlertDialogAction>
                  <AlertDialogAction type="button" onClick={() => submitRecurringScope("all")}>
                    Apply to all transactions
                  </AlertDialogAction>
                </>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {transaction ? (
          <div className="flex justify-end px-6 pb-6">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="size-11 text-destructive" aria-label="Delete transaction">
                  <Trash2 aria-hidden="true" />
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
        {duplicatePreview ? (
          <TransactionDuplicatePreviewDialog
            onConfirm={confirmDuplicates}
            onOpenChange={(nextOpen) => !nextOpen && setDismissedDuplicatePreview(duplicatePreview.fingerprint)}
            open={duplicatePreviewOpen}
            preview={duplicatePreview}
          />
        ) : null}
        {automationPreview ? (
          <AutomationPreviewDialog
            confirmLabel="Confirm & create"
            destinations={automationDestinations}
            onConfirm={confirmAutomationPreview}
            onOpenChange={(nextOpen) => !nextOpen && setDismissedAutomationPreview(automationPreview.fingerprint)}
            open={automationPreviewOpen}
            pending={isPending}
            preview={automationPreview}
            rules={[]}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
