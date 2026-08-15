"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createSavingsGoal,
  deleteSavingsGoal,
  removeMonthlyBudget,
  saveMonthlyBudget,
  updateSavingsGoal,
} from "@/app/actions/budgets-goals";
import type { ActionResult } from "@/app/actions/result";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { calculateGoalProgress, savedAmountSchema, targetAmountSchema, targetDateSchema } from "@/lib/budgets-goals";
import type { BudgetRow, BudgetsGoalsData, GoalRow } from "@/lib/budgets-goals-data";

const currency = new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 });
const displayDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

type BudgetTargets = BudgetsGoalsData["targets"];
function formatAgorot(value: number) {
  return currency.format(value / 100);
}

function formatDate(value: string) {
  return displayDate.format(new Date(`${value}T12:00:00`));
}

function roundedPercent(value: number) {
  return Math.round(value);
}

function fieldError(state: ActionResult | null, name: string) {
  return state?.status === "error" ? state.fieldErrors[name] : undefined;
}

function formValue(state: ActionResult | null, name: string, fallback?: string | number) {
  return state?.status === "error" ? (state.data?.[name] ?? fallback) : fallback;
}

function preserveSubmittedValues(result: ActionResult, input: FormData, names: readonly string[]) {
  if (result.status !== "error") return result;
  return {
    ...result,
    data: {
      ...result.data,
      ...Object.fromEntries(names.map((name) => [name, input.get(name)?.toString() ?? ""])),
    },
  };
}

function goalPreview(targetAmount: string, savedAmount: string, targetDate: string) {
  const parsedTargetAmount = targetAmountSchema.safeParse(targetAmount);
  const parsedSavedAmount = savedAmountSchema.safeParse(savedAmount);
  const parsedTargetDate = targetDateSchema.safeParse(targetDate);
  if (!parsedTargetAmount.success || !parsedSavedAmount.success || !parsedTargetDate.success) {
    return null;
  }

  return calculateGoalProgress(
    { targetAmount: parsedTargetAmount.data, savedAmount: parsedSavedAmount.data, targetDate: parsedTargetDate.data },
    new Date().toISOString().slice(0, 10),
  );
}

function MutationStatus({
  isPending,
  pendingMessage,
  state,
  successMessage,
}: {
  isPending: boolean;
  pendingMessage: string;
  state: ActionResult | null;
  successMessage: string;
}) {
  const message = isPending
    ? pendingMessage
    : state?.status === "success"
      ? successMessage
      : state?.status === "error"
        ? state.formError
        : null;
  const className = !isPending && state?.status === "error" ? "text-destructive" : "text-muted-foreground";

  return (
    <div aria-atomic="true" aria-live="polite" className={`min-h-5 text-sm ${className}`} role="status">
      {message}
    </div>
  );
}

function useFocusInvalid(state: ActionResult | null, formRef: React.RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    if (state?.status !== "error") return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [formRef, state]);
}

function sheetContentClassName() {
  return "inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl motion-reduce:animate-none motion-reduce:transition-none md:inset-x-auto md:w-3/4 md:max-w-lg";
}

export function BudgetForm({
  mode,
  onSuccess,
  target,
  targets,
}: {
  mode: "add" | "edit";
  onSuccess: () => void;
  target?: BudgetRow;
  targets: BudgetTargets;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    async (previousState, input) =>
      preserveSubmittedValues(await saveMonthlyBudget(previousState, input), input, ["targetKind", "targetId", "monthlyBudget"]),
    null,
  );
  const [selectedTargetKey, setSelectedTargetKey] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useFocusInvalid(state, formRef);

  useEffect(() => {
    if (state?.status === "success") {
      toast.success("Budget saved", { id: "budget-save" });
      onSuccess();
    }
    if (state?.status === "error") toast.error(state.formError, { id: "budget-save" });
  }, [onSuccess, state]);

  const availableCategories = targets.categories.filter((candidate) => candidate.monthlyBudget === null);
  const availableSubcategories = targets.subcategories.filter((candidate) => candidate.monthlyBudget === null);
  const submittedTargetKey = state?.status === "error" ? `${state.data?.targetKind ?? ""}:${state.data?.targetId ?? ""}` : "";
  const targetKey = mode === "edit" && target ? `${target.targetKind}:${target.id}` : selectedTargetKey || submittedTargetKey;
  const [targetKind, targetId] = targetKey.split(":") as ["category" | "subcategory" | "", string | undefined];
  const targetError = fieldError(state, "targetId") ?? fieldError(state, "targetKind");
  const amountError = fieldError(state, "monthlyBudget");
  const formId = mode === "edit" && target ? `budget-${target.id}` : "budget-new";

  return (
    <form ref={formRef} action={formAction} id={formId}>
      <FieldGroup>
        <input name="targetKind" type="hidden" value={targetKind} />
        <input name="targetId" type="hidden" value={targetId ?? ""} />
        {mode === "edit" && target ? (
          <Field data-invalid={Boolean(targetError)}>
            <FieldLabel>Target</FieldLabel>
            <p className="min-w-0 break-words rounded-lg border border-input bg-muted/40 px-3 py-2.5 text-sm">
              <span className="font-medium">{target.targetKind === "category" ? "Category" : "Subcategory"}</span>
              <span className="text-muted-foreground"> · {target.label}</span>
            </p>
            {targetError ? <FieldError id={`${formId}-target-error`}>{targetError}</FieldError> : null}
          </Field>
        ) : (
          <Field data-invalid={Boolean(targetError)}>
            <FieldLabel htmlFor={`${formId}-target`}>Target</FieldLabel>
            <Select value={targetKey} onValueChange={setSelectedTargetKey}>
              <SelectTrigger
                id={`${formId}-target`}
                size="lg"
                className="w-full"
                aria-invalid={Boolean(targetError)}
                aria-describedby={targetError ? `${formId}-target-error` : undefined}
              >
                <SelectValue placeholder="Choose a category or subcategory" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup aria-label="Categories">
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Categories</p>
                  {availableCategories.map((candidate) => (
                    <SelectItem key={candidate.id} value={`category:${candidate.id}`}>
                      <span className="min-w-0 break-words">{candidate.name}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup aria-label="Subcategories">
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Subcategories</p>
                  {availableSubcategories.map((candidate) => (
                    <SelectItem key={candidate.id} value={`subcategory:${candidate.id}`}>
                      <span className="min-w-0 break-words">{candidate.label}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {availableCategories.length === 0 && availableSubcategories.length === 0 ? (
              <FieldDescription>All active expense targets already have budgets.</FieldDescription>
            ) : null}
            {targetError ? <FieldError id={`${formId}-target-error`}>{targetError}</FieldError> : null}
          </Field>
        )}
        <Field data-invalid={Boolean(amountError)}>
          <FieldLabel htmlFor={`${formId}-amount`}>Monthly limit</FieldLabel>
          <Input
            aria-describedby={amountError ? `${formId}-amount-error` : undefined}
            aria-invalid={Boolean(amountError)}
            autoComplete="off"
            defaultValue={formValue(state, "monthlyBudget", mode === "edit" && target ? target.monthlyBudget : undefined)}
            id={`${formId}-amount`}
            inputMode="decimal"
            min="0"
            name="monthlyBudget"
            required
            step="0.01"
            type="number"
            className="min-h-11"
          />
          {amountError ? <FieldError id={`${formId}-amount-error`}>{amountError}</FieldError> : null}
        </Field>
        <MutationStatus isPending={isPending} pendingMessage="Saving budget…" state={state} successMessage="Budget saved" />
        <Button className="min-h-11" disabled={isPending} type="submit">
          {isPending ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
          {isPending ? "Saving budget…" : mode === "edit" ? "Save budget" : "Add budget"}
        </Button>
      </FieldGroup>
    </form>
  );
}

function BudgetAddSheet({ targets }: { targets: BudgetTargets }) {
  const [open, setOpen] = useState(false);
  const onSuccess = useCallback(() => setOpen(false), []);
  const hasUnbudgetedTargets =
    targets.categories.some((target) => target.monthlyBudget === null) ||
    targets.subcategories.some((target) => target.monthlyBudget === null);
  const addBudgetHelpId = "budget-add-help";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          aria-describedby={!hasUnbudgetedTargets ? addBudgetHelpId : undefined}
          className="min-h-11"
          disabled={!hasUnbudgetedTargets}
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add budget
        </Button>
      </SheetTrigger>
      {!hasUnbudgetedTargets ? (
        <span className="sr-only" id={addBudgetHelpId}>
          Add budget unavailable: all active expense targets already have budgets.
        </span>
      ) : null}
      <SheetContent className={sheetContentClassName()} side="right">
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Add budget</SheetTitle>
          <SheetDescription>Set a recurring monthly limit for an active expense target.</SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-6">
          <BudgetForm mode="add" onSuccess={onSuccess} targets={targets} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BudgetEditSheet({ target, targets }: { target: BudgetRow; targets: BudgetTargets }) {
  const [open, setOpen] = useState(false);
  const onSuccess = useCallback(() => setOpen(false), []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="min-h-11" type="button" variant="ghost">
          <Pencil aria-hidden="true" data-icon="inline-start" />
          Edit budget
        </Button>
      </SheetTrigger>
      <SheetContent className={sheetContentClassName()} side="right">
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Edit budget</SheetTitle>
          <SheetDescription className="min-w-0 break-words">Update the monthly limit for {target.label}.</SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-6">
          <BudgetForm mode="edit" onSuccess={onSuccess} target={target} targets={targets} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RemoveBudgetDialog({ target }: { target: BudgetRow }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(async (_previousState, input) => {
    const result = await removeMonthlyBudget(null, input);
    if (result.status === "success") {
      toast.success("Budget removed", { id: "budget-remove" });
      setOpen(false);
    }
    if (result.status === "error") toast.error(result.formError, { id: "budget-remove" });
    return result;
  }, null);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button aria-label={`Remove ${target.label} budget`} className="min-h-11 text-destructive" type="button" variant="ghost">
          <Trash2 aria-hidden="true" data-icon="inline-start" />
          Remove budget
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this budget?</AlertDialogTitle>
          <AlertDialogDescription className="min-w-0 break-words">This clears the monthly limit for {target.label}.</AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <input name="targetKind" type="hidden" value={target.targetKind} />
          <input name="targetId" type="hidden" value={target.id} />
          <MutationStatus isPending={isPending} pendingMessage="Removing budget…" state={state} successMessage="Budget removed" />
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={isPending} type="button">
              Cancel
            </AlertDialogCancel>
            <Button className="min-h-11" disabled={isPending} type="submit" variant="destructive">
              {isPending ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
              {isPending ? "Removing budget…" : "Remove budget"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BudgetProgressRow({ row, targets }: { row: BudgetRow; targets: BudgetTargets }) {
  const percent = roundedPercent(row.progress.percentage);
  const level = row.targetKind === "category" ? "Category" : "Subcategory";
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 py-4 first:pt-0 last:border-0 last:pb-0" data-budget-row>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="min-w-0 break-words font-medium">{row.label}</p>
          <p className="text-sm text-muted-foreground">{level}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <BudgetEditSheet target={row} targets={targets} />
          <RemoveBudgetDialog target={row} />
        </div>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="font-mono tabular-nums">
          {formatAgorot(row.progress.spentAgorot)} spent of {formatAgorot(row.progress.budgetAgorot)}
        </p>
        <p className="font-medium tabular-nums">{percent}%</p>
      </div>
      <Progress
        aria-label={`Budget progress for ${row.label}: ${percent}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={row.progress.barPercentage}
        aria-valuetext={`${percent}% of monthly limit`}
        role="progressbar"
        value={row.progress.barPercentage}
      />
      <p className={row.progress.overBudgetAgorot > 0 ? "text-sm text-negative" : "text-sm text-muted-foreground"}>
        {row.progress.overBudgetAgorot > 0
          ? `Over budget by ${formatAgorot(row.progress.overBudgetAgorot)}`
          : `${formatAgorot(row.progress.remainingAgorot)} remaining`}
      </p>
    </div>
  );
}

export function GoalForm({ goal, mode, onSuccess }: { goal?: GoalRow; mode: "add" | "edit"; onSuccess: () => void }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(async (previousState, input) => {
    const result =
      mode === "edit" && goal ? await updateSavingsGoal(goal.id, previousState, input) : await createSavingsGoal(previousState, input);
    return preserveSubmittedValues(result, input, ["name", "targetAmount", "savedAmount", "targetDate"]);
  }, null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusInvalid(state, formRef);

  const [previewValues, setPreviewValues] = useState(() => ({
    targetAmount: String(formValue(state, "targetAmount", goal?.targetAmount ?? "")),
    savedAmount: String(formValue(state, "savedAmount", goal?.savedAmount ?? 0)),
    targetDate: String(formValue(state, "targetDate", goal?.targetDate ?? "")),
  }));

  useEffect(() => {
    if (state?.status === "success") {
      toast.success("Goal saved", { id: "goal-save" });
      onSuccess();
    }
    if (state?.status === "error") toast.error(state.formError, { id: "goal-save" });
  }, [onSuccess, state]);

  const formId = mode === "edit" && goal ? `goal-${goal.id}` : "goal-new";
  const nameError = fieldError(state, "name");
  const targetAmountError = fieldError(state, "targetAmount");
  const savedAmountError = fieldError(state, "savedAmount");
  const targetDateError = fieldError(state, "targetDate");
  const monthlyRequiredPreview = goalPreview(previewValues.targetAmount, previewValues.savedAmount, previewValues.targetDate);

  return (
    <form ref={formRef} action={formAction} id={formId}>
      <FieldGroup>
        <Field data-invalid={Boolean(nameError)}>
          <FieldLabel htmlFor={`${formId}-name`}>Name</FieldLabel>
          <Input
            aria-describedby={nameError ? `${formId}-name-error` : undefined}
            aria-invalid={Boolean(nameError)}
            autoComplete="off"
            defaultValue={formValue(state, "name", goal?.name)}
            id={`${formId}-name`}
            name="name"
            required
            className="min-h-11"
          />
          {nameError ? <FieldError id={`${formId}-name-error`}>{nameError}</FieldError> : null}
        </Field>
        <Field data-invalid={Boolean(targetAmountError)}>
          <FieldLabel htmlFor={`${formId}-target-amount`}>Target amount</FieldLabel>
          <Input
            aria-describedby={targetAmountError ? `${formId}-target-amount-error` : undefined}
            aria-invalid={Boolean(targetAmountError)}
            autoComplete="off"
            defaultValue={formValue(state, "targetAmount", goal?.targetAmount)}
            onChange={(event) => setPreviewValues((current) => ({ ...current, targetAmount: event.target.value }))}
            id={`${formId}-target-amount`}
            inputMode="decimal"
            min="0"
            name="targetAmount"
            required
            step="0.01"
            type="number"
            className="min-h-11"
          />
          {targetAmountError ? <FieldError id={`${formId}-target-amount-error`}>{targetAmountError}</FieldError> : null}
        </Field>
        <Field data-invalid={Boolean(savedAmountError)}>
          <FieldLabel htmlFor={`${formId}-saved-amount`}>Saved amount</FieldLabel>
          <Input
            aria-describedby={savedAmountError ? `${formId}-saved-amount-error` : undefined}
            aria-invalid={Boolean(savedAmountError)}
            autoComplete="off"
            defaultValue={formValue(state, "savedAmount", goal?.savedAmount ?? 0)}
            onChange={(event) => setPreviewValues((current) => ({ ...current, savedAmount: event.target.value }))}
            id={`${formId}-saved-amount`}
            inputMode="decimal"
            min="0"
            name="savedAmount"
            required
            step="0.01"
            type="number"
            className="min-h-11"
          />
          {savedAmountError ? <FieldError id={`${formId}-saved-amount-error`}>{savedAmountError}</FieldError> : null}
        </Field>
        <Field data-invalid={Boolean(targetDateError)}>
          <FieldLabel htmlFor={`${formId}-target-date`}>Needed by</FieldLabel>
          <Input
            aria-describedby={targetDateError ? `${formId}-target-date-error` : undefined}
            aria-invalid={Boolean(targetDateError)}
            autoComplete="off"
            defaultValue={formValue(state, "targetDate", goal?.targetDate)}
            id={`${formId}-target-date`}
            name="targetDate"
            onChange={(event) => setPreviewValues((current) => ({ ...current, targetDate: event.target.value }))}
            required
            type="date"
            className="min-h-11"
          />
          {targetDateError ? <FieldError id={`${formId}-target-date-error`}>{targetDateError}</FieldError> : null}
        </Field>
        <FieldDescription aria-live="polite" id={`${formId}-monthly-required`}>
          {monthlyRequiredPreview
            ? monthlyRequiredPreview.status === "complete"
              ? `Monthly required: ${formatAgorot(0)} · Complete`
              : monthlyRequiredPreview.status === "overdue"
                ? "Overdue · Monthly required is unavailable"
                : `Monthly required: ${formatAgorot(monthlyRequiredPreview.monthlyRequiredAgorot ?? 0)}`
            : "Enter a valid target, saved amount, and needed-by date to preview monthly saving."}
        </FieldDescription>
        <MutationStatus isPending={isPending} pendingMessage="Saving goal…" state={state} successMessage="Goal saved" />
        <Button className="min-h-11" disabled={isPending} type="submit">
          {isPending ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
          {isPending ? "Saving goal…" : mode === "edit" ? "Save goal" : "Add goal"}
        </Button>
      </FieldGroup>
    </form>
  );
}

function GoalAddSheet() {
  const [open, setOpen] = useState(false);
  const onSuccess = useCallback(() => setOpen(false), []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="min-h-11" type="button" variant="outline">
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add goal
        </Button>
      </SheetTrigger>
      <SheetContent className={sheetContentClassName()} side="right">
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Add goal</SheetTitle>
          <SheetDescription>Track a manually maintained savings target.</SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-6">
          <GoalForm mode="add" onSuccess={onSuccess} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function GoalEditSheet({ goal }: { goal: GoalRow }) {
  const [open, setOpen] = useState(false);
  const onSuccess = useCallback(() => setOpen(false), []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="min-h-11" type="button" variant="ghost">
          <Pencil aria-hidden="true" data-icon="inline-start" />
          Edit goal
        </Button>
      </SheetTrigger>
      <SheetContent className={sheetContentClassName()} side="right">
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Edit goal</SheetTitle>
          <SheetDescription>Update the name, amounts, or needed-by date.</SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-6">
          <GoalForm goal={goal} mode="edit" onSuccess={onSuccess} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DeleteGoalDialog({ goal }: { goal: GoalRow }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(async (_previousState, input) => {
    const result = await deleteSavingsGoal(goal.id, null, input);
    if (result.status === "success") {
      toast.success("Goal deleted", { id: "goal-delete" });
      setOpen(false);
    }
    if (result.status === "error") toast.error(result.formError, { id: "goal-delete" });
    return result;
  }, null);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button aria-label={`Delete ${goal.name}`} className="min-h-11 text-destructive" type="button" variant="ghost">
          <Trash2 aria-hidden="true" data-icon="inline-start" />
          Delete goal
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
          <AlertDialogDescription className="min-w-0 break-words">
            This removes {goal.name} and its manually maintained progress.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <MutationStatus isPending={isPending} pendingMessage="Deleting goal…" state={state} successMessage="Goal deleted" />
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={isPending} type="button">
              Cancel
            </AlertDialogCancel>
            <Button className="min-h-11" disabled={isPending} type="submit" variant="destructive">
              {isPending ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
              {isPending ? "Deleting goal…" : "Delete goal"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function GoalProgressRow({ goal }: { goal: GoalRow }) {
  const percent = roundedPercent(goal.progress.percentage);
  const statusLabel = goal.progress.status === "complete" ? "Complete" : `${percent}%`;
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 py-4 first:pt-0 last:border-0 last:pb-0" data-goal-row>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 break-words font-medium">{goal.name}</p>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <GoalEditSheet goal={goal} />
          <DeleteGoalDialog goal={goal} />
        </div>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="font-mono tabular-nums">
          {formatAgorot(goal.progress.savedAgorot)} saved of {formatAgorot(goal.progress.targetAgorot)} target
        </p>
        <p className="font-medium tabular-nums">{statusLabel}</p>
      </div>
      <Progress
        aria-label={`Goal progress for ${goal.name}: ${statusLabel}`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={goal.progress.barPercentage}
        aria-valuetext={statusLabel}
        role="progressbar"
        value={goal.progress.barPercentage}
      />
      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
        <p>Needed by {formatDate(goal.targetDate)}</p>
        <p>
          {goal.progress.status === "overdue"
            ? "Overdue"
            : goal.progress.status === "complete"
              ? "Complete"
              : `Monthly required: ${formatAgorot(goal.progress.monthlyRequiredAgorot ?? 0)}`}
        </p>
      </div>
    </div>
  );
}

function BudgetCard({ budgets, targets }: { budgets: BudgetRow[]; targets: BudgetTargets }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Budgets</CardTitle>
        <CardDescription>Set monthly limits for active household expense targets.</CardDescription>
        <CardAction>
          <BudgetAddSheet targets={targets} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        {budgets.length ? (
          budgets.map((row) => <BudgetProgressRow key={`${row.targetKind}:${row.id}`} row={row} targets={targets} />)
        ) : (
          <p className="text-sm text-muted-foreground">No monthly budgets configured yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function GoalCard({ goals }: { goals: GoalRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Goals</CardTitle>
        <CardDescription>Track manually maintained savings targets and deadlines.</CardDescription>
        <CardAction>
          <GoalAddSheet />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        {goals.length ? (
          goals.map((goal) => <GoalProgressRow key={goal.id} goal={goal} />)
        ) : (
          <p className="text-sm text-muted-foreground">No savings goals configured yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function BudgetsGoalsWorkspace({ budgets, goals, targets }: BudgetsGoalsData) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <BudgetCard budgets={budgets} targets={targets} />
      <GoalCard goals={goals} />
    </div>
  );
}
