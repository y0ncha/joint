"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { useActionState, useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { GripVertical, Pencil, Plus, Power, Trash2, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import {
  applyAutomationResults,
  createAutomationRule,
  deleteAutomationRule,
  reorderAutomationRules,
  updateAutomationRule,
} from "@/app/actions/merchant-automations";
import type { ActionResult } from "@/app/actions/result";
import { PillSelect } from "@/components/pill-select";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { WorkspaceShell } from "@/components/workspace-shell";
import { categoryIcon } from "@/lib/category-icons";
import type { AutomationDestination, MerchantAutomationPreview, MerchantAutomationRule } from "@/lib/merchant-automations";
import { cn } from "@/lib/utils";

function ruleLabel(rule: MerchantAutomationRule) {
  return rule.action === "normalize_merchant" ? "Normalize merchant" : "Assign category";
}

function destinationValue(destination: AutomationDestination) {
  return destination.categoryId ? `category:${destination.categoryId}` : `subcategory:${destination.subcategoryId}`;
}

function selectedDestination(rule: MerchantAutomationRule | undefined) {
  if (rule?.categoryId) return `category:${rule.categoryId}`;
  if (rule?.subcategoryId) return `subcategory:${rule.subcategoryId}`;
  return "";
}

export function AutomationRuleForm({
  destinations,
  onSaved,
  rule,
}: {
  destinations: AutomationDestination[];
  onSaved?: () => void;
  rule?: MerchantAutomationRule;
}) {
  const formId = useId();
  const [action, setAction] = useState(rule?.action ?? "normalize_merchant");
  const [destination, setDestination] = useState(() => selectedDestination(rule));
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const patternRef = useRef<HTMLInputElement>(null);
  const replacementRef = useRef<HTMLInputElement>(null);
  const destinationRef = useRef<HTMLButtonElement>(null);
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    async (_state, formData) => (rule ? updateAutomationRule(rule.id, formData) : createAutomationRule(formData)),
    null,
  );
  const destinationOption = destinations.find((option) => destinationValue(option) === destination);
  const destinationError = state?.status === "error" ? (state.fieldErrors.categoryId ?? state.fieldErrors.subcategoryId) : undefined;

  useEffect(() => {
    if (state?.status === "success") {
      toast.success(rule ? "Rule saved" : "Rule added", { id: `automation-rule-${rule?.id ?? "new"}` });
      onSaved?.();
    } else if (state?.status === "error") {
      toast.error(state.formError, { id: `automation-rule-${rule?.id ?? "new"}` });
      if (state.fieldErrors.pattern) patternRef.current?.focus();
      else if (state.fieldErrors.replacement) replacementRef.current?.focus();
      else if (state.fieldErrors.categoryId || state.fieldErrors.subcategoryId) destinationRef.current?.focus();
    }
  }, [onSaved, rule, state]);

  return (
    <form action={formAction}>
      <FieldGroup>
        <input name="action" type="hidden" value={action} />
        <input name="categoryId" type="hidden" value={destinationOption?.categoryId ?? ""} />
        <input name="subcategoryId" type="hidden" value={destinationOption?.subcategoryId ?? ""} />
        <input name="enabled" type="hidden" value={String(enabled)} />
        <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.action)}>
          <FieldLabel htmlFor={`${formId}-action`}>Action</FieldLabel>
          <Select
            value={action}
            onValueChange={(value) => {
              setAction(value as MerchantAutomationRule["action"]);
              setDestination("");
            }}
          >
            <SelectTrigger
              id={`${formId}-action`}
              className="h-11 w-full rounded-xl"
              aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.action)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem className="min-h-11" value="normalize_merchant">
                  Normalize merchant
                </SelectItem>
                <SelectItem className="min-h-11" value="assign_category">
                  Assign category
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          {state?.status === "error" ? <FieldError>{state.fieldErrors.action}</FieldError> : null}
        </Field>
        <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.pattern)}>
          <FieldLabel htmlFor={`${formId}-pattern`}>Merchant pattern</FieldLabel>
          <Input
            ref={patternRef}
            id={`${formId}-pattern`}
            name="pattern"
            defaultValue={rule?.pattern}
            required
            maxLength={200}
            autoComplete="off"
            className="min-h-11"
            aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.pattern)}
          />
          {state?.status === "error" ? <FieldError>{state.fieldErrors.pattern}</FieldError> : null}
        </Field>
        {action === "normalize_merchant" ? (
          <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.replacement)}>
            <FieldLabel htmlFor={`${formId}-replacement`}>Replacement</FieldLabel>
            <Input
              ref={replacementRef}
              id={`${formId}-replacement`}
              name="replacement"
              defaultValue={rule?.replacement ?? ""}
              required
              maxLength={200}
              autoComplete="off"
              className="min-h-11"
              aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.replacement)}
            />
            {state?.status === "error" ? <FieldError>{state.fieldErrors.replacement}</FieldError> : null}
          </Field>
        ) : (
          <>
            <input name="replacement" type="hidden" value="" />
            <Field data-invalid={Boolean(destinationError)}>
              <FieldLabel>Destination</FieldLabel>
              <PillSelect
                ariaLabel="Automation destination"
                ariaDescribedBy={destinationError ? `${formId}-destination-error` : undefined}
                ariaInvalid={Boolean(destinationError)}
                value={destination}
                onValueChange={setDestination}
                emptyLabel="Choose a category"
                triggerRef={destinationRef}
                options={destinations.map((option) => ({
                  value: destinationValue(option),
                  label: option.label,
                  color: option.color,
                  icon: categoryIcon(option.icon ?? "tag"),
                }))}
              />
              {destinationError ? <FieldError id={`${formId}-destination-error`}>{destinationError}</FieldError> : null}
            </Field>
          </>
        )}
        <Field orientation="horizontal">
          <Checkbox
            id={`${formId}-enabled`}
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(checked === true)}
            className="size-5 after:-inset-3"
          />
          <FieldLabel htmlFor={`${formId}-enabled`} className="font-normal">
            Enabled
          </FieldLabel>
        </Field>
        {state?.status === "error" ? <FieldError aria-live="polite">{state.formError}</FieldError> : null}
        <Button type="submit" disabled={isPending} className="min-h-11 rounded-xl">
          {rule ? "Save rule" : "Add rule"}
        </Button>
      </FieldGroup>
    </form>
  );
}

function RuleFields({ enabled, rule }: { enabled: boolean; rule: MerchantAutomationRule }) {
  return (
    <>
      <input name="action" type="hidden" value={rule.action} />
      <input name="pattern" type="hidden" value={rule.pattern} />
      <input name="replacement" type="hidden" value={rule.replacement ?? ""} />
      <input name="categoryId" type="hidden" value={rule.categoryId ?? ""} />
      <input name="subcategoryId" type="hidden" value={rule.subcategoryId ?? ""} />
      <input name="enabled" type="hidden" value={String(enabled)} />
    </>
  );
}

function SortableRule({
  canReorder,
  destinations,
  index,
  rule,
}: {
  canReorder: boolean;
  destinations: AutomationDestination[];
  index: number;
  rule: MerchantAutomationRule;
}) {
  const label = ruleLabel(rule);
  const destination = destinations.find(
    (option) => option.categoryId === (rule.categoryId ?? null) && option.subcategoryId === (rule.subcategoryId ?? null),
  );
  const { ref, handleRef, isDragging } = useSortable({ id: rule.id, index, disabled: !canReorder });
  const [editOpen, setEditOpen] = useState(false);
  const [toggleState, toggleAction, togglePending] = useActionState<ActionResult | null, FormData>(async (_state, formData) => {
    const result = await updateAutomationRule(rule.id, formData);
    return result.status === "success"
      ? { ...result, data: { ...result.data, enabled: formData.get("enabled") === "true" ? "true" : "false" } }
      : result;
  }, null);
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    async () => deleteAutomationRule(rule.id),
    null,
  );

  useEffect(() => {
    if (toggleState?.status === "success")
      toast.success(toggleState.data?.enabled === "true" ? "Rule enabled" : "Rule disabled", {
        id: `automation-toggle-${rule.id}`,
      });
    if (toggleState?.status === "error") toast.error(toggleState.formError, { id: `automation-toggle-${rule.id}` });
  }, [rule.id, toggleState]);
  useEffect(() => {
    if (deleteState?.status === "success") toast.success("Rule deleted", { id: `automation-delete-${rule.id}` });
    if (deleteState?.status === "error") toast.error(deleteState.formError, { id: `automation-delete-${rule.id}` });
  }, [deleteState, rule.id]);

  return (
    <div
      ref={ref}
      className={cn(
        "flex min-h-14 flex-wrap items-center gap-2 rounded-xl border border-border/70 px-2 py-2 sm:flex-nowrap",
        isDragging && "opacity-60",
      )}
    >
      <Button
        ref={handleRef}
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 cursor-grab touch-none active:cursor-grabbing"
        aria-label={`Reorder ${label} rule`}
        aria-describedby="automation-sort-instructions"
        disabled={!canReorder}
      >
        <GripVertical aria-hidden="true" />
      </Button>
      <span className="w-5 text-sm text-muted-foreground">{index + 1}</span>
      <div className="min-w-40 flex-1">
        <p className="font-medium">{label}</p>
        <p className="truncate text-sm text-muted-foreground">{rule.pattern}</p>
      </div>
      <Badge variant="secondary">{rule.replacement ?? destination?.label ?? "Missing destination"}</Badge>
      <Badge variant={rule.enabled ? "outline" : "secondary"}>{rule.enabled ? "Enabled" : "Disabled"}</Badge>
      <div className="ml-auto flex items-center gap-1">
        <form action={toggleAction}>
          <RuleFields enabled={!rule.enabled} rule={rule} />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="size-11"
            disabled={togglePending}
            aria-label={`${rule.enabled ? "Disable" : "Enable"} ${label} rule`}
          >
            <Power aria-hidden="true" />
          </Button>
        </form>
        <Sheet open={editOpen} onOpenChange={setEditOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Edit ${label} rule`}>
              <Pencil aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg"
          >
            <SheetHeader className="p-6">
              <SheetTitle className="text-xl">Edit rule</SheetTitle>
              <SheetDescription>Update this merchant rule without changing its priority.</SheetDescription>
            </SheetHeader>
            <div className="px-6 pb-6">
              <AutomationRuleForm destinations={destinations} rule={rule} onSaved={() => setEditOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Delete ${label} rule`}>
              <Trash2 aria-hidden="true" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this automation rule?</AlertDialogTitle>
              <AlertDialogDescription>
                New transactions will stop using it. Existing transactions will not be changed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11" disabled={deletePending}>
                Cancel
              </AlertDialogCancel>
              <form action={deleteAction}>
                <AlertDialogAction type="submit" variant="destructive" className="min-h-11" disabled={deletePending}>
                  Delete rule
                </AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export function ApplyPreviewControl({
  destinations,
  disabled = false,
  preview,
}: {
  destinations: AutomationDestination[];
  disabled?: boolean;
  preview: MerchantAutomationPreview;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    async () => applyAutomationResults(preview.changes, preview.fingerprint),
    null,
  );

  useEffect(() => {
    if (state?.status === "success") {
      toast.success("Automation changes applied", { id: "automation-apply" });
    } else if (state?.status === "error") {
      toast.error(state.formError, { id: "automation-apply" });
    }
  }, [state]);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11" disabled={disabled || preview.changes.length === 0}>
          Review and apply
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Apply {preview.changes.length} automation {preview.changes.length === 1 ? "change" : "changes"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Review the preview below. Applying updates these existing transactions atomically and cannot be undone here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto" aria-label="Existing transaction changes">
          {preview.changes.map((change) => {
            const destination = destinations.find(
              (option) => option.categoryId === change.category_id && option.subcategoryId === change.subcategory_id,
            );
            return (
              <li key={change.id} className="rounded-lg border border-border/70 p-3">
                <p className="font-medium">
                  {change.expected_merchant} → {change.merchant}
                </p>
                {destination ? <p className="text-sm text-muted-foreground">Destination: {destination.label}</p> : null}
              </li>
            );
          })}
        </ul>
        {state?.status === "error" ? <FieldError aria-live="polite">{state.formError}</FieldError> : null}
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11" disabled={isPending}>
            Cancel
          </AlertDialogCancel>
          <form action={formAction}>
            <AlertDialogAction type="submit" className="min-h-11" disabled={isPending}>
              Apply changes
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AutomationRulesWorkspace({
  count,
  destinations,
  preview,
  rules,
}: {
  count: number;
  destinations: AutomationDestination[];
  preview: MerchantAutomationPreview;
  rules: MerchantAutomationRule[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [orderedRules, setOrderedRules] = useOptimistic(rules, (_current, next: MerchantAutomationRule[]) => next);
  const [reordering, startReordering] = useTransition();
  const completeRuleList = count === orderedRules.length;
  const canReorder = completeRuleList && orderedRules.length > 1 && !reordering;

  return (
    <WorkspaceShell
      title="Automations"
      description="Make familiar merchants consistent and categorized."
      actions={
        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger asChild>
            <Button aria-label="Add rule" size="icon" className="size-11 rounded-full">
              <Plus aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg"
          >
            <SheetHeader className="p-6">
              <SheetTitle className="text-xl">Add rule</SheetTitle>
              <SheetDescription>Create one merchant normalization or category rule.</SheetDescription>
            </SheetHeader>
            <div className="px-6 pb-6">
              <AutomationRuleForm destinations={destinations} onSaved={() => setAddOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      }
    >
      <Card className="mt-6 border-white/50 bg-card/90">
        <CardHeader>
          <CardTitle>Merchant rules</CardTitle>
          <CardDescription>
            Priority decides which matching rule wins. Preview changes before applying them to existing transactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p id="automation-sort-instructions" className="sr-only">
            Press Space or Enter to pick up a rule, use the arrow keys to move it, then press Space or Enter to drop it.
          </p>
          {!completeRuleList ? (
            <p role="status" className="text-sm text-muted-foreground">
              Showing {orderedRules.length} of {count} rules. Reordering and bulk preview require the complete list.
            </p>
          ) : null}
          {orderedRules.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <WandSparkles aria-hidden="true" />
              <p>No automation rules yet.</p>
            </div>
          ) : (
            <DragDropProvider
              onDragEnd={(event) => {
                const previous = orderedRules;
                const next = move(previous, event).map((rule, position) => ({ ...rule, position }));
                if (next.every((rule, position) => rule.id === previous[position]?.id)) return;
                startReordering(async () => {
                  setOrderedRules(next);
                  const result = await reorderAutomationRules(next.map((rule) => rule.id));
                  if (result.status === "error") {
                    toast.error(result.formError, { id: "automation-reorder" });
                  } else {
                    toast.success("Rule order saved", { id: "automation-reorder" });
                  }
                });
              }}
            >
              {orderedRules.map((rule, index) => (
                <SortableRule key={rule.id} canReorder={canReorder} destinations={destinations} index={index} rule={rule} />
              ))}
            </DragDropProvider>
          )}
        </CardContent>
      </Card>
      <Card className="mt-5 border-white/50 bg-card/90">
        <CardHeader>
          <CardTitle>Existing transactions</CardTitle>
          <CardDescription>Nothing changes until you review and confirm this preview.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div aria-live="polite">
              <p className="font-medium">
                {preview.changes.length} existing {preview.changes.length === 1 ? "transaction" : "transactions"} would change
              </p>
              <p className="text-sm text-muted-foreground">
                {preview.conflicts.length} priority {preview.conflicts.length === 1 ? "conflict" : "conflicts"} resolved by rule order
              </p>
            </div>
            <ApplyPreviewControl destinations={destinations} disabled={!completeRuleList || reordering} preview={preview} />
          </div>
          {preview.conflicts.length > 0 ? (
            <ul aria-label="Priority conflicts" className="flex flex-col gap-2">
              {preview.conflicts.map((conflict) => {
                const winner = orderedRules.find((rule) => rule.id === conflict.winnerId);
                const shadowed = conflict.shadowedRuleIds
                  .map((id) => orderedRules.find((rule) => rule.id === id)?.pattern)
                  .filter((pattern): pattern is string => Boolean(pattern));
                return (
                  <li
                    key={`${conflict.action}:${conflict.winnerId}:${conflict.shadowedRuleIds.join(",")}`}
                    className="text-sm text-muted-foreground"
                  >
                    {winner?.pattern ?? "Higher-priority rule"} wins over {shadowed.join(", ") || "lower-priority rules"} for{" "}
                    {conflict.transactionCount} {conflict.transactionCount === 1 ? "transaction" : "transactions"}.
                  </li>
                );
              })}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </WorkspaceShell>
  );
}
