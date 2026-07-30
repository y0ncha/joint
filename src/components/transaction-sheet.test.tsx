import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  billingPeriodSelect: undefined as undefined | ((range: { from?: Date; to?: Date } | undefined) => void),
  categoryOptions: [] as Array<{ color?: string; icon?: unknown; label: string; value: string }>,
  categoryChange: undefined as undefined | ((value: string) => void),
  createTransaction: vi.fn(),
  dateSelect: undefined as undefined | ((date: Date | undefined) => void),
  formAction: undefined as undefined | ((previousState: unknown, formData: FormData) => unknown),
  kindChange: undefined as undefined | ((value: string) => void),
  state: [] as unknown[],
  stateIndex: 0,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    useActionState: (action: (previousState: unknown, formData: FormData) => unknown) => {
      mocks.formAction = action;
      return [null, () => {}, false];
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
  };
});

vi.mock("@/app/actions/transactions", () => ({
  createTransaction: mocks.createTransaction,
  deleteTransaction: vi.fn(),
  updateTransaction: vi.fn(),
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
    options: Array<{ color?: string; icon?: unknown; label: string; value: string }>;
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
    mode,
    onSelect,
  }: {
    mode: "range" | "single";
    onSelect: (value: Date | { from?: Date; to?: Date } | undefined) => void;
  }) => {
    if (mode === "range") mocks.billingPeriodSelect = onSelect as typeof mocks.billingPeriodSelect;
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
  Select: ({ children, onValueChange }: { children: ReactNode; onValueChange: (value: string) => void }) => {
    mocks.kindChange = onValueChange;
    return (
      <button data-select="transaction-kind" type="button">
        {children}
      </button>
    );
  },
  SelectContent: ({ children }: { children: ReactNode }) => children,
  SelectGroup: ({ children }: { children: ReactNode }) => children,
  SelectItem: ({ children }: { children: ReactNode }) => children,
  SelectTrigger: ({ children }: { children: ReactNode }) => children,
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
  mocks.billingPeriodSelect = undefined;
  mocks.categoryOptions = [];
  mocks.categoryChange = undefined;
  mocks.createTransaction.mockReset();
  mocks.dateSelect = undefined;
  mocks.formAction = undefined;
  mocks.kindChange = undefined;
  mocks.state = [];
  mocks.stateIndex = 0;
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
  expect(markup).toContain('aria-label="Type"');
  expect(markup).toContain("Expense");
  expect(markup).toContain("Paid by");
  expect(markup).toContain("Choose date");
  expect(markup.indexOf("Amount")).toBeLessThan(markup.indexOf("transaction-date-label"));
  expect(markup.indexOf("transaction-date-label")).toBeLessThan(markup.indexOf('aria-label="Type"'));
  expect(markup.indexOf('aria-label="Type"')).toBeLessThan(markup.indexOf("Paid by"));
  expect(markup.indexOf("Paid by")).toBeLessThan(markup.indexOf("Category"));
  expect(markup.indexOf("Category")).toBeLessThan(markup.indexOf("Merchant"));
  expect(markup.indexOf("Merchant")).toBeLessThan(markup.indexOf("Note"));
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
        source: "statement_import",
        createdAt: "2026-07-14T08:00:00Z",
        paidBy: "member-id",
      }}
    />,
  );

  expect(markup).toContain("Edit transaction");
  expect(markup).toContain("Update or remove this shared ledger entry.");
  expect(markup).toContain('type="hidden" name="subcategoryId" value="groceries"');
  expect(markup).toContain('aria-label="Categories">Food → Groceries');
  expect(markup).toContain('name="amount" value="50"');
  expect(markup).toContain("<textarea");
  expect(markup).toMatch(/<textarea[^>]*bg-white\/55/);
  expect(markup).toContain('name="note" rows="4"');
  expect(markup).toContain(">Saved note</textarea>");
  expect(markup).toContain("Save changes");
  expect(markup).toContain("Delete transaction");
  expect(markup).toContain("Delete this transaction?");
  expect(markup).toContain("This removes the entry from the shared household ledger.");
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
});

it("exposes only matching subcategories and clears the selection when the type changes", () => {
  renderSheet();
  mocks.kindChange?.("income");

  const markup = renderSheet();

  expect(markup).toContain('type="hidden" name="subcategoryId" value=""');
  expect(mocks.categoryOptions).toEqual([
    expect.objectContaining({ value: "salary", label: "Income → Salary", color: "#d9f0fa", icon: expect.anything() }),
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

it("defaults the fixture Billing period from the ledger date in Bills create and edit forms", () => {
  const billsSubcategory = {
    id: "electricity",
    name: "Electricity",
    categoryId: "bills",
    categoryName: "Bills",
    kind: "expense" as const,
    color: "#d9f0fa",
    icon: "zap",
    systemKey: "bills",
  };
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
    expect(markup).toContain('aria-label="Choose billing period"');
  }
  expect(createMarkup).toMatch(/id="billing-period-from"[^>]*value="2026-07-14"/);
  expect(createMarkup).toMatch(/id="billing-period-to"[^>]*value="2026-07-14"/);
  expect(editMarkup).toMatch(/id="billing-period-from"[^>]*value="2026-07-03"/);
  expect(editMarkup).toMatch(/id="billing-period-to"[^>]*value="2026-07-03"/);
});

it("clears the fixture Billing period after selecting a non-Bills subcategory", () => {
  const subcategories = [
    {
      id: "electricity",
      name: "Electricity",
      categoryId: "bills",
      categoryName: "Bills",
      kind: "expense" as const,
      color: "#d9f0fa",
      icon: "zap",
      systemKey: "bills",
    },
    {
      id: "groceries",
      name: "Groceries",
      categoryId: "groceries",
      categoryName: "Groceries",
      kind: "expense" as const,
      color: "#d9f0fa",
      icon: "shopping-basket",
    },
  ];

  mocks.stateIndex = 0;
  renderToStaticMarkup(<TransactionSheet subcategories={subcategories} members={[]} />);
  mocks.billingPeriodSelect?.({ from: new Date(2026, 6, 1, 12), to: new Date(2026, 6, 13, 12) });
  mocks.categoryChange?.("groceries");
  mocks.stateIndex = 0;
  const nonBillsMarkup = renderToStaticMarkup(<TransactionSheet subcategories={subcategories} members={[]} />);
  mocks.categoryChange?.("electricity");
  mocks.stateIndex = 0;
  const billsMarkup = renderToStaticMarkup(<TransactionSheet subcategories={subcategories} members={[]} />);

  expect(nonBillsMarkup).not.toContain("Billing period");
  expect(billsMarkup).toMatch(/id="billing-period-from"[^>]*value="2026-07-14"/);
  expect(billsMarkup).toMatch(/id="billing-period-to"[^>]*value="2026-07-14"/);
});
