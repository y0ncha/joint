import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBudgetsGoalsData: vi.fn(),
}));

vi.mock("@/lib/budgets-goals-data", () => ({ getBudgetsGoalsData: mocks.getBudgetsGoalsData }));
vi.mock("@/components/budgets-goals-workspace", () => ({
  BudgetsGoalsWorkspace: (props: object) => <pre data-workspace>{JSON.stringify(props)}</pre>,
}));
vi.mock("@/components/workspace-shell", () => ({
  WorkspacePage: ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
    <section>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </section>
  ),
}));

const page = await import("./page");

it("loads the budgets and goals read model into one configuration workspace", async () => {
  const data = {
    budgets: [],
    goals: [],
    targets: { categories: [], subcategories: [] },
  };
  mocks.getBudgetsGoalsData.mockResolvedValue(data);

  const markup = renderToStaticMarkup(await page.default());

  expect(mocks.getBudgetsGoalsData).toHaveBeenCalledWith();
  expect(markup).toContain("Budgets &amp; Goals");
  expect(markup).toContain("Configure monthly spending limits and savings goals.");
  expect(markup).toContain("data-workspace");
  expect(markup).toContain("&quot;targets&quot;");
});
