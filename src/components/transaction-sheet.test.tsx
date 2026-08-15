import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  billingPeriodEndSelect: undefined as undefined | ((date: Date | undefined) => void),
  billingPeriodStartSelect: undefined as undefined | ((date: Date | undefined) => void),
  calendarDefaultMonths: [] as Array<Date | undefined>,
  categoryOptions: [] as Array<{
    color?: string;
    description?: string;
    icon?: unknown;
    label: string;
    section?: { id: string; label: string };
    value: string;
  }>,
  categoryChange: undefined as undefined | ((value: string) => void),
  actionState: null as null | { status: "error"; formError: string; fieldErrors: Record<string, string> },
  createTransaction: vi.fn(),
  deleteRecurringTransactionSchedule: vi.fn(),
  dateSelect: undefined as undefined | ((date: Date | undefined) => void),
  formAction: undefined as undefined | ((previousState: unknown, formData: FormData) => unknown),
  kindChange: undefined as undefined | ((value: string) => void),
  recurrenceChange: undefined as undefined | ((value: string) => void),
  pauseRecurringTransactionSchedule: vi.fn(),
  state: [] as unknown[],
  stateIndex: 0,
  updateRecurringTransactionSchedule: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    useActionState: (action: (previousState: unknown, formData: FormData) => unknown) => {
      mocks.formAction = action;
      return [mocks.actionState, () => {}, false];
    },
    useState: (initialState: unknown | (() => unknown)) => {
      const index = mocks.stateIndex++;
      if (!(index in mocks.state)) mocks.state[index] = typeof initialState === "function" ? initialState() : initialState;
      return [
        mocks.state[index],
        (nextState: unknown | ((current: unknown) => unknown)) => {
          mocks.state[index] = typeof nextState === "function" ? nextState(mocks.state[index]) : nextState;
        },
      ];
    },
    useReducer: (reducer: (state: unknown, action: unknown) => unknown, initialArg: unknown, initializer?: (value: unknown) => unknown) => {
      const index = mocks.stateIndex++;
      if (!(index in mocks.state)) mocks.state[index] = initializer ? initializer(initialArg) : initialArg;
      return [
        mocks.state[index],
        (action: unknown) => {
          mocks.state[index] = reducer(mocks.state[index], action);
        },
      ];
    },
  };
});

vi.mock("@/app/actions/transactions", () => ({
  createTransaction: mocks.createTransaction,
  deleteTransaction: vi.fn(),
  updateTransaction: vi.fn(),
}));
vi.mock("@/app/actions/recurring-transactions", () => ({
  deleteRecurringTransactionSchedule: mocks.deleteRecurringTransactionSchedule,
  pauseRecurringTransactionSchedule: mocks.pauseRecurringTransactionSchedule,
  updateRecurringTransactionSchedule: mocks.updateRecurringTransactionSchedule,
}));
vi.mock("@/components/pill-select", () => ({
  PillSelect: ({
    ariaLabel,
    emptyLabel,
    onValueChange,
    options,
    value,
  }: {
    ariaLabel: string;
    emptyLabel?: string;
    onValueChange?: (value: string) => void;
    options: Array<{
      color?: string;
      description?: string;
      icon?: unknown;
      label: string;
      section?: { id: string; label: string };
      value: string;
    }>;
    value?: string;
  }) => {
    if (ariaLabel === "Type") mocks.kindChange = onValueChange;
    if (ariaLabel === "Categories") {
      mocks.categoryOptions = options;
      mocks.categoryChange = onValueChange;
    }
    return <button aria-label={ariaLabel}>{options.find((option) => option.value === value)?.label ?? emptyLabel}</button>;
  },
}));
vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    defaultMonth,
    id,
    onSelect,
  }: {
    defaultMonth?: Date;
    id?: string;
    onSelect: (value: Date | { from?: Date; to?: Date } | undefined) => void;
  }) => {
    mocks.calendarDefaultMonths.push(defaultMonth);
    if (id === "billing-period-start-calendar") mocks.billingPeriodStartSelect = onSelect as typeof mocks.billingPeriodStartSelect;
    else if (id === "billing-period-end-calendar") mocks.billingPeriodEndSelect = onSelect as typeof mocks.billingPeriodEndSelect;
    else mocks.dateSelect = onSelect as typeof mocks.dateSelect;
    return <button type="button">Calendar</button>;
  },
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogAction: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange, value }: { children: ReactNode; onValueChange: (value: string) => void; value?: string }) => {
    const isTypeSelector = value === "income" || value === "expense";
    if (isTypeSelector) mocks.kindChange = onValueChange;
    else mocks.recurrenceChange = onValueChange;
    return <div data-select={isTypeSelector ? "transaction-kind" : "recurrence-cadence"}>{children}</div>;
  },
  SelectContent: ({ children }: { children: ReactNode }) => children,
  SelectGroup: ({ children }: { children: ReactNode }) => children,
  SelectItem: ({ children }: { children: ReactNode }) => children,
  SelectTrigger: ({ children, ...props }: { children: ReactNode } & React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => placeholder,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => children,
  SheetContent: ({ children }: { children: ReactNode }) => children,
  SheetDescription: ({ children }: { children: ReactNode }) => children,
  SheetHeader: ({ children }: { children: ReactNode }) => children,
  SheetTitle: ({ children }: { children: ReactNode }) => children,
  SheetTrigger: ({ children }: { children: ReactNode }) => children,
}));

import { TransactionSheet } from "./transaction-sheet";

function renderSheet() {
  mocks.stateIndex = 0;
  return renderToStaticMarkup(
    <TransactionSheet
      subcategories={[
        {
          id: "groceries",
          name: "Groceries",
          categoryId: "food",
          categoryName: "Food",
          kind: "expense",
          color: "#d9f0fa",
          icon: "utensils",
        },
        {
          id: "electricity",
          name: "Electricity",
          categoryId: "bills",
          categoryName: "Bills",
          kind: "expense",
          color: "#d9f0fa",
          icon: "zap",
        },
        {
          id: "salary",
          name: "Salary",
          categoryId: "income",
          categoryName: "Income",
          kind: "income",
          color: "#d9f0fa",
          icon: "briefcase-business",
        },
      ]}
      members={[]}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 14, 12));
  mocks.billingPeriodEndSelect = undefined;
  mocks.billingPeriodStartSelect = undefined;
  mocks.calendarDefaultMonths = [];
  mocks.categoryOptions = [];
  mocks.categoryChange = undefined;
  mocks.actionState = null;
  mocks.createTransaction.mockReset();
  mocks.dateSelect = undefined;
  mocks.formAction = undefined;
  mocks.kindChange = undefined;
  mocks.recurrenceChange = undefined;
  mocks.state = [];
  mocks.stateIndex = 0;
});

it("opens a new transaction calendar in the viewed ledger month", () => {
  renderToStaticMarkup(<TransactionSheet defaultMonth="2026-03" members={[]} />);

  expect(mocks.calendarDefaultMonths[0]?.toISOString()).toContain("2026-03-01");
});

it("uses a regular dropdown for transaction type without a search field", () => {
  const markup = renderSheet();

  expect(markup).toContain('data-select="transaction-kind"');
  expect(markup).toContain('id="transaction-kind"');
  expect(markup).not.toContain('aria-label="Type"');
  expect(markup).not.toContain("Search type…");
  expect(markup).toContain("border-negative/20 bg-negative/10 text-negative");
  expect(markup).toContain("border-positive/20 bg-positive/10 text-positive");
});

it("keeps recurring schedule controls in the transaction edit sheet", () => {
  const markup = renderToStaticMarkup(
    <TransactionSheet
      members={[]}
      transaction={{
        id: "recurring-transaction",
        kind: "expense",
        amount: 125,
        occurredOn: "2026-07-15",
        subcategoryId: null,
        note: "Monthly bill",
        merchant: "Electricity",
        recurringScheduleId: "schedule-id",
        createdAt: "2026-07-15T08:00:00Z",
        paidBy: null,
      }}
    />,
  );

  expect(markup).toContain("Recurring schedule");
  expect(markup).toContain("Active");
  expect(markup).toContain("Pause future repeats");
  expect(markup).toContain("Save future schedule");
  expect(markup).toContain("Apply to this transaction");
  expect(markup).toContain("Apply to future transactions");
  expect(markup).toContain("Apply to all transactions");
  expect(markup).toContain("Stop future repeats");
});

it("opens a new billing period calendar in the viewed ledger month", () => {
  const billsSubcategory = {
    id: "electricity",
    name: "Electricity",
    categoryId: "bills",
    categoryName: "Bills",
    kind: "expense" as const,
    color: "#d9f0fa",
    icon: "zap",
    categorySystemKey: "bills",
  };
  renderToStaticMarkup(<TransactionSheet defaultMonth="2026-03" subcategories={[billsSubcategory]} members={[]} />);
  mocks.categoryChange?.("electricity");
  mocks.stateIndex = 0;
  renderToStaticMarkup(<TransactionSheet defaultMonth="2026-03" subcategories={[billsSubcategory]} members={[]} />);

  expect(mocks.calendarDefaultMonths.at(-1)?.toISOString()).toContain("2026-03-01");
});

it("keeps separately selected billing dates in order", () => {
  const billsSubcategory = {
    id: "electricity",
    name: "Electricity",
    categoryId: "bills",
    categoryName: "Bills",
    kind: "expense" as const,
    color: "#d9f0fa",
    icon: "zap",
    categorySystemKey: "bills",
  };
  renderToStaticMarkup(<TransactionSheet subcategories={[billsSubcategory]} members={[]} />);
  mocks.categoryChange?.("electricity");
  mocks.stateIndex = 0;
  renderToStaticMarkup(<TransactionSheet subcategories={[billsSubcategory]} members={[]} />);
  mocks.billingPeriodStartSelect?.(new Date(2026, 6, 20, 12));
  mocks.stateIndex = 0;
  renderToStaticMarkup(<TransactionSheet subcategories={[billsSubcategory]} members={[]} />);
  mocks.billingPeriodEndSelect?.(new Date(2026, 6, 15, 12));
  mocks.stateIndex = 0;
  const markup = renderToStaticMarkup(<TransactionSheet subcategories={[billsSubcategory]} members={[]} />);

  expect(markup).toContain('name="servicePeriodStart" value="2026-07-15"');
  expect(markup).toContain('name="servicePeriodEnd" value="2026-07-15"');
});

afterEach(() => vi.useRealTimers());

type ImportedTransaction = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  occurredOn: string;
  subcategoryId: null;
  note: string;
  merchant: string;
  source: "statement_import";
  createdAt: string;
  paidBy: null;
};

it("renders the transaction composer with labelled core controls", () => {
  const markup = renderToStaticMarkup(
    <TransactionSheet
      subcategories={[
        {
          id: "salary",
          name: "Salary",
          categoryId: "income",
          categoryName: "Income",
          kind: "income",
          color: "#d9f0fa",
          icon: "briefcase-business",
        },
        {
          id: "groceries",
          name: "Groceries",
          categoryId: "food",
          categoryName: "Food",
          kind: "expense",
          color: "#d9f0fa",
          icon: "utensils",
        },
      ]}
      currentUserId="member-id"
      members={[
        { id: "member-id", label: "You" },
        { id: "partner-id", label: "Partner" },
      ]}
    />,
  );
  expect(markup).toContain('aria-label="Add transaction"');
  expect(markup).toContain('id="transaction-kind"');
  expect(markup).toContain("Expense");
  expect(markup).toContain('data-select="recurrence-cadence"');
  expect(markup).toContain("None");
  expect(markup).toContain("Weekly");
  expect(markup).toContain("Monthly");
  expect(markup).toContain("Custom");
  expect(markup).toContain("Paid by");
  expect(markup).toContain("Choose date");
  expect(markup.indexOf("Amount")).toBeLessThan(markup.indexOf("Category"));
  expect(markup.indexOf("Category")).toBeLessThan(markup.indexOf("transaction-date-label"));
  expect(markup.indexOf("transaction-date-label")).toBeLessThan(markup.indexOf("Merchant"));
  expect(markup.indexOf("Merchant")).toBeLessThan(markup.indexOf("Paid by"));
  expect(markup.indexOf("Paid by")).toBeLessThan(markup.indexOf('id="transaction-kind"'));
  expect(markup.indexOf('id="transaction-kind"')).toBeLessThan(markup.indexOf("Note"));
});

it("uses a dropdown for custom cadence units", () => {
  renderSheet();
  mocks.recurrenceChange?.("custom");
  mocks.stateIndex = 0;
  const markup = renderSheet();

  expect(markup).toContain("Weeks");
  expect(markup).toContain("Months");
  expect(markup).not.toContain('role="radiogroup"');
});

it("starts new transactions Uncategorized and groups categories by parent", () => {
  const markup = renderSheet();

  expect(markup).toContain('type="hidden" name="subcategoryId" value=""');
  expect(mocks.categoryOptions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        value: "",
        label: "Uncategorized",
      }),
      expect.objectContaining({ label: "Electricity", section: { id: "bills", label: "Bills" } }),
    ]),
  );
  expect(mocks.categoryOptions.filter((option) => option.description)).toEqual([]);
  expect(markup).toContain('aria-label="Categories">Uncategorized</button>');
});

it("submits a direct Other category without a subcategory", () => {
  const directCategories = [{ id: "other-expense", name: "Other", kind: "expense" as const, color: "#d5d5c4", systemKey: "other_expense" }];

  renderToStaticMarkup(<TransactionSheet directCategories={directCategories} members={[]} />);
  mocks.categoryChange?.("category:other-expense");
  mocks.stateIndex = 0;
  const markup = renderToStaticMarkup(<TransactionSheet directCategories={directCategories} members={[]} />);

  expect(markup).toContain('type="hidden" name="categoryId" value="other-expense"');
  expect(markup).toContain('type="hidden" name="subcategoryId" value=""');
});

it("does not restore a direct category after changing transaction type away and back", () => {
  const directCategories = [
    { id: "other-expense", name: "Other", kind: "expense" as const, color: "#d5d5c4", systemKey: "other_expense" },
    { id: "other-income", name: "Other", kind: "income" as const, color: "#d5d5c4", systemKey: "other_income" },
  ];

  mocks.stateIndex = 0;
  renderToStaticMarkup(<TransactionSheet directCategories={directCategories} members={[]} />);
  mocks.categoryChange?.("category:other-expense");
  mocks.kindChange?.("income");

  mocks.stateIndex = 0;
  renderToStaticMarkup(<TransactionSheet directCategories={directCategories} members={[]} />);
  mocks.kindChange?.("expense");

  mocks.stateIndex = 0;
  const markup = renderToStaticMarkup(<TransactionSheet directCategories={directCategories} members={[]} />);

  expect(markup).toContain('type="hidden" name="categoryId" value=""');
  expect(markup).toContain('aria-label="Categories">Uncategorized</button>');
});

it("renders edit mode with saved transaction values and deletion inside the sheet", () => {
  const markup = renderToStaticMarkup(
    <TransactionSheet
      subcategories={[
        {
          id: "groceries",
          name: "Groceries",
          categoryId: "food",
          categoryName: "Food",
          kind: "expense",
          color: "#d9f0fa",
          icon: "utensils",
        },
      ]}
      members={[{ id: "member-id", label: "You" }]}
      transaction={{
        id: "transaction-id",
        kind: "expense",
        amount: 50,
        occurredOn: "2026-07-14",
        subcategoryId: "groceries",
        note: "Saved note",
        merchant: "Saved merchant",
        source: "manual",
        createdAt: "2026-07-14T08:00:00Z",
        paidBy: "member-id",
      }}
    />,
  );

  expect(markup).toContain("Edit transaction");
  expect(markup).toContain("Update or remove this shared ledger entry.");
  expect(markup).toContain('type="hidden" name="subcategoryId" value="groceries"');
  expect(markup).toContain('aria-label="Categories">Groceries');
  expect(markup).toContain('name="amount" value="50"');
  expect(markup).toContain("<textarea");
  expect(markup).toMatch(/<textarea[^>]*bg-white\/55/);
  expect(markup).toContain('name="note" rows="4"');
  expect(markup).toContain(">Saved note</textarea>");
  expect(markup).toContain("Save changes");
  expect(markup).toContain("Delete transaction");
  expect(markup).toContain('aria-label="Delete transaction"');
  expect(markup).toContain("lucide-trash-2");
  expect(markup).toContain("Delete this transaction?");
  expect(markup).toContain("This removes the entry from the shared household ledger.");
  expect(mocks.categoryOptions).not.toContainEqual({ value: "", label: "Uncategorized" });
});

it("keeps an imported transaction unassigned while allowing its category to be edited", () => {
  const transaction: ImportedTransaction = {
    id: "imported-id",
    kind: "expense",
    amount: 50,
    occurredOn: "2026-07-14",
    subcategoryId: null,
    note: "Statement note",
    merchant: "Super Pharm",
    source: "statement_import",
    createdAt: "2026-07-14T08:00:00Z",
    paidBy: null,
  };
  const markup = renderToStaticMarkup(
    <TransactionSheet
      subcategories={[
        {
          id: "groceries",
          name: "Groceries",
          categoryId: "food",
          categoryName: "Food",
          kind: "expense",
          color: "#d9f0fa",
          icon: "utensils",
        },
      ]}
      members={[{ id: "member-id", label: "You" }]}
      transaction={transaction}
    />,
  );

  expect(markup).toContain("Merchant");
  expect(markup).toContain("Super Pharm");
  expect(markup).toContain("Unassigned");
  expect(markup).toContain('type="hidden" name="subcategoryId" value=""');
  expect(markup).toContain('type="hidden" name="paidBy" value=""');
  expect(mocks.categoryOptions).toContainEqual(expect.objectContaining({ value: "", label: "Uncategorized" }));
});

it("exposes only matching subcategories and clears the selection when the type changes", () => {
  renderSheet();
  mocks.kindChange?.("income");

  const markup = renderSheet();

  expect(markup).toContain('type="hidden" name="subcategoryId" value=""');
  expect(mocks.categoryOptions).toEqual([
    { value: "", label: "Uncategorized" },
    expect.objectContaining({
      value: "salary",
      label: "Salary",
      section: { id: "income", label: "Income" },
      color: "#d9f0fa",
      icon: expect.anything(),
    }),
  ]);
});

it("submits the locally selected calendar day", async () => {
  renderSheet();
  mocks.dateSelect?.(new Date(2026, 0, 2, 12));

  const markup = renderSheet();

  expect(markup).toContain('type="hidden" name="occurredOn" value="2026-01-02"');

  const formData = new FormData();
  formData.set("occurredOn", "2026-01-02");
  await mocks.formAction?.(null, formData);
  expect(mocks.createTransaction).toHaveBeenCalledWith(formData);
  expect(mocks.createTransaction.mock.calls[0]?.[0].get("occurredOn")).toBe("2026-01-02");
});

it("defaults the Billing period from the ledger date after Bills selection and in edit forms", () => {
  const billsSubcategory = {
    id: "electricity",
    name: "Electricity",
    categoryId: "bills",
    categoryName: "Bills",
    kind: "expense" as const,
    color: "#d9f0fa",
    icon: "zap",
    systemKey: "electricity",
    categorySystemKey: "bills",
  };
  mocks.stateIndex = 0;
  renderToStaticMarkup(<TransactionSheet subcategories={[billsSubcategory]} members={[]} />);
  mocks.categoryChange?.("electricity");
  mocks.stateIndex = 0;
  const createMarkup = renderToStaticMarkup(<TransactionSheet subcategories={[billsSubcategory]} members={[]} />);
  mocks.state = [];
  mocks.stateIndex = 0;
  const editMarkup = renderToStaticMarkup(
    <TransactionSheet
      subcategories={[billsSubcategory]}
      members={[]}
      transaction={{
        id: "electricity-id",
        kind: "expense",
        amount: 120,
        occurredOn: "2026-07-03",
        servicePeriodStart: "2026-06-15",
        servicePeriodEnd: "2026-07-14",
        subcategoryId: "electricity",
        note: "",
        merchant: "Electric company",
        createdAt: "2026-07-03T08:00:00Z",
        paidBy: null,
      }}
    />,
  );

  for (const markup of [createMarkup, editMarkup]) {
    expect(markup).toContain("Billing period");
    expect(markup).toContain('aria-label="Use current month"');
    expect(markup).toContain("lucide-calendar-range");
    expect(markup).toContain('aria-label="Choose billing period start"');
    expect(markup).toContain('aria-label="Choose billing period end"');
  }
  expect(createMarkup).toContain("14/07/2026");
  expect(editMarkup).toContain("15/06/2026");
  expect(editMarkup).toContain("14/07/2026");
  expect(editMarkup).toContain('type="hidden" name="servicePeriodStart" value="2026-06-15"');
  expect(editMarkup).toContain('type="hidden" name="servicePeriodEnd" value="2026-07-14"');
});

it("initializes and clears the Billing period from the selected parent without changing the ledger date", () => {
  const subcategories = [
    {
      id: "groceries",
      name: "Groceries",
      categoryId: "groceries",
      categoryName: "Groceries",
      kind: "expense" as const,
      color: "#d9f0fa",
      icon: "shopping-basket",
    },
    {
      id: "electricity",
      name: "Electricity",
      categoryId: "bills",
      categoryName: "Bills",
      kind: "expense" as const,
      color: "#d9f0fa",
      icon: "zap",
      systemKey: "electricity",
      categorySystemKey: "bills",
    },
  ];

  mocks.stateIndex = 0;
  renderToStaticMarkup(<TransactionSheet subcategories={subcategories} members={[]} />);
  mocks.dateSelect?.(new Date(2026, 0, 2, 12));
  mocks.stateIndex = 0;
  renderToStaticMarkup(<TransactionSheet subcategories={subcategories} members={[]} />);
  mocks.categoryChange?.("electricity");
  mocks.stateIndex = 0;
  const billsMarkup = renderToStaticMarkup(<TransactionSheet subcategories={subcategories} members={[]} />);
  mocks.categoryChange?.("groceries");
  mocks.stateIndex = 0;
  const nonBillsMarkup = renderToStaticMarkup(<TransactionSheet subcategories={subcategories} members={[]} />);

  expect(billsMarkup).toContain('type="hidden" name="servicePeriodStart" value="2026-01-02"');
  expect(billsMarkup).toContain('type="hidden" name="servicePeriodEnd" value="2026-01-02"');
  expect(nonBillsMarkup).not.toContain("Billing period");
  expect(nonBillsMarkup).toContain('type="hidden" name="occurredOn" value="2026-01-02"');
  expect(nonBillsMarkup).toContain('type="hidden" name="servicePeriodStart" value=""');
  expect(nonBillsMarkup).toContain('type="hidden" name="servicePeriodEnd" value=""');
});

it("shows a billing-period start error returned by the server", () => {
  mocks.actionState = {
    status: "error",
    formError: "Check the form details.",
    fieldErrors: { servicePeriodStart: "Use YYYY-MM-DD." },
  };

  const subcategories = [
    {
      id: "electricity",
      name: "Electricity",
      categoryId: "bills",
      categoryName: "Bills",
      kind: "expense" as const,
      color: "#d9f0fa",
      icon: "zap",
      systemKey: "electricity",
      categorySystemKey: "bills",
    },
  ];
  renderToStaticMarkup(<TransactionSheet subcategories={subcategories} members={[]} />);
  mocks.categoryChange?.("electricity");
  mocks.stateIndex = 0;
  const markup = renderToStaticMarkup(<TransactionSheet subcategories={subcategories} members={[]} />);

  expect(markup).toContain("Use YYYY-MM-DD.");
  expect(markup).toContain('aria-invalid="true"');
});

it("does not activate billing state from a non-Bills child system key", () => {
  const markup = renderToStaticMarkup(
    <TransactionSheet
      subcategories={[
        {
          id: "not-bills",
          name: "Not bills",
          categoryId: "groceries",
          categoryName: "Groceries",
          kind: "expense",
          color: "#d9f0fa",
          icon: "shopping-basket",
          systemKey: "bills",
          categorySystemKey: "groceries",
        },
      ]}
      members={[]}
    />,
  );

  expect(markup).not.toContain("Billing period");
  expect(markup).toContain('type="hidden" name="servicePeriodStart" value=""');
  expect(markup).toContain('type="hidden" name="servicePeriodEnd" value=""');
});

it("shows a billing-period end error returned by the server", () => {
  mocks.actionState = {
    status: "error",
    formError: "Check the form details.",
    fieldErrors: { servicePeriodEnd: "End on or after the start date." },
  };

  const subcategories = [
    {
      id: "electricity",
      name: "Electricity",
      categoryId: "bills",
      categoryName: "Bills",
      kind: "expense" as const,
      color: "#d9f0fa",
      icon: "zap",
      systemKey: "electricity",
      categorySystemKey: "bills",
    },
  ];
  renderToStaticMarkup(<TransactionSheet subcategories={subcategories} members={[]} />);
  mocks.categoryChange?.("electricity");
  mocks.stateIndex = 0;
  const markup = renderToStaticMarkup(<TransactionSheet subcategories={subcategories} members={[]} />);

  expect(markup).toContain("End on or after the start date.");
  expect(markup).toContain('aria-invalid="true"');
});
