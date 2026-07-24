import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calendarSelect: undefined as undefined | ((date: Date | undefined) => void),
  createTransaction: vi.fn(),
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
      return [mocks.state[index], (nextState: unknown | ((current: unknown) => unknown)) => {
        mocks.state[index] = typeof nextState === "function" ? nextState(mocks.state[index]) : nextState;
      }];
    },
  };
});

vi.mock("@/app/actions/transactions", () => ({
  createTransaction: mocks.createTransaction,
  deleteTransaction: vi.fn(),
  updateTransaction: vi.fn(),
}));
vi.mock("@/components/pill-select", () => ({
  PillSelect: ({ ariaLabel, emptyLabel, options, value }: { ariaLabel: string; emptyLabel?: string; options: Array<{ label: string; value: string }>; value?: string }) => <button aria-label={ariaLabel}>{options.find((option) => option.value === value)?.label ?? emptyLabel}</button>,
}));
vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect: (date: Date | undefined) => void }) => {
    mocks.calendarSelect = onSelect;
    return <button type="button">Calendar</button>;
  },
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/ui/toggle-group", () => ({
  ToggleGroup: ({ children, onValueChange }: { children: ReactNode; onValueChange: (value: string) => void }) => {
    mocks.kindChange = onValueChange;
    return <div>{children}</div>;
  },
  ToggleGroupItem: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
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
  Select: ({ children }: { children: ReactNode }) => children,
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
      categories={[{ id: "food", name: "Food", kind: "expense" }, { id: "salary", name: "Salary", kind: "income" }]}
      members={[]}
    />,
  );
}

beforeEach(() => {
  mocks.calendarSelect = undefined;
  mocks.createTransaction.mockReset();
  mocks.formAction = undefined;
  mocks.kindChange = undefined;
  mocks.state = [];
  mocks.stateIndex = 0;
});

type ImportedTransaction = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  occurredOn: string;
  categoryId: null;
  note: string;
  merchant: string;
  source: "statement_import";
  createdAt: string;
  paidBy: null;
};

it("renders the simplified transaction composer without account or transfer choices", () => {
  const markup = renderToStaticMarkup(
    <TransactionSheet
      categories={[
        { id: "salary", name: "Salary", kind: "income" },
        { id: "food", name: "Food", kind: "expense" },
      ]}
      currentUserId="member-id"
      members={[
        { id: "member-id", label: "You" },
        { id: "partner-id", label: "Partner" },
      ]}
    />,
  );
  expect(markup).toContain("aria-label=\"Add transaction\"");
  expect(markup).toContain("lucide-plus");
  expect(markup).toContain("data-variant=\"ghost\"");
  expect(markup).toContain("size-9");
  expect(markup).not.toContain(">Add</span>");
  expect(markup).toContain("Income");
  expect(markup).toContain("Expense");
  expect(markup).toContain("Paid by");
  expect(markup).toContain("Choose date");
  expect(markup).not.toContain("Transfer");
  expect(markup).not.toContain("Account");
  expect(markup).not.toContain("credit card");
});

it("renders edit mode with saved transaction values and deletion inside the sheet", () => {
  const markup = renderToStaticMarkup(
    <TransactionSheet
      categories={[{ id: "food", name: "Food", kind: "expense" }]}
      members={[{ id: "member-id", label: "You" }]}
      transaction={{ id: "transaction-id", kind: "expense", amount: 50, occurredOn: "2026-07-14", categoryId: "food", note: "Saved note", merchant: "Saved merchant", source: "statement_import", createdAt: "2026-07-14T08:00:00Z", paidBy: "member-id" }}
    />,
  );

  expect(markup).toContain("Edit transaction");
  expect(markup).toContain("Update or remove this shared ledger entry.");
  expect(markup).toContain('name="amount" value="50"');
  expect(markup).toContain('name="note" value="Saved note"');
  expect(markup).toContain("Save changes");
  expect(markup).toContain("Delete transaction");
});

it("keeps an imported transaction unassigned while allowing its category to be edited", () => {
  const transaction: ImportedTransaction = {
    id: "imported-id",
    kind: "expense",
    amount: 50,
    occurredOn: "2026-07-14",
    categoryId: null,
    note: "Statement note",
    merchant: "Super Pharm",
    source: "statement_import",
    createdAt: "2026-07-14T08:00:00Z",
    paidBy: null,
  };
  const markup = renderToStaticMarkup(
    <TransactionSheet
      categories={[{ id: "food", name: "Food", kind: "expense" }]}
      members={[{ id: "member-id", label: "You" }]}
      transaction={transaction}
    />,
  );

  expect(markup).toContain("Merchant");
  expect(markup).toContain("Super Pharm");
  expect(markup).toContain("Unassigned");
  expect(markup).toContain('type="hidden" name="categoryId" value=""');
  expect(markup).toContain('type="hidden" name="paidBy" value=""');
});

it("clears an incompatible category and submits the locally selected calendar day", async () => {
  renderSheet();
  mocks.kindChange?.("income");
  mocks.calendarSelect?.(new Date(2026, 0, 2, 12));

  const markup = renderSheet();

  expect(markup).toContain('type="hidden" name="categoryId" value=""');
  expect(markup).toContain('type="hidden" name="occurredOn" value="2026-01-02"');

  const formData = new FormData();
  formData.set("occurredOn", "2026-01-02");
  await mocks.formAction?.(null, formData);
  expect(mocks.createTransaction).toHaveBeenCalledWith(formData);
  expect(mocks.createTransaction.mock.calls[0]?.[0].get("occurredOn")).toBe("2026-01-02");
});
