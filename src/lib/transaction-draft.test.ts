import { describe, expect, it } from "vitest";

import {
  initializeTransactionDraft,
  projectTransactionDraftFields,
  transactionDraftReducer,
  type TransactionDraft,
} from "./transaction-draft";

const baseDraft = (): TransactionDraft => ({
  kind: "expense",
  occurredOn: "2026-07-14",
  paidBy: "member-1",
  destination: null,
  servicePeriod: null,
});

describe("transaction draft", () => {
  it("initializes saved Bills state and preserves imported unassigned values", () => {
    expect(
      initializeTransactionDraft({
        kind: "expense",
        occurredOn: "2026-07-14",
        paidBy: "member-1",
        subcategoryId: "electricity",
        isBillsSubcategory: true,
        servicePeriodStart: "2026-06-15",
        servicePeriodEnd: "2026-07-14",
      }),
    ).toEqual({
      kind: "expense",
      occurredOn: "2026-07-14",
      paidBy: "member-1",
      destination: { type: "subcategory", id: "electricity", isBills: true },
      servicePeriod: { start: "2026-06-15", end: "2026-07-14" },
    });
    expect(initializeTransactionDraft({ kind: "expense", occurredOn: "2026-07-14", paidBy: null })).toEqual({
      ...baseDraft(),
      paidBy: "",
    });
  });

  it("clears destination and service period permanently when kind changes", () => {
    const selected = transactionDraftReducer(baseDraft(), {
      type: "destination_changed",
      destination: { type: "subcategory", id: "electricity", isBills: true },
    });
    const income = transactionDraftReducer(selected, { type: "kind_changed", kind: "income" });
    const expense = transactionDraftReducer(income, { type: "kind_changed", kind: "expense" });

    expect(selected.servicePeriod).toEqual({ start: "2026-07-14", end: "2026-07-14" });
    expect(expense).toEqual({ ...baseDraft(), paidBy: "member-1" });
  });

  it("initializes Bills periods and clears them for every non-Bills destination", () => {
    const bills = transactionDraftReducer(baseDraft(), {
      type: "destination_changed",
      destination: { type: "subcategory", id: "electricity", isBills: true },
    });
    const groceries = transactionDraftReducer(bills, {
      type: "destination_changed",
      destination: { type: "subcategory", id: "groceries", isBills: false },
    });
    const other = transactionDraftReducer(bills, {
      type: "destination_changed",
      destination: { type: "category", id: "other-expense" },
    });

    expect(bills.servicePeriod).toEqual({ start: "2026-07-14", end: "2026-07-14" });
    expect(groceries.servicePeriod).toBeNull();
    expect(other.servicePeriod).toBeNull();
  });

  it("keeps separately selected service-period dates ordered", () => {
    const bills = transactionDraftReducer(baseDraft(), {
      type: "destination_changed",
      destination: { type: "subcategory", id: "electricity", isBills: true },
    });
    const laterStart = transactionDraftReducer(bills, { type: "service_period_start_changed", date: "2026-07-20" });
    const earlierEnd = transactionDraftReducer(laterStart, { type: "service_period_end_changed", date: "2026-07-15" });

    expect(laterStart.servicePeriod).toEqual({ start: "2026-07-20", end: "2026-07-20" });
    expect(earlierEnd.servicePeriod).toEqual({ start: "2026-07-15", end: "2026-07-15" });
  });

  it("updates posting date and payer without rewriting an existing Bills period", () => {
    const bills = transactionDraftReducer(baseDraft(), {
      type: "destination_changed",
      destination: { type: "subcategory", id: "electricity", isBills: true },
    });
    const dated = transactionDraftReducer(bills, { type: "occurred_on_changed", occurredOn: "2026-08-01" });
    const paid = transactionDraftReducer(dated, { type: "paid_by_changed", paidBy: "member-2" });

    expect(paid).toMatchObject({ occurredOn: "2026-08-01", paidBy: "member-2" });
    expect(paid.servicePeriod).toEqual({ start: "2026-07-14", end: "2026-07-14" });
  });

  it("projects only eligible canonical form fields", () => {
    const draft: TransactionDraft = {
      ...baseDraft(),
      destination: { type: "subcategory", id: "electricity", isBills: true },
      servicePeriod: { start: "2026-06-15", end: "2026-07-14" },
    };

    expect(
      projectTransactionDraftFields(draft, {
        categoryIds: ["other-expense"],
        subcategoryIds: ["electricity"],
        memberIds: ["member-1"],
        defaultPaidBy: "member-1",
      }),
    ).toEqual({
      kind: "expense",
      occurredOn: "2026-07-14",
      categoryId: "",
      subcategoryId: "electricity",
      paidBy: "member-1",
      servicePeriodStart: "2026-06-15",
      servicePeriodEnd: "2026-07-14",
    });
    expect(
      projectTransactionDraftFields(
        { ...draft, paidBy: "missing" },
        {
          categoryIds: [],
          subcategoryIds: [],
          memberIds: ["member-1"],
          defaultPaidBy: "member-1",
        },
      ),
    ).toEqual({
      kind: "expense",
      occurredOn: "2026-07-14",
      categoryId: "",
      subcategoryId: "",
      paidBy: "member-1",
      servicePeriodStart: "",
      servicePeriodEnd: "",
    });
  });
});
