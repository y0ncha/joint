"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { updateRecurringTransactionSchedule } from "@/app/actions/recurring-transactions";
import type { RecurringScheduleRow } from "@/components/recurring-schedule-list";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function RecurringScheduleEditForm({ schedule }: { schedule: RecurringScheduleRow }) {
  const [cadence, setCadence] = useState(schedule.cadence);
  const [state, formAction, isPending] = useActionState(
    async (_: null, input: FormData) => updateRecurringTransactionSchedule(schedule.id, input),
    null,
  );
  useEffect(() => {
    if (state !== null) toast.success("Recurring schedule saved", { id: `schedule-${schedule.id}` });
  }, [schedule.id, state]);
  return (
    <form action={formAction}>
      <FieldGroup>
        <input name="cadence" type="hidden" value={cadence} />
        <Field>
          <FieldLabel htmlFor={`schedule-amount-${schedule.id}`}>Amount</FieldLabel>
          <Input id={`schedule-amount-${schedule.id}`} name="amount" defaultValue={schedule.amount} inputMode="decimal" required />
        </Field>
        <Field>
          <FieldLabel>Repeat</FieldLabel>
          <ToggleGroup type="single" value={cadence} onValueChange={setCadence} variant="outline">
            <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
            <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
            <ToggleGroupItem value="custom_weekly">Custom</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor={`schedule-interval-${schedule.id}`}>Every</FieldLabel>
          <Input
            id={`schedule-interval-${schedule.id}`}
            name="intervalCount"
            defaultValue={schedule.cadence.startsWith("custom_") ? 1 : 1}
            type="number"
            min="1"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`schedule-merchant-${schedule.id}`}>Merchant</FieldLabel>
          <Input id={`schedule-merchant-${schedule.id}`} name="merchant" defaultValue={schedule.merchant} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`schedule-note-${schedule.id}`}>Note</FieldLabel>
          <Textarea id={`schedule-note-${schedule.id}`} name="note" defaultValue={schedule.note} />
        </Field>
        <Button disabled={isPending} type="submit">
          Save schedule
        </Button>
      </FieldGroup>
    </form>
  );
}
