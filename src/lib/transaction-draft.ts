import { getIsoMonthRange } from "@/lib/date-range";

export type TransactionKind = "income" | "expense";

export type TransactionDestination = { type: "category"; id: string } | { type: "subcategory"; id: string; isBills: boolean } | null;

export type TransactionServicePeriod = { start: string; end: string } | null;

export type TransactionDraft = {
  kind: TransactionKind;
  occurredOn: string;
  paidBy: string;
  destination: TransactionDestination;
  servicePeriod: TransactionServicePeriod;
};

export type TransactionDraftEvent =
  | { type: "kind_changed"; kind: TransactionKind }
  | { type: "destination_changed"; destination: TransactionDestination }
  | { type: "occurred_on_changed"; occurredOn: string }
  | { type: "paid_by_changed"; paidBy: string }
  | { type: "service_period_start_changed"; date: string }
  | { type: "service_period_end_changed"; date: string }
  | { type: "service_period_month_changed"; month: string };

export function initializeTransactionDraft(input: {
  kind: TransactionKind;
  occurredOn: string;
  paidBy?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  isBillsSubcategory?: boolean;
  servicePeriodStart?: string | null;
  servicePeriodEnd?: string | null;
}): TransactionDraft {
  const destination: TransactionDestination = input.categoryId
    ? { type: "category", id: input.categoryId }
    : input.subcategoryId
      ? { type: "subcategory", id: input.subcategoryId, isBills: Boolean(input.isBillsSubcategory) }
      : null;
  const servicePeriod =
    destination?.type === "subcategory" && destination.isBills
      ? {
          start: input.servicePeriodStart ?? input.occurredOn,
          end: input.servicePeriodEnd ?? input.servicePeriodStart ?? input.occurredOn,
        }
      : null;
  return {
    kind: input.kind,
    occurredOn: input.occurredOn,
    paidBy: input.paidBy ?? "",
    destination,
    servicePeriod,
  };
}

export function transactionDraftReducer(draft: TransactionDraft, event: TransactionDraftEvent): TransactionDraft {
  switch (event.type) {
    case "kind_changed":
      return { ...draft, kind: event.kind, destination: null, servicePeriod: null };
    case "destination_changed":
      return {
        ...draft,
        destination: event.destination,
        servicePeriod:
          event.destination?.type === "subcategory" && event.destination.isBills
            ? (draft.servicePeriod ?? { start: draft.occurredOn, end: draft.occurredOn })
            : null,
      };
    case "occurred_on_changed":
      return { ...draft, occurredOn: event.occurredOn };
    case "paid_by_changed":
      return { ...draft, paidBy: event.paidBy };
    case "service_period_start_changed": {
      const end = draft.servicePeriod?.end && draft.servicePeriod.end >= event.date ? draft.servicePeriod.end : event.date;
      return { ...draft, servicePeriod: { start: event.date, end } };
    }
    case "service_period_end_changed": {
      const start = draft.servicePeriod?.start && draft.servicePeriod.start <= event.date ? draft.servicePeriod.start : event.date;
      return { ...draft, servicePeriod: { start, end: event.date } };
    }
    case "service_period_month_changed": {
      const range = getIsoMonthRange(event.month);
      return range ? { ...draft, servicePeriod: { start: range.from, end: range.to } } : draft;
    }
  }
}

export function projectTransactionDraftFields(
  draft: TransactionDraft,
  eligibility: {
    categoryIds: string[];
    subcategoryIds: string[];
    memberIds: string[];
    defaultPaidBy: string;
  },
) {
  const categoryId =
    draft.destination?.type === "category" && eligibility.categoryIds.includes(draft.destination.id) ? draft.destination.id : "";
  const subcategoryId =
    draft.destination?.type === "subcategory" && eligibility.subcategoryIds.includes(draft.destination.id) ? draft.destination.id : "";
  const paidBy = draft.paidBy === "" || eligibility.memberIds.includes(draft.paidBy) ? draft.paidBy : eligibility.defaultPaidBy;
  const hasBillsPeriod = subcategoryId !== "" && draft.destination?.type === "subcategory" && draft.destination.isBills;
  return {
    kind: draft.kind,
    occurredOn: draft.occurredOn,
    categoryId,
    subcategoryId,
    paidBy,
    servicePeriodStart: hasBillsPeriod ? (draft.servicePeriod?.start ?? "") : "",
    servicePeriodEnd: hasBillsPeriod ? (draft.servicePeriod?.end ?? "") : "",
  };
}
