import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function HouseholdNameSettingsControl({ name }: { name: string }) {
  return (
    <div className="w-[min(22rem,55vw)]">
      <input form="settings-save-form" type="hidden" name="initialHouseholdName" value={name} />
      <Field className="min-w-0 flex-1">
        <FieldLabel htmlFor="household-name" className="sr-only">Household name</FieldLabel>
        <Input form="settings-save-form" id="household-name" name="householdName" defaultValue={name} autoComplete="organization" required className="min-h-11" />
      </Field>
    </div>
  );
}
