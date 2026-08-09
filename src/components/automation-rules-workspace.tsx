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
import { Check, ClipboardCheck, Ellipsis, GripVertical, MoveRight, Pencil, Plus, Settings2, Trash2, WandSparkles, X } from "lucide-react";
import { toast } from "sonner";

import {
  applyAutomationResult,
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
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  amountConditionOperatorOptions,
  compatibilityPattern,
  conditionConnectorOptions,
  connectorForCondition,
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

type AutomationRuleFilter = "all" | "enabled" | "disabled";
type AutomationRuleGroup = "list" | "action";

const ruleActionOrder: MerchantAutomationRule["action"][] = ["normalize_merchant", "assign_category", "delete_transaction"];

export function getVisibleAutomationRules(rules: MerchantAutomationRule[], filter: AutomationRuleFilter) {
  if (filter === "all") return rules;
  return rules.filter((rule) => rule.enabled === (filter === "enabled"));
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
  const fieldLabel = condition.field === "merchant" ? "Merchant" : condition.field === "note" ? "Note" : "Amount";
  const operatorLabel =
    condition.field === "amount"
      ? amountConditionOperatorOptions.find((option) => option.value === condition.operator)?.label
      : condition.operator === "advanced"
        ? "Matches regex"
        : textConditionOperatorOptions.find((option) => option.value === condition.operator)?.label;

  return (
    <>
      {fieldLabel} {operatorLabel ?? condition.operator}{" "}
      <Badge variant="outline" className="normal-case bg-muted/50">
        {condition.value}
      </Badge>
    </>
  );
}

function RuleConditionSummary({ rule }: { rule: MerchantAutomationRule }) {
  if (!rule.conditions) {
    const decoded = decodeMerchantPattern(rule.pattern);
    return <ConditionSummaryLabel condition={{ field: "merchant", operator: decoded.mode, value: decoded.value }} />;
  }
  return rule.conditions.conditions.map((condition, index) => (
    <Fragment key={`${condition.field}-${index}`}>
      {index > 0 ? (
        <span className="mx-1 font-semibold text-primary">{` ${connectorForCondition(rule.conditions!, index)?.toUpperCase()} `}</span>
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

function SortableConditionRow({
  children,
  id,
  index,
}: {
  children: (sortable: { handleRef: (element: HTMLButtonElement | null) => void; isDragging: boolean }) => ReactNode;
  id: string;
  index: number;
}) {
  const { handleRef, isDragging, ref } = useSortable({ id, index });
  return (
    <div ref={ref} data-condition-row={index + 1} className={cn(isDragging && "opacity-60")}>
      {children({ handleRef, isDragging })}
    </div>
  );
}

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
  onBeforeSave,
  onSaved,
  popoverContainer,
  rule,
}: {
  destinations: AutomationDestination[];
  onBeforeSave?: () => void;
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
    <form action={formAction} noValidate onSubmit={onBeforeSave}>
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
          <DragDropProvider
            onDragEnd={(event) => {
              setConditionRows((previous) => {
                const reordered = move(previous, event);
                if (reordered.every((row, index) => row.id === previous[index]?.id)) return previous;
                const conditions = preserveConditionConnectorPositions(
                  previous.map((row) => row.condition),
                  reordered.map((row) => row.condition),
                );
                return reordered.map((row, index) => ({ ...row, condition: conditions[index]! }));
              });
            }}
          >
            <FieldGroup className="gap-3">
              {conditionRows.map(({ condition, id }, index) => {
                const isMerchant = condition.field === "merchant";
                const isAmount = condition.field === "amount";
                const inputId = `${formId}-condition-${index}`;
                const nextCondition = conditionRows[index + 1]?.condition;
                const nextInputId = `${formId}-condition-${index + 1}`;
                const conditionRowClassName =
                  "grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[auto_minmax(7rem,0.8fr)_minmax(8rem,1fr)_minmax(0,1fr)_auto]";
                return (
                  <SortableConditionRow key={id} id={id} index={index}>
                    {({ handleRef, isDragging }) => (
                      <>
                        <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.conditions)}>
                          <div className={cn(conditionRowClassName, isDragging && "opacity-60")}>
                            <Button
                              ref={handleRef}
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="row-span-2 size-11 shrink-0 cursor-grab touch-none self-center text-muted-foreground active:cursor-grabbing sm:row-auto"
                              aria-label={`Reorder condition ${index + 1}`}
                            >
                              <GripVertical aria-hidden="true" />
                            </Button>
                            <div className="col-span-2 min-w-0 sm:col-span-1">
                              <FieldLabel className="sr-only" htmlFor={`${inputId}-field`}>
                                Condition {index + 1} field
                              </FieldLabel>
                              <Select
                                value={condition.field}
                                onValueChange={(value) => changeField(index, value as AutomationConditionField)}
                              >
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
                                aria-invalid={
                                  state?.status === "error" && Boolean(state.fieldErrors.conditions || state.fieldErrors.pattern)
                                }
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="col-start-4 row-span-2 row-start-1 size-11 shrink-0 self-center sm:col-auto sm:row-auto"
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
                                className="min-h-11 w-20 rounded-full border-primary/30 bg-primary/10 px-2 text-primary hover:bg-primary/15"
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
                      </>
                    )}
                  </SortableConditionRow>
                );
              })}
            </FieldGroup>
          </DragDropProvider>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-fit rounded-xl text-primary hover:text-primary"
            onClick={addCondition}
            disabled={conditionRows.length >= 8}
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
  onBeforeSave,
  onSaved,
  rule,
}: {
  canReorder: boolean;
  destinations: AutomationDestination[];
  index: number;
  onBeforeSave?: () => void;
  onSaved?: () => void;
  rule: MerchantAutomationRule;
}) {
  const label = actionLabel(rule.action);
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
          "flex min-h-14 flex-wrap items-center gap-2 rounded-xl border border-border/70 px-2 py-2 transition-[background-color,border-color,box-shadow] hover:border-border hover:bg-foreground/2 hover:shadow-sm sm:flex-nowrap",
          enabled ? "bg-card" : "border-border/40 bg-muted/20",
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
        <div className="order-last ml-auto hidden items-center justify-end gap-0.5 sm:flex">
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-11 -translate-x-1" aria-label={`Edit ${label} rule`}>
              <Pencil aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <Switch
            checked={enabled}
            disabled={togglePending}
            aria-label={`${enabled ? "Disable" : "Enable"} ${label} rule`}
            className="h-6 w-11"
            onCheckedChange={toggleRule}
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className={cn("min-w-0", !enabled && "opacity-60")}>
            <span className="block truncate text-sm text-foreground">
              <RuleConditionSummary rule={rule} />
            </span>
          </span>
          <MoveRight aria-hidden="true" className="size-4 shrink-0 text-primary" />
          {rule.action === "assign_category" ? (
            <Badge variant="outline" color={destination?.color} className={cn("max-w-64 truncate", !enabled && "opacity-60")}>
              <CategoryIcon name={destination?.icon} data-icon="inline-start" />
              {destination?.pickerLabel ?? destination?.label ?? "Missing destination"}
            </Badge>
          ) : rule.action === "normalize_merchant" ? (
            <Badge className={cn("max-w-64 truncate bg-muted/50", !enabled && "opacity-60")} variant="outline">
              {rule.replacement ?? "Missing replacement"}
            </Badge>
          ) : (
            <Badge className={cn("border-destructive/30", !enabled && "opacity-60")} variant="destructive">
              Delete
            </Badge>
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
              onBeforeSave={onBeforeSave}
              popoverContainer={editSheetContent}
              rule={rule}
              onSaved={() => {
                setEditOpen(false);
                onSaved?.();
              }}
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

function AutomationPreviewChangeSummary({
  change,
  destinations,
}: {
  change: MerchantAutomationPreview["changes"][number];
  destinations: AutomationDestination[];
}) {
  const renderDestinationPath = (label: string) =>
    label.split(" → ").map((segment, index) => (
      <Fragment key={`${segment}-${index}`}>
        {index > 0 ? <MoveRight aria-hidden="true" className="mx-1 inline-block size-4 align-[-0.2em] text-primary" /> : null}
        {segment}
      </Fragment>
    ));

  if (change.delete_transaction) {
    return (
      <>
        <p className="truncate text-xs text-muted-foreground">{change.expected_merchant}</p>
        <p className="truncate text-sm font-medium">Delete permanently</p>
      </>
    );
  }

  const merchantChanged = change.expected_merchant !== change.merchant;
  const destinationChanged = change.expected_category_id !== change.category_id || change.expected_subcategory_id !== change.subcategory_id;
  const destinationLabel = (categoryId: string | null, subcategoryId: string | null) => {
    if (!categoryId && !subcategoryId) return "Uncategorized";
    return (
      destinations.find((option) => option.categoryId === categoryId && option.subcategoryId === subcategoryId)?.label ??
      "Existing destination"
    );
  };

  return (
    <>
      <p className="truncate text-xs text-muted-foreground">{change.expected_merchant}</p>
      {merchantChanged ? (
        <p className="truncate text-sm font-medium">
          {change.expected_merchant} <MoveRight aria-hidden="true" className="mx-1 inline-block size-4 align-[-0.2em] text-primary" />{" "}
          {change.merchant}
        </p>
      ) : null}
      {destinationChanged ? (
        <p className="truncate text-sm font-medium">
          {renderDestinationPath(destinationLabel(change.expected_category_id, change.expected_subcategory_id))}
          <MoveRight aria-hidden="true" className="mx-1 inline-block size-4 align-[-0.2em] text-primary" />
          {renderDestinationPath(destinationLabel(change.category_id, change.subcategory_id))}
        </p>
      ) : null}
    </>
  );
}

function AutomationPreviewList({
  changes,
  destinations,
  isPending,
  label,
  onApply,
}: {
  changes: MerchantAutomationPreview["changes"];
  destinations: AutomationDestination[];
  isPending: boolean;
  label: string;
  onApply: (changeId: string) => void;
}) {
  return (
    <ul className="flex min-w-0 w-full max-h-[min(50dvh,28rem)] flex-col gap-3 overflow-y-auto overscroll-contain pr-1" aria-label={label}>
      {changes.map((change) => (
        <li
          key={change.id}
          className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-white/60 p-4 text-sm transition-[background-color,border-color,box-shadow] hover:border-border hover:bg-foreground/2 hover:shadow-sm"
        >
          <div className="min-w-0 flex-1">
            <AutomationPreviewChangeSummary change={change} destinations={destinations} />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            aria-label={`Apply change for ${change.expected_merchant}`}
            disabled={isPending}
            onClick={() => onApply(change.id)}
          >
            <Check aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function AutomationPreviewDialog({
  destinations,
  onOpenChange,
  open,
  preview,
  rules,
}: {
  destinations: AutomationDestination[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  preview: MerchantAutomationPreview;
  rules: MerchantAutomationRule[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    async () => applyAutomationResults(preview.fingerprint),
    null,
  );
  const [isApplyingChange, startApplyingChange] = useTransition();
  const changeCount = preview.changes.length;
  const applyChange = (changeId: string) => {
    startApplyingChange(async () => {
      const result = await applyAutomationResult(preview.fingerprint, changeId);
      if (result.status === "success") {
        toast.success("1 automation change applied", { id: "automation-apply" });
      } else if (result.status === "error") {
        toast.error(result.formError, { id: "automation-apply" });
      }
    });
  };

  useEffect(() => {
    if (state?.status === "success") {
      toast.success(`${changeCount} automation ${changeCount === 1 ? "change" : "changes"} applied`, { id: "automation-apply" });
      onOpenChange(false);
    } else if (state?.status === "error") {
      toast.error(state.formError, { id: "automation-apply" });
    }
  }, [changeCount, onOpenChange, state]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="min-w-0 w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-hidden sm:w-[calc(100vw-4rem)] data-[size=default]:sm:max-w-5xl">
        <AlertDialogHeader className="min-w-0 w-full">
          <AlertDialogTitle className="text-xl">Preview</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">Review and apply existing transaction changes.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogCancel
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 size-11 opacity-60"
          aria-label="Close preview"
        >
          <X aria-hidden="true" />
        </AlertDialogCancel>
        <AutomationPreviewList
          changes={preview.changes}
          destinations={destinations}
          isPending={isPending || isApplyingChange}
          label="Existing transaction changes"
          onApply={applyChange}
        />
        {preview.conflicts.length > 0 ? (
          <ul aria-label="Priority conflicts" className="flex min-w-0 flex-col gap-2">
            {preview.conflicts.map((conflict) => {
              const winner = rules.find((rule) => rule.id === conflict.winnerId);
              const shadowed = conflict.shadowedRuleIds
                .map((id) => rules.find((rule) => rule.id === id))
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
        {state?.status === "error" ? <FieldError aria-live="polite">{state.formError}</FieldError> : null}
        <AlertDialogFooter>
          <form action={formAction} className="flex w-full justify-end">
            <Button type="submit" className="min-h-11" disabled={isPending || isApplyingChange}>
              <Check data-icon="inline-start" aria-hidden="true" />
              Apply all {changeCount}
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AutomationRuleViewConfig({
  filter,
  group,
  onFilterChange,
  onGroupChange,
}: {
  filter: AutomationRuleFilter;
  group: AutomationRuleGroup;
  onFilterChange: (filter: AutomationRuleFilter) => void;
  onGroupChange: (group: AutomationRuleGroup) => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" size="icon" variant="ghost" className="size-11" aria-label="Configure rule view">
          <Settings2 aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg"
      >
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Rule view</SheetTitle>
          <SheetDescription>Filter visible rules and group them without changing their saved priority.</SheetDescription>
        </SheetHeader>
        <FieldGroup className="px-6 pb-6">
          <Field>
            <FieldLabel>Status</FieldLabel>
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(value) => {
                if (value) onFilterChange(value as AutomationRuleFilter);
              }}
              variant="outline"
              spacing={0}
              className="w-full"
              aria-label="Filter rules by status"
            >
              <ToggleGroupItem value="all" className="min-h-11 flex-1">
                All
              </ToggleGroupItem>
              <ToggleGroupItem value="enabled" className="min-h-11 flex-1">
                Enabled
              </ToggleGroupItem>
              <ToggleGroupItem value="disabled" className="min-h-11 flex-1">
                Disabled
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <Field>
            <FieldLabel>Group by</FieldLabel>
            <ToggleGroup
              type="single"
              value={group}
              onValueChange={(value) => {
                if (value) onGroupChange(value as AutomationRuleGroup);
              }}
              variant="outline"
              spacing={0}
              className="w-full"
              aria-label="Group visible rules"
            >
              <ToggleGroupItem value="list" className="min-h-11 flex-1">
                List
              </ToggleGroupItem>
              <ToggleGroupItem value="action" className="min-h-11 flex-1">
                Action
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
        </FieldGroup>
      </SheetContent>
    </Sheet>
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRequestedFrom, setPreviewRequestedFrom] = useState<string | null>(null);
  const [ruleFilter, setRuleFilter] = useState<AutomationRuleFilter>("all");
  const [ruleGroup, setRuleGroup] = useState<AutomationRuleGroup>("list");
  const [orderedRules, setOrderedRules] = useOptimistic(rules, (_current, next: MerchantAutomationRule[]) => next);
  const [reordering, startReordering] = useTransition();
  const completeRuleList = count === orderedRules.length;
  const visibleRules = getVisibleAutomationRules(orderedRules, ruleFilter);
  const canReorder = completeRuleList && ruleFilter === "all" && ruleGroup === "list" && orderedRules.length > 1 && !reordering;
  const canReview = completeRuleList && preview.changes.length > 0;
  const requestPreviewBeforeSave = () => setPreviewRequestedFrom(preview.fingerprint);

  useEffect(() => {
    if (!previewRequestedFrom || preview.fingerprint === previewRequestedFrom) return;
    const frame = requestAnimationFrame(() => {
      setPreviewRequestedFrom(null);
      if (canReview) setPreviewOpen(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [canReview, preview.fingerprint, previewRequestedFrom]);

  return (
    <WorkspaceShell
      title="Automations"
      description="Make familiar merchants consistent and categorized."
      actions={
        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="ghost" className="size-11 rounded-full text-primary" aria-label="Add rule">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-sm">
                <Plus aria-hidden="true" />
              </span>
            </Button>
          </SheetTrigger>
          <SheetContent
            ref={setAddSheetContent}
            side="right"
            className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto overscroll-contain border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl data-[side=right]:md:w-[36rem] data-[side=right]:md:max-w-[calc(100vw-2rem)]"
          >
            <SheetHeader className="p-6">
              <SheetTitle className="text-xl">Add rule</SheetTitle>
              <SheetDescription>Create one normalization, category, or deletion rule.</SheetDescription>
            </SheetHeader>
            <div className="px-6 pb-6">
              <AutomationRuleForm
                destinations={destinations}
                onBeforeSave={requestPreviewBeforeSave}
                popoverContainer={addSheetContent}
                onSaved={() => {
                  setAddOpen(false);
                }}
              />
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
            Showing {orderedRules.length} of {count} rules. Reordering and review require the complete list.
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
              <CardDescription>
                Drag rules into one shared order. Priority is evaluated separately for each action.
                {canReorder ? null : " Clear view controls to reorder."}
              </CardDescription>
              <CardAction className="flex items-center gap-1">
                <AutomationRuleViewConfig
                  filter={ruleFilter}
                  group={ruleGroup}
                  onFilterChange={setRuleFilter}
                  onGroupChange={setRuleGroup}
                />
                {canReview ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label="Review changes"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <ClipboardCheck aria-hidden="true" />
                  </Button>
                ) : null}
              </CardAction>
            </CardHeader>
            {canReview ? (
              <AutomationPreviewDialog
                destinations={destinations}
                onOpenChange={setPreviewOpen}
                open={previewOpen}
                preview={preview}
                rules={orderedRules}
              />
            ) : null}
            <CardContent className="flex flex-col gap-3">
              {orderedRules.length === 0 ? (
                <div className="flex min-h-24 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <WandSparkles aria-hidden="true" />
                  <p>No automation rules yet.</p>
                </div>
              ) : visibleRules.length === 0 ? (
                <p role="status" className="py-6 text-center text-sm text-muted-foreground">
                  No rules match these view settings.
                </p>
              ) : ruleGroup === "action" ? (
                ruleActionOrder.map((action) => {
                  const groupedRules = visibleRules.filter((rule) => rule.action === action);
                  if (!groupedRules.length) return null;
                  return (
                    <section key={action} aria-label={`${actionLabel(action)} rules`} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 px-1">
                        <h3 className="font-medium">{actionLabel(action)}</h3>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {groupedRules.length} {groupedRules.length === 1 ? "rule" : "rules"}
                        </span>
                      </div>
                      {groupedRules.map((rule) => (
                        <SortableRule
                          key={rule.id}
                          canReorder={canReorder}
                          destinations={destinations}
                          index={orderedRules.findIndex((orderedRule) => orderedRule.id === rule.id)}
                          onBeforeSave={requestPreviewBeforeSave}
                          rule={rule}
                        />
                      ))}
                    </section>
                  );
                })
              ) : (
                visibleRules.map((rule) => (
                  <SortableRule
                    key={rule.id}
                    canReorder={canReorder}
                    destinations={destinations}
                    index={orderedRules.findIndex((orderedRule) => orderedRule.id === rule.id)}
                    onBeforeSave={requestPreviewBeforeSave}
                    rule={rule}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </DragDropProvider>
      </div>
    </WorkspaceShell>
  );
}
