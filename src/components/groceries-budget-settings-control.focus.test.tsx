import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actionState: { status: "error" as const, formError: "Check the form details.", fieldErrors: { groceriesBudget: "Enter an amount greater than zero." } },
  focus: vi.fn(),
  previousDependencies: undefined as readonly unknown[] | undefined,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: () => void, dependencies: readonly unknown[]) => {
      if (dependencies.some((dependency, index) => dependency !== mocks.previousDependencies?.[index])) effect();
      mocks.previousDependencies = dependencies;
    },
    useRef: () => ({ current: { focus: mocks.focus } }),
  };
});

vi.mock("./settings-save-control", () => ({ useSettingsFormState: () => mocks.actionState }));

const { GroceriesBudgetSettingsControl } = await import("./groceries-budget-settings-control");

beforeEach(() => {
  mocks.actionState = { status: "error", formError: "Check the form details.", fieldErrors: { groceriesBudget: "Enter an amount greater than zero." } };
  mocks.focus.mockClear();
  mocks.previousDependencies = undefined;
});

it("focuses the groceries budget input after every failed action, even when its message repeats", () => {
  renderToStaticMarkup(<GroceriesBudgetSettingsControl budget={500} />);
  mocks.actionState = { status: "error", formError: "Check the form details.", fieldErrors: { groceriesBudget: "Enter an amount greater than zero." } };
  renderToStaticMarkup(<GroceriesBudgetSettingsControl budget={500} />);
  renderToStaticMarkup(<GroceriesBudgetSettingsControl budget={500} />);

  expect(mocks.focus).toHaveBeenCalledTimes(2);
});
