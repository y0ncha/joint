"use client";

import { useActionState } from "react";

import { importStatement } from "@/app/actions/statement-import";
import type { ActionResult } from "@/app/actions/result";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function StatementImportForm() {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(importStatement, null);

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.statement)}>
          <FieldLabel htmlFor="statement">Statement file</FieldLabel>
          <Input
            id="statement"
            name="statement"
            type="file"
            accept=".csv,.xlsx"
            required
            aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.statement)}
            className="min-h-11"
          />
          <FieldDescription>
            Upload one CSV or XLSX file up to 1 MiB. It must include the exact headers כרטיס, בית עסק, תאריך עסקה, פירוט, and סכום החיוב.
          </FieldDescription>
          <FieldDescription>Submitting saves valid transactions. Cards without a saved last-four mapping remain unassigned.</FieldDescription>
          {state?.status === "error" && state.fieldErrors.statement ? <FieldError>{state.fieldErrors.statement}</FieldError> : null}
        </Field>
        {state?.status === "error" ? <FieldError>{state.formError}</FieldError> : null}
        <div aria-live="polite">
          {state?.status === "success" ? (
            <p>
              Imported {state.data?.importedRowCount} transactions; skipped {state.data?.skippedZeroCount} zero-value rows. Income: {state.data?.incomeTotal} ILS. Expenses: {state.data?.expenseTotal} ILS. Dates: {state.data?.earliestOccurredOn} to {state.data?.latestOccurredOn}.
            </p>
          ) : null}
        </div>
        <Button disabled={isPending} type="submit" className="min-h-11">
          {isPending ? "Importing statement…" : "Import statement"}
        </Button>
      </FieldGroup>
    </form>
  );
}
