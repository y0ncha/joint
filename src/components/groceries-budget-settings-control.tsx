import { Input } from "@/components/ui/input";

export function GroceriesBudgetSettingsControl({ budget }: { budget: number | null }) {
  const value = budget?.toString() ?? "";
  return (
    <div className="w-[min(22rem,55vw)]">
      <input form="settings-save-form" type="hidden" name="initialGroceriesBudget" value={value} />
      <Input
        form="settings-save-form"
        id="groceries-budget"
        name="groceriesBudget"
        type="number"
        min="0.01"
        step="0.01"
        defaultValue={value}
        placeholder="Not set"
        inputMode="decimal"
        aria-label="Monthly groceries budget"
        className="min-h-11"
      />
    </div>
  );
}
