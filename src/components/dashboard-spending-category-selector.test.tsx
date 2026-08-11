import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ checkboxChanges: new Map<string, () => void>(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams("month=2026-07"),
}));
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ id, disabled, onCheckedChange }: { id: string; disabled?: boolean; onCheckedChange: () => void }) => {
    mocks.checkboxChanges.set(id, onCheckedChange);
    return <input id={id} disabled={disabled} type="checkbox" />;
  },
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  SelectTrigger: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <button {...props}>{children}</button>,
  SelectValue: () => null,
}));
vi.mock("@/components/ledger-month-selector", () => ({
  LedgerMonthSelector: () => <span>Month selector</span>,
}));

const { DashboardSpendingCategorySelector } = await import("./dashboard-spending-category-selector");

afterEach(() => {
  mocks.checkboxChanges.clear();
  vi.clearAllMocks();
});

it("adds a category to the configured fanout", () => {
  renderToStaticMarkup(
    <DashboardSpendingCategorySelector
      categories={[
        { id: "food", name: "Food" },
        { id: "home", name: "Home" },
      ]}
      month="2026-07"
      selectedCategoryIds={[]}
    />,
  );

  expect(mocks.checkboxChanges.get("dashboard-spending-food")).toBeTypeOf("function");
  mocks.checkboxChanges.get("dashboard-spending-food")!();
  expect(mocks.push).toHaveBeenCalledWith("/?month=2026-07&spendingCategories=food");
});

it("allows selecting all categories", () => {
  const markup = renderToStaticMarkup(
    <DashboardSpendingCategorySelector
      categories={[
        { id: "food", name: "Food" },
        { id: "home", name: "Home" },
        { id: "bills", name: "Bills" },
        { id: "leisure", name: "Leisure" },
      ]}
      month="2026-07"
      selectedCategoryIds={["food", "home", "bills"]}
    />,
  );

  expect(markup).not.toContain('id="dashboard-spending-leisure" disabled');
  mocks.checkboxChanges.get("dashboard-spending-leisure")!();
  expect(mocks.push).toHaveBeenCalledWith("/?month=2026-07&spendingCategories=food%2Chome%2Cbills%2Cleisure");
});

it("uses an icon-only configuration trigger", () => {
  const markup = renderToStaticMarkup(<DashboardSpendingCategorySelector categories={[]} month="2026-07" selectedCategoryIds={[]} />);

  expect(markup).toContain('aria-label="Configure spending breakdown"');
  expect(markup).toContain('data-variant="ghost"');
  expect(markup).not.toContain(">Configure<");
});

it("uses the searchable category multiselect menu", () => {
  const markup = renderToStaticMarkup(<DashboardSpendingCategorySelector categories={[]} selectedCategoryIds={[]} month="2026-07" />);

  expect(markup).toContain('aria-label="Search categories"');
  expect(markup).toContain('aria-label="Spending granularity"');
  expect(markup).toContain(">Categories<");
  expect(markup).toContain(">Subcategories<");
  expect(markup).toContain("Month selector");
  expect(markup).not.toContain("Category detail");
});

it("summarizes the number of selected categories", () => {
  const markup = renderToStaticMarkup(
    <DashboardSpendingCategorySelector
      categories={[
        { id: "food", name: "Food" },
        { id: "home", name: "Home" },
      ]}
      selectedCategoryIds={["food", "home"]}
      month="2026-07"
    />,
  );

  expect(markup).toContain("2 categories selected");
  expect(markup).not.toContain(">Custom<");
});
