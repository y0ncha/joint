import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ onValueChange: null as null | ((value: string) => void), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams("month=2026-07"),
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange }: { children: React.ReactNode; onValueChange: (value: string) => void }) => {
    mocks.onValueChange = onValueChange;
    return <>{children}</>;
  },
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  SelectValue: () => null,
}));

const { DashboardSpendingCategorySelector } = await import("./dashboard-spending-category-selector");

afterEach(() => {
  mocks.onValueChange = null;
  vi.clearAllMocks();
});

it("navigates with the chosen dashboard spending category", () => {
  renderToStaticMarkup(<DashboardSpendingCategorySelector categories={[{ id: "food", name: "Food" }]} selectedCategoryId={undefined} />);

  expect(mocks.onValueChange).toBeTypeOf("function");
  mocks.onValueChange!("food");
  expect(mocks.push).toHaveBeenCalledWith("/?month=2026-07&spendingCategory=food");
});
