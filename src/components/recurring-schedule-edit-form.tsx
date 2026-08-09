"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { updateRecurringTransactionSchedule } from "@/app/actions/recurring-transactions";
import type { ActionResult } from "@/app/actions/result";
import type { RecurringScheduleRow } from "@/components/recurring-schedule-list";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function RecurringScheduleEditForm({ schedule }: { schedule: RecurringScheduleRow }) {
  const [cadence, setCadence] = useState(schedule.cadence);
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    async (_: ActionResult | null, input: FormData) => updateRecurringTransactionSchedule(schedule.id, input),
    null,
  );
  useEffect(() => {
    if (state?.status === "success") toast.success("Recurring schedule saved", { id: `schedule-${schedule.id}` });
    if (state?.status === "error") toast.error(state.formError, { id: `schedule-${schedule.id}` });
  }, [schedule.id, state]);
  return (
    <form action={formAction}>
      <FieldGroup>
        <input name="cadence" type="hidden" value={cadence} />
        <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.amount)}>
          <FieldLabel htmlFor={`schedule-amount-${schedule.id}`}>Amount</FieldLabel>
          <Input id={`schedule-amount-${schedule.id}`} name="amount" defaultValue={schedule.amount} inputMode="decimal" required />
          {state?.status === "error" ? <FieldError>{state.fieldErrors.amount}</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel>Repeat</FieldLabel>
          <ToggleGroup type="single" value={cadence} onValueChange={(value) => value && setCadence(value)} variant="outline">
            <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
            <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
            <ToggleGroupItem value="custom_weekly">Custom</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        {cadence.startsWith("custom_") ? (
          <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.intervalCount)}>
            <FieldLabel htmlFor={`schedule-interval-${schedule.id}`}>Every</FieldLabel>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <Input
                id={`schedule-interval-${schedule.id}`}
                name="intervalCount"
                defaultValue={schedule.interval_count}
                type="number"
                min="1"
                required
              />
              <ToggleGroup type="single" value={cadence} onValueChange={(value) => value && setCadence(value)} variant="outline">
                <ToggleGroupItem value="custom_weekly">Weeks</ToggleGroupItem>
                <ToggleGroupItem value="custom_monthly">Months</ToggleGroupItem>
              </ToggleGroup>
            </div>
            {state?.status === "error" ? <FieldError>{state.fieldErrors.intervalCount}</FieldError> : null}
          </Field>
        ) : (
          <input name="intervalCount" type="hidden" value="1" />
        )}
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
