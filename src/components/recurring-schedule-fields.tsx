"use client";

import type { ReactNode } from "react";

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type RecurrenceCadence = "" | "weekly" | "monthly" | "custom_weekly" | "custom_monthly";

type RecurringScheduleFieldsProps = {
  actions?: ReactNode;
  allowNone?: boolean;
  cadence: RecurrenceCadence;
  hideLabel?: boolean;
  interval: string;
  onCadenceChange: (cadence: RecurrenceCadence) => void;
  onIntervalChange: (interval: string) => void;
};

export function RecurringScheduleFields({
  actions,
  allowNone = true,
  cadence,
  hideLabel = false,
  interval,
  onCadenceChange,
  onIntervalChange,
}: RecurringScheduleFieldsProps) {
  const hasActions = actions != null;
  const cadenceValue = cadence === "" ? (allowNone ? "none" : "monthly") : cadence.startsWith("custom_") ? "custom" : cadence;

  function handleCadenceChange(value: string) {
    onCadenceChange(value === "none" ? "" : value === "custom" ? "custom_weekly" : (value as RecurrenceCadence));
  }

  return (
    <FieldGroup className={hasActions ? "gap-4" : undefined}>
      <div className={hasActions ? "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3" : undefined}>
        <Field>
          <FieldLabel htmlFor="recurrence-cadence" className={hideLabel ? "sr-only" : undefined}>
            {hideLabel ? "Recurring cadence" : "Repeat"}
          </FieldLabel>
          <Select value={cadenceValue} onValueChange={handleCadenceChange}>
            <SelectTrigger id="recurrence-cadence" className="w-full rounded-xl">
              <SelectValue placeholder={allowNone ? "None" : undefined} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {allowNone ? <SelectItem value="none">None</SelectItem> : null}
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        {hasActions ? <div className="flex gap-2">{actions}</div> : null}
      </div>
      {cadence.startsWith("custom_") ? (
        <FieldGroup className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <Field>
            <FieldLabel htmlFor="recurrence-interval" className="sr-only">
              Repeat every
            </FieldLabel>
            <Input
              id="recurrence-interval"
              inputMode="numeric"
              min="1"
              type="number"
              value={interval}
              onChange={(event) => onIntervalChange(event.target.value)}
            />
          </Field>
          <Select value={cadence} onValueChange={(value) => onCadenceChange(value as "custom_weekly" | "custom_monthly")}>
            <SelectTrigger id="recurrence-unit" aria-label="Recurrence unit" className="w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="custom_weekly">Weeks</SelectItem>
                <SelectItem value="custom_monthly">Months</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FieldGroup>
      ) : null}
    </FieldGroup>
  );
}
