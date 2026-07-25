import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ProfileNameSettingsControl({ fullName }: { fullName: string }) {
  return (
    <div className="w-[min(22rem,55vw)]">
      <input form="settings-save-form" type="hidden" name="initialProfileName" value={fullName} />
      <Field className="min-w-0 flex-1">
        <FieldLabel htmlFor="profile-name" className="sr-only">
          User name
        </FieldLabel>
        <Input
          form="settings-save-form"
          id="profile-name"
          name="profileName"
          defaultValue={fullName}
          autoComplete="name"
          required
          className="min-h-11"
        />
      </Field>
    </div>
  );
}
