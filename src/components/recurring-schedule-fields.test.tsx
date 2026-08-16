import type { ChangeEvent, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inputChange: undefined as undefined | ((event: ChangeEvent<HTMLInputElement>) => void),
  selectChanges: [] as Array<{ onValueChange?: (value: string) => void; value?: string }>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange, value }: { children: ReactNode; onValueChange?: (value: string) => void; value?: string }) => {
    mocks.selectChanges.push({ onValueChange, value });
    return <div data-select-value={value}>{children}</div>;
  },
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <span data-select-item={value}>{children}</span>,
  SelectTrigger: ({ children, ...props }: { children: ReactNode } & React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({ onChange, ...props }: React.ComponentProps<"input">) => {
    mocks.inputChange = onChange;
    return <input {...props} onChange={onChange} />;
  },
}));

import { RecurringScheduleFields, type RecurrenceCadence } from "./recurring-schedule-fields";

function renderFields(
  overrides: Partial<{
    actions: ReactNode;
    allowNone: boolean;
    cadence: RecurrenceCadence;
    hideLabel: boolean;
    interval: string;
    onCadenceChange: (cadence: RecurrenceCadence) => void;
    onIntervalChange: (interval: string) => void;
  }> = {},
) {
  return renderToStaticMarkup(
    <RecurringScheduleFields
      cadence={overrides.cadence ?? ""}
      interval={overrides.interval ?? "1"}
      onCadenceChange={vi.fn()}
      onIntervalChange={vi.fn()}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  mocks.inputChange = undefined;
  mocks.selectChanges = [];
});

it("offers None only for the regular/create composition", () => {
  const regularMarkup = renderFields({ cadence: "" });
  const linkedMarkup = renderFields({ allowNone: false, cadence: "monthly", hideLabel: true });

  expect(regularMarkup).toContain('data-select-item="none"');
  expect(regularMarkup).toContain("None");
  expect(linkedMarkup).not.toContain('data-select-item="none"');
  expect(linkedMarkup).not.toContain("None");
  expect(linkedMarkup).toContain("Recurring cadence");
  expect(linkedMarkup).toContain("sr-only");
});

it("renders the controlled interval and unit fields for custom cadence", () => {
  const markup = renderFields({ cadence: "custom_monthly", interval: "3" });

  expect(markup).toContain('id="recurrence-interval"');
  expect(markup).toContain('value="3"');
  expect(markup).toContain('data-select-item="custom_weekly"');
  expect(markup).toContain('data-select-item="custom_monthly"');
  expect(markup).toContain("Weeks");
  expect(markup).toContain("Months");
});

it("wires cadence, custom unit, and interval changes through controlled callbacks", () => {
  const onCadenceChange = vi.fn();
  const onIntervalChange = vi.fn();

  renderFields({ cadence: "custom_weekly", onCadenceChange, onIntervalChange });

  expect(mocks.selectChanges).toHaveLength(2);
  mocks.selectChanges[0]!.onValueChange!("none");
  expect(onCadenceChange).toHaveBeenLastCalledWith("");
  mocks.selectChanges[0]!.onValueChange!("custom");
  expect(onCadenceChange).toHaveBeenLastCalledWith("custom_weekly");
  mocks.selectChanges[1]!.onValueChange!("custom_monthly");
  expect(onCadenceChange).toHaveBeenLastCalledWith("custom_monthly");
  mocks.inputChange!({ target: { value: "4" } } as ChangeEvent<HTMLInputElement>);
  expect(onIntervalChange).toHaveBeenCalledWith("4");
});

it("does not render custom controls for a simple cadence", () => {
  const markup = renderFields({ cadence: "monthly" });

  expect(markup).not.toContain('id="recurrence-interval"');
  expect(markup).not.toContain("Weeks");
  expect(markup).not.toContain("Months");
});

it("places the optional action slot beside the cadence selector", () => {
  const markup = renderFields({ actions: <button type="button">Pause</button>, allowNone: false, cadence: "monthly", hideLabel: true });

  expect(markup).toContain("Pause");
  expect(markup.indexOf('id="recurrence-cadence"')).toBeLessThan(markup.indexOf("Pause"));
});

it("treats a null action slot as absent", () => {
  const markup = renderFields({ actions: null, cadence: "monthly" });

  expect(markup).not.toContain("flex gap-2");
});
