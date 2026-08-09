"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type DragEvent } from "react";
import { FileUp, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { importStatement } from "@/app/actions/statement-import";
import type { ActionResult } from "@/app/actions/result";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TransactionDuplicatePreviewDialog } from "@/components/transaction-duplicate-preview-dialog";

export function StatementImportForm() {
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const submittedFormData = useRef<FormData | null>(null);
  const [dismissedDuplicatePreview, setDismissedDuplicatePreview] = useState("");
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(async (previousState, formData) => {
    if (droppedFile) formData.set("statement", droppedFile);
    return importStatement(previousState, formData);
  }, null);

  useEffect(() => {
    if (state?.status === "success") toast.success(`${state.data?.importedRowCount ?? 0} transactions added.`, { id: "statement-import" });
    if (state?.status === "error") toast.error(state.formError, { id: "statement-import" });
  }, [state]);
  const duplicatePreview = state?.status === "confirmation_required" ? state.duplicatePreview : null;
  const duplicatePreviewOpen = Boolean(duplicatePreview && dismissedDuplicatePreview !== duplicatePreview.fingerprint);

  function confirmDuplicates() {
    if (!duplicatePreview || !submittedFormData.current) return;
    const confirmed = new FormData();
    submittedFormData.current.forEach((value, key) => confirmed.append(key, value));
    confirmed.set("duplicateFingerprint", duplicatePreview.fingerprint);
    setDismissedDuplicatePreview(duplicatePreview.fingerprint);
    startTransition(() => formAction(confirmed));
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    setDroppedFile(event.dataTransfer.files[0] ?? null);
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        submittedFormData.current = new FormData(event.currentTarget);
        setDismissedDuplicatePreview("");
      }}
    >
      <FieldGroup>
        <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.statement)}>
          <label
            htmlFor="statement"
            onDragEnter={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            aria-busy={isPending}
            className={`flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border px-6 text-center transition-[background-color,border-color,box-shadow] motion-reduce:transition-none focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/50 ${isPending ? "cursor-wait border-primary bg-primary/10 shadow-sm" : isDragging || droppedFile ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-white/35 hover:border-primary/50 hover:bg-white/55"}`}
          >
            {isPending ? (
              <>
                <LoaderCircle aria-hidden="true" className="mb-4 size-10 animate-spin text-primary motion-reduce:animate-none" />
                <span className="text-lg font-medium text-primary">Processing file…</span>
              </>
            ) : droppedFile ? (
              <>
                <FileUp aria-hidden="true" className="mb-4 size-10 text-primary" />
                <span className="max-w-full truncate text-lg font-medium text-primary">Selected: {droppedFile.name}</span>
                <span className="mt-1 text-lg text-muted-foreground/60">Tap to change file</span>
              </>
            ) : (
              <>
                <FileUp aria-hidden="true" className="mb-4 size-10 text-muted-foreground/45" />
                <span className="text-lg font-medium text-muted-foreground/70">Drop your file here</span>
                <span className="mt-1 text-lg text-muted-foreground/50">Tap to browse · CSV or XLSX</span>
              </>
            )}
            <Input
              id="statement"
              name="statement"
              type="file"
              accept=".csv,.xlsx"
              disabled={isPending}
              onChange={(event) => setDroppedFile(event.target.files?.[0] ?? null)}
              aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.statement)}
              className="sr-only"
            />
          </label>
          {state?.status === "error" && state.fieldErrors.statement ? <FieldError>{state.fieldErrors.statement}</FieldError> : null}
        </Field>
        <Button disabled={isPending} type="submit" className="min-h-11">
          {isPending ? "Processing…" : "Process file"}
        </Button>
      </FieldGroup>
      {duplicatePreview ? (
        <TransactionDuplicatePreviewDialog
          onConfirm={confirmDuplicates}
          onOpenChange={(nextOpen) => !nextOpen && setDismissedDuplicatePreview(duplicatePreview.fingerprint)}
          open={duplicatePreviewOpen}
          preview={duplicatePreview}
        />
      ) : null}
    </form>
  );
}
