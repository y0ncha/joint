"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  type ComponentProps,
  Fragment,
  type ReactNode,
  useActionState,
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { ArrowRight, Ellipsis, GripVertical, Pencil, Plus, Trash2, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import {
  applyAutomationResults,
  createAutomationRule,
  deleteAutomationRule,
  reorderAutomationRules,
  setAutomationRuleEnabled,
  updateAutomationRule,
} from "@/app/actions/merchant-automations";
import type { ActionResult } from "@/app/actions/result";
import { PillSelect } from "@/components/pill-select";
import { CategoryIcon } from "@/components/category-icon-picker";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  amountConditionOperatorOptions,
  compatibilityPattern,
  conditionConnectorOptions,
  connectorForCondition,
  conditionDisplayLabel,
  decodeAutomationConditions,
  describeConditionGroup,
  groupFromLegacyPattern,
  preserveConditionConnectorPositions,
  textConditionFieldOptions,
  textConditionOperatorOptions,
  type AutomationCondition,
  type AutomationConditionAmountOperator,
  type AutomationConditionConnector,
  type AutomationConditionField,
  type AutomationConditionGroup,
  type AutomationConditionTextOperator,
} from "@/lib/automation-conditions";
import { categoryIcon } from "@/lib/category-icons";
import type { AutomationDestination, MerchantAutomationPreview, MerchantAutomationRule } from "@/lib/merchant-automations";
import { decodeMerchantPattern, describeMerchantPattern } from "@/lib/merchant-pattern";
import { cn } from "@/lib/utils";

function actionLabel(action: MerchantAutomationRule["action"]) {
  if (action === "normalize_merchant") return "Normalize merchant";
  if (action === "assign_category") return "Assign category";
  return "Delete transaction";
}

function ruleLabel(rule: MerchantAutomationRule) {
  return actionLabel(rule.action);
}

function destinationValue(destination: AutomationDestination) {
  return destination.categoryId ? `category:${destination.categoryId}` : `subcategory:${destination.subcategoryId}`;
}

function selectedDestination(rule: MerchantAutomationRule | undefined) {
  if (rule?.categoryId) return `category:${rule.categoryId}`;
  if (rule?.subcategoryId) return `subcategory:${rule.subcategoryId}`;
  return "";
}

function ruleConditionSummary(rule: MerchantAutomationRule) {
  return rule.conditions ? describeConditionGroup(rule.conditions) : describeMerchantPattern(rule.pattern);
}

function ConditionSummaryLabel({ condition }: { condition: AutomationCondition }) {
  if (condition.field !== "amount" && condition.operator === "advanced") {
    return (
      <>
        {condition.field === "merchant" ? "Merchant" : "Note"} Matches{" "}
        <code className="rounded bg-muted/60 px-1 font-mono">{condition.value}</code>
      </>
    );
  }
  return conditionDisplayLabel(condition);
}

function RuleConditionSummary({ rule }: { rule: MerchantAutomationRule }) {
  if (!rule.conditions) {
    const decoded = decodeMerchantPattern(rule.pattern);
    return decoded.mode === "advanced" ? (
      <>
        Merchant Matches <code className="rounded bg-muted/60 px-1 font-mono">{decoded.value}</code>
      </>
    ) : (
      ruleConditionSummary(rule)
    );
  }
  return rule.conditions.conditions.map((condition, index) => (
    <Fragment key={`${condition.field}-${index}`}>
      {index > 0 ? (
        <span className="mx-1 text-muted-foreground/60">{` ${connectorForCondition(rule.conditions!, index)?.toUpperCase()} `}</span>
      ) : null}
      <ConditionSummaryLabel condition={condition} />
    </Fragment>
  ));
}

function RuleDeleteDialog({
  deleteAction,
  deletePending,
  trigger,
}: {
  deleteAction: ComponentProps<"form">["action"];
  deletePending: boolean;
  trigger: ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this automation rule?</AlertDialogTitle>
          <AlertDialogDescription>New transactions will stop using it. Existing transactions will not be changed.</AlertDialogDescription>
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
  );
}

export type AutomationConditionRow = {
  id: string;
  condition: AutomationCondition;
};

export function removeConditionRow(previous: AutomationConditionRow[], index: number): AutomationConditionRow[] {
  if (previous.length === 1) return previous;
  const remaining = previous.filter((_, rowIndex) => rowIndex !== index);
  const conditions = preserveConditionConnectorPositions(
    previous.map((row) => row.condition),
    remaining.map((row) => row.condition),
  );
  return remaining.map((row, rowIndex) => ({ ...row, condition: conditions[rowIndex]! }));
}

export function AutomationRuleForm({
  destinations,
  onSaved,
  popoverContainer,
  rule,
}: {
  destinations: AutomationDestination[];
  onSaved?: () => void;
  popoverContainer?: HTMLElement | null;
  rule?: MerchantAutomationRule;
}) {
  const formId = useId();
  const [action, setAction] = useState(rule?.action ?? "normalize_merchant");
  const [destination, setDestination] = useState(() => selectedDestination(rule));
  const initialConditionGroup = rule
    ? rule.conditions
      ? decodeAutomationConditions(rule.conditions, rule.pattern)
      : groupFromLegacyPattern(rule.pattern)
    : { conditions: [{ field: "merchant" as const, operator: "contains" as const, value: "" }] };
  const nextConditionRowId = useRef(initialConditionGroup.conditions.length);
  const [conditionRows, setConditionRows] = useState<AutomationConditionRow[]>(() =>
    initialConditionGroup.conditions.map((condition, index) => ({
      id: `condition-${index}`,
      condition:
        index === 0
          ? { ...condition, connector: undefined }
          : { ...condition, connector: connectorForCondition(initialConditionGroup, index) ?? "and" },
    })),
  );
  const merchantTextRef = useRef<HTMLInputElement>(null);
  const conditionInputRefs = useRef<Array<HTMLInputElement | null>>([]);
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
      if (state.fieldErrors.pattern || state.fieldErrors.conditions) (merchantTextRef.current ?? conditionInputRefs.current[0])?.focus();
      else if (state.fieldErrors.replacement) replacementRef.current?.focus();
      else if (state.fieldErrors.categoryId || state.fieldErrors.subcategoryId) destinationRef.current?.focus();
    }
  }, [onSaved, rule, state]);

  const conditionGroup: AutomationConditionGroup = { conditions: conditionRows.map((row) => row.condition) };
  const firstCondition = conditionRows[0]?.condition;
  const firstMerchantCondition = firstCondition?.field === "merchant" ? firstCondition : undefined;
  const legacyMatchMode = firstMerchantCondition?.operator ?? "contains";
  const legacyMatchValue = firstMerchantCondition?.value ?? "__conditions__";
  const updateOperator = (index: number, value: string) => {
    setConditionRows((current) =>
      current.map((row, conditionIndex) => {
        if (conditionIndex !== index) return row;
        const condition = row.condition;
        return condition.field === "amount"
          ? { ...row, condition: { ...condition, operator: value as AutomationConditionAmountOperator } }
          : { ...row, condition: { ...condition, operator: value as AutomationConditionTextOperator } };
      }),
    );
  };
  const updateValue = (index: number, value: string | number) => {
    setConditionRows((current) =>
      current.map((row, conditionIndex) => {
        if (conditionIndex !== index) return row;
        const condition = row.condition;
        return {
          ...row,
          condition: condition.field === "amount" ? { ...condition, value: Number(value) } : { ...condition, value: String(value) },
        };
      }),
    );
  };
  const updateConnector = (index: number, connector: AutomationConditionConnector) => {
    setConditionRows((current) =>
      current.map((row, conditionIndex) => (conditionIndex === index ? { ...row, condition: { ...row.condition, connector } } : row)),
    );
  };
  const changeField = (index: number, field: AutomationConditionField) => {
    const connector = conditionRows[index]?.condition.connector;
    const next: AutomationCondition =
      field === "amount"
        ? { ...(connector ? { connector } : {}), field, operator: "equals", value: 0 }
        : { ...(connector ? { connector } : {}), field, operator: "contains", value: "" };
    setConditionRows((current) => current.map((row, conditionIndex) => (conditionIndex === index ? { ...row, condition: next } : row)));
  };
  const removeCondition = (index: number) => {
    setConditionRows((current) => removeConditionRow(current, index));
  };
  const addCondition = () => {
    setConditionRows((current) => [
      ...current,
      {
        id: `condition-${nextConditionRowId.current++}`,
        condition: { connector: "and", field: "merchant", operator: "contains", value: "" },
      },
    ]);
  };

  return (
    <form action={formAction} noValidate>
      <FieldGroup>
        <input name="action" type="hidden" value={action} />
        <input name="categoryId" type="hidden" value={destinationOption?.categoryId ?? ""} />
        <input name="subcategoryId" type="hidden" value={destinationOption?.subcategoryId ?? ""} />
        <input name="enabled" type="hidden" value={String(rule?.enabled ?? true)} />
        <input name="conditions" type="hidden" value={JSON.stringify(conditionGroup)} />
        <input name="matchMode" type="hidden" value={legacyMatchMode} />
        <input name="matchValue" type="hidden" value={legacyMatchValue} />
        <input name="pattern" type="hidden" value={compatibilityPattern(conditionGroup)} />
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
              size="lg"
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
                <SelectItem className="min-h-11 text-destructive" value="delete_transaction">
                  Delete transaction
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          {state?.status === "error" ? <FieldError>{state.fieldErrors.action}</FieldError> : null}
        </Field>
        <FieldSet>
          <FieldLegend>Conditions</FieldLegend>
          <FieldDescription>Choose what a transaction must match before this action runs.</FieldDescription>
          <FieldGroup className="gap-3">
            {conditionRows.map(({ condition, id }, index) => {
              const isMerchant = condition.field === "merchant";
              const isAmount = condition.field === "amount";
              const inputId = `${formId}-condition-${index}`;
              const nextCondition = conditionRows[index + 1]?.condition;
              const nextInputId = `${formId}-condition-${index + 1}`;
              const conditionRowClassName =
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(7rem,0.8fr)_minmax(8rem,1fr)_minmax(0,1fr)_auto]";
              return (
                <Fragment key={id}>
                  <div data-condition-row={index + 1}>
                    <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.conditions)}>
                      <div className={conditionRowClassName}>
                        <div className="min-w-0">
                          <FieldLabel className="sr-only" htmlFor={`${inputId}-field`}>
                            Condition {index + 1} field
                          </FieldLabel>
                          <Select value={condition.field} onValueChange={(value) => changeField(index, value as AutomationConditionField)}>
                            <SelectTrigger id={`${inputId}-field`} size="lg" className="w-full rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {textConditionFieldOptions.map((option) => (
                                  <SelectItem key={option.value} className="min-h-11" value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                                <SelectItem className="min-h-11" value="amount">
                                  Amount
                                </SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="min-w-0">
                          <FieldLabel className="sr-only" htmlFor={`${inputId}-operator`}>
                            {index === 0 && isMerchant ? "Merchant match" : "Match operator"}
                          </FieldLabel>
                          <Select value={condition.operator} onValueChange={(value) => updateOperator(index, value)}>
                            <SelectTrigger
                              id={index === 0 && isMerchant ? `${formId}-match-mode` : `${inputId}-operator`}
                              size="lg"
                              className="w-full rounded-xl"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {(isAmount ? amountConditionOperatorOptions : textConditionOperatorOptions).map((option) => (
                                  <SelectItem key={option.value} className="min-h-11" value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="min-w-0">
                          <FieldLabel className="sr-only" htmlFor={inputId}>
                            {index === 0 && isMerchant ? "Merchant text" : isAmount ? "Amount value" : "Text value"}
                          </FieldLabel>
                          <Input
                            ref={(element) => {
                              conditionInputRefs.current[index] = element;
                              if (index === 0 && isMerchant) merchantTextRef.current = element;
                            }}
                            id={inputId}
                            name={index === 0 && isMerchant ? "matchValue" : `condition-${index}-value`}
                            type={isAmount ? "number" : "text"}
                            inputMode={isAmount ? "decimal" : undefined}
                            min={isAmount ? 0 : undefined}
                            step={isAmount ? "0.01" : undefined}
                            value={String(condition.value)}
                            onChange={(event) => updateValue(index, isAmount ? Number(event.target.value) : event.target.value)}
                            maxLength={isAmount ? undefined : condition.field === "merchant" ? 200 : 500}
                            autoComplete="off"
                            className="h-11"
                            aria-label={`${condition.field === "merchant" ? "Merchant" : condition.field === "note" ? "Note" : "Amount"} value`}
                            aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.conditions || state.fieldErrors.pattern)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 shrink-0"
                          aria-label={`Remove condition ${index + 1}`}
                          onClick={() => removeCondition(index)}
                          disabled={conditionRows.length === 1}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                      {state?.status === "error" && index === 0 ? (
                        <FieldError>{state.fieldErrors.conditions ?? state.fieldErrors.pattern}</FieldError>
                      ) : null}
                    </Field>
                  </div>
                  {nextCondition ? (
                    <div
                      data-connector-after-condition={index + 1}
                      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-1"
                    >
                      <Separator className="min-w-0 bg-primary/20" />
                      <FieldLabel className="sr-only" htmlFor={`${nextInputId}-connector`}>
                        Condition {index + 2} connector
                      </FieldLabel>
                      <Select
                        value={nextCondition.connector ?? "and"}
                        onValueChange={(value) => updateConnector(index + 1, value as AutomationConditionConnector)}
                      >
                        <SelectTrigger
                          id={`${nextInputId}-connector`}
                          size="sm"
                          aria-label={`Condition ${index + 2} connector`}
                          className="w-20 rounded-full border-primary/30 bg-primary/10 px-2 text-primary hover:bg-primary/15"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {conditionConnectorOptions.map((option) => (
                              <SelectItem key={option.value} className="min-h-11" value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Separator className="min-w-0 bg-primary/20" />
                    </div>
                  ) : null}
                </Fragment>
              );
            })}
          </FieldGroup>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-fit rounded-xl text-primary hover:text-primary"
            onClick={addCondition}
          >
            <Plus data-icon="inline-start" />
            Add condition
          </Button>
        </FieldSet>
        {action === "normalize_merchant" ? (
          <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.replacement)}>
            <FieldLabel htmlFor={`${formId}-replacement`}>Replacement</FieldLabel>
            <Input
              ref={replacementRef}
              id={`${formId}-replacement`}
              name="replacement"
              defaultValue={rule?.replacement ?? ""}
              maxLength={200}
              autoComplete="off"
              className="min-h-11"
              aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.replacement)}
            />
            {state?.status === "error" ? <FieldError>{state.fieldErrors.replacement}</FieldError> : null}
          </Field>
        ) : action === "assign_category" ? (
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
                popoverContainer={popoverContainer}
                grouped
                options={destinations.map((option) => ({
                  value: destinationValue(option),
                  label: option.pickerLabel ?? option.label,
                  ...(option.section ? { section: option.section } : {}),
                  ...(option.isBills ? { description: "Uses the transaction month as the billing period." } : {}),
                  color: option.color,
                  icon: categoryIcon(option.icon ?? "tag"),
                }))}
              />
              {destinationError ? <FieldError id={`${formId}-destination-error`}>{destinationError}</FieldError> : null}
            </Field>
          </>
        ) : null}
        {state?.status === "error" ? <FieldError aria-live="polite">{state.formError}</FieldError> : null}
        <Button type="submit" disabled={isPending} className="min-h-11 w-full rounded-xl">
          {rule ? "Save rule" : "Add rule"}
        </Button>
      </FieldGroup>
    </form>
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
  const [editSheetContent, setEditSheetContent] = useState<HTMLElement | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [enabled, setEnabled] = useOptimistic(rule.enabled, (_current, nextEnabled: boolean) => nextEnabled);
  const [togglePending, startToggling] = useTransition();
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    async () => deleteAutomationRule(rule.id),
    null,
  );

  useEffect(() => {
    if (deleteState?.status === "success") toast.success("Rule deleted", { id: `automation-delete-${rule.id}` });
    if (deleteState?.status === "error") toast.error(deleteState.formError, { id: `automation-delete-${rule.id}` });
  }, [deleteState, rule.id]);
  const toggleRule = (nextEnabled: boolean) => {
    startToggling(async () => {
      setEnabled(nextEnabled);
      const result = await setAutomationRuleEnabled(rule.id, nextEnabled);
      if (result.status === "error") toast.error(result.formError, { id: `automation-toggle-${rule.id}` });
      else toast.success(nextEnabled ? "Rule enabled" : "Rule disabled", { id: `automation-toggle-${rule.id}` });
    });
  };

  return (
    <Sheet open={editOpen} onOpenChange={setEditOpen}>
      <div
        ref={ref}
        className={cn(
          "flex min-h-14 flex-wrap items-center gap-2 rounded-xl border border-border/70 px-2 py-2 sm:flex-nowrap",
          !enabled && "border-border/40 bg-muted/20",
          isDragging && "opacity-60",
        )}
      >
        <Button
          ref={handleRef}
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "hidden size-11 cursor-grab touch-none text-muted-foreground active:cursor-grabbing sm:inline-flex",
            !enabled && "opacity-60",
          )}
          aria-label={`Reorder ${label} rule`}
          aria-describedby="automation-sort-instructions"
          disabled={!canReorder}
        >
          <GripVertical aria-hidden="true" />
        </Button>
        <div className="order-last ml-auto hidden items-center gap-1 sm:flex">
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Edit ${label} rule`}>
              <Pencil aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <Switch
            checked={enabled}
            disabled={togglePending}
            aria-label={`${enabled ? "Disable" : "Enable"} ${label} rule`}
            className="h-6 w-11 translate-y-0.5"
            onCheckedChange={toggleRule}
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className={cn("min-w-0", !enabled && "opacity-60")}>
            <span className="block truncate text-sm text-muted-foreground">
              <RuleConditionSummary rule={rule} />
            </span>
          </span>
          <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          {rule.action === "assign_category" ? (
            <Badge className={cn("max-w-64 truncate", !enabled && "opacity-60")} variant="secondary">
              <CategoryIcon name={destination?.icon} data-icon="inline-start" />
              {destination?.pickerLabel ?? destination?.label ?? "Missing destination"}
            </Badge>
          ) : rule.action === "normalize_merchant" ? (
            <span className={cn("shrink-0 text-sm font-medium text-muted-foreground", !enabled && "opacity-60")}>
              “{rule.replacement ?? "Missing replacement"}”
            </span>
          ) : (
            <span className={cn("shrink-0 text-sm font-medium text-destructive", !enabled && "opacity-60")}>Delete</span>
          )}
        </div>
        <SheetContent
          ref={setEditSheetContent}
          side="right"
          className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto overscroll-contain border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl data-[side=right]:md:w-[36rem] data-[side=right]:md:max-w-[calc(100vw-2rem)]"
        >
          <SheetHeader className="p-6">
            <SheetTitle className="text-xl">Edit rule</SheetTitle>
            <SheetDescription>Update this merchant rule without changing its priority.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-6 pb-6">
            <AutomationRuleForm
              destinations={destinations}
              popoverContainer={editSheetContent}
              rule={rule}
              onSaved={() => setEditOpen(false)}
            />
            <div className="flex justify-end">
              <RuleDeleteDialog
                deleteAction={deleteAction}
                deletePending={deletePending}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 text-destructive"
                    aria-label={`Delete ${label} rule`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                }
              />
            </div>
          </div>
        </SheetContent>
        <div className="ml-auto flex items-center gap-1">
          <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-11 sm:hidden" aria-label={`More actions for ${label} rule`}>
                <Ellipsis aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto overscroll-contain border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl data-[side=right]:md:w-96 data-[side=right]:md:max-w-[calc(100vw-2rem)]"
            >
              <SheetHeader className="p-6">
                <SheetTitle className="text-xl">Rule actions</SheetTitle>
                <SheetDescription>
                  {label} · {ruleConditionSummary(rule)}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-6 pb-6">
                <Button
                  ref={handleRef}
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full justify-start"
                  aria-label={`Reorder ${label} rule`}
                  aria-describedby="automation-sort-instructions"
                  disabled={!canReorder}
                >
                  <GripVertical data-icon="inline-start" aria-hidden="true" />
                  Reorder rule
                </Button>
                <div className="flex min-h-11 items-center justify-between rounded-lg border border-border px-3">
                  <span className="text-sm">{enabled ? "Disable rule" : "Enable rule"}</span>
                  <Switch
                    checked={enabled}
                    disabled={togglePending}
                    aria-label={`${enabled ? "Disable" : "Enable"} ${label} rule`}
                    className="h-6 w-11"
                    onCheckedChange={toggleRule}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </Sheet>
  );
}

function AutomationPreviewList({
  changes,
  className,
  destinations,
  label,
}: {
  changes: MerchantAutomationPreview["changes"];
  className?: string;
  destinations: AutomationDestination[];
  label: string;
}) {
  if (changes.length === 0) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        No existing transactions would change.
      </p>
    );
  }

  return (
    <ul className={cn("flex flex-col gap-2", className)} aria-label={label}>
      {changes.map((change) => {
        if (change.delete_transaction) {
          return (
            <li key={change.id} className="rounded-lg border border-destructive/30 p-3">
              <p className="font-medium">Delete “{change.expected_merchant}”</p>
              <p className="text-sm text-muted-foreground">This transaction will be permanently deleted.</p>
            </li>
          );
        }
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
    async () => applyAutomationResults(preview.fingerprint),
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
          Apply
          <WandSparkles data-icon="inline-end" aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Apply {preview.changes.length} automation {preview.changes.length === 1 ? "change" : "changes"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Review the preview below. Applying updates or permanently deletes these existing transactions atomically and cannot be undone
            here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AutomationPreviewList
          changes={preview.changes}
          className="max-h-64 overflow-y-auto"
          destinations={destinations}
          label="Existing transaction changes"
        />
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
  const [addSheetContent, setAddSheetContent] = useState<HTMLElement | null>(null);
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
            ref={setAddSheetContent}
            side="right"
            className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto overscroll-contain border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl data-[side=right]:md:w-[36rem] data-[side=right]:md:max-w-[calc(100vw-2rem)]"
          >
            <SheetHeader className="p-6">
              <SheetTitle className="text-xl">Add rule</SheetTitle>
              <SheetDescription>Create one merchant normalization or category rule.</SheetDescription>
            </SheetHeader>
            <div className="px-6 pb-6">
              <AutomationRuleForm destinations={destinations} popoverContainer={addSheetContent} onSaved={() => setAddOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      }
    >
      <div className="mt-6 flex flex-col gap-4">
        <p id="automation-sort-instructions" className="sr-only">
          Press Space or Enter to pick up a rule, use the arrow keys to move it, then press Space or Enter to drop it.
        </p>
        {!completeRuleList ? (
          <p role="status" className="text-sm text-muted-foreground">
            Showing {orderedRules.length} of {count} rules. Reordering and bulk preview require the complete list.
          </p>
        ) : null}
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
          <Card className="border-white/50 bg-card/90">
            <CardHeader>
              <CardTitle>All rules</CardTitle>
              <CardDescription>Drag rules into one shared order. Priority is evaluated separately for each action.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {orderedRules.length > 0 ? (
                orderedRules.map((rule, index) => (
                  <SortableRule key={rule.id} canReorder={canReorder} destinations={destinations} index={index} rule={rule} />
                ))
              ) : (
                <div className="flex min-h-24 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <WandSparkles aria-hidden="true" />
                  <p>No automation rules yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </DragDropProvider>
      </div>
      <Card className="mt-5 border-white/50 bg-card/90">
        <CardHeader>
          <CardTitle>Existing transactions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <AutomationPreviewList changes={preview.changes} destinations={destinations} label="Existing transaction preview" />
            <ApplyPreviewControl destinations={destinations} disabled={!completeRuleList || reordering} preview={preview} />
          </div>
          {preview.conflicts.length > 0 ? (
            <ul aria-label="Priority conflicts" className="flex flex-col gap-2">
              {preview.conflicts.map((conflict) => {
                const winner = orderedRules.find((rule) => rule.id === conflict.winnerId);
                const shadowed = conflict.shadowedRuleIds
                  .map((id) => orderedRules.find((rule) => rule.id === id))
                  .filter((rule): rule is MerchantAutomationRule => Boolean(rule));
                return (
                  <li
                    key={`${conflict.action}:${conflict.winnerId}:${conflict.shadowedRuleIds.join(",")}`}
                    className="text-sm text-muted-foreground"
                  >
                    {actionLabel(conflict.action)}: {winner ? ruleConditionSummary(winner) : "Higher-priority rule"} wins over{" "}
                    {shadowed.map(ruleConditionSummary).join(", ") || "lower-priority rules"} for {conflict.transactionCount}{" "}
                    {conflict.transactionCount === 1 ? "transaction" : "transactions"}.
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
