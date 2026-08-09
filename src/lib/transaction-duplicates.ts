import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

export type DuplicateCandidate = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  occurredOn: string;
  merchant: string;
  recurringScheduleId?: string | null;
};

export type DuplicateMatch = { candidateId: string; existingId: string };
export type DuplicatePreview = {
  fingerprint: string;
  matches: Array<{ candidate: DuplicateCandidate; existing: DuplicateCandidate }>;
};

function merchantKey(merchant: string) {
  return merchant.trim().toLocaleLowerCase();
}

function transactionKey(transaction: Omit<DuplicateCandidate, "id">) {
  return [transaction.kind, transaction.amount, transaction.occurredOn, merchantKey(transaction.merchant)].join("\u0000");
}

export function previewTransactionDuplicates(
  candidates: readonly DuplicateCandidate[],
  existing: readonly DuplicateCandidate[],
): DuplicateMatch[] {
  const existingIdsByKey = new Map<string, string>();
  for (const transaction of existing) {
    const key = transactionKey(transaction);
    const current = existingIdsByKey.get(key);
    if (!current || transaction.id.localeCompare(current) < 0) existingIdsByKey.set(key, transaction.id);
  }
  return candidates.flatMap((candidate) => {
    const existingId = existingIdsByKey.get(transactionKey(candidate));
    return existingId ? [{ candidateId: candidate.id, existingId }] : [];
  });
}

export function fingerprintDuplicatePreview(matches: readonly DuplicateMatch[], snapshot: unknown = null) {
  return createHash("sha256")
    .update(JSON.stringify({ matches: [...matches].sort((left, right) => left.candidateId.localeCompare(right.candidateId)), snapshot }))
    .digest("hex");
}

export function transactionDuplicatePreview(
  candidates: readonly DuplicateCandidate[],
  existing: readonly DuplicateCandidate[],
  snapshot: unknown = candidates,
): DuplicatePreview {
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const existingById = new Map(existing.map((transaction) => [transaction.id, transaction]));
  const matches = previewTransactionDuplicates(candidates, existing).flatMap(({ candidateId, existingId }) => {
    const candidate = candidatesById.get(candidateId);
    const matchedTransaction = existingById.get(existingId);
    return candidate && matchedTransaction ? [{ candidate, existing: matchedTransaction }] : [];
  });
  return {
    fingerprint: fingerprintDuplicatePreview(
      matches.map(({ candidate, existing: matchedTransaction }) => ({ candidateId: candidate.id, existingId: matchedTransaction.id })),
      snapshot,
    ),
    matches,
  };
}

export async function loadTransactionDuplicatePreview(
  supabase: SupabaseClient<Database>,
  householdId: string,
  candidates: DuplicateCandidate[],
  snapshot: unknown = candidates,
) {
  const occurredOn = [...new Set(candidates.map((candidate) => candidate.occurredOn))];
  const { data, error } = await supabase
    .from("transactions")
    .select("id, kind, amount, occurred_on, merchant, recurring_schedule_id")
    .eq("household_id", householdId)
    .in("occurred_on", occurredOn);
  if (error) throw new Error("Unable to load duplicate preview.");
  return transactionDuplicatePreview(
    candidates,
    (data ?? []).map((transaction) => ({
      id: transaction.id,
      kind: transaction.kind,
      amount: Number(transaction.amount),
      occurredOn: transaction.occurred_on,
      merchant: transaction.merchant,
      recurringScheduleId: transaction.recurring_schedule_id,
    })),
    snapshot,
  );
}

export function duplicateFormSnapshot(input: FormData) {
  return [...input.entries()].filter(([key]) => key !== "duplicateFingerprint" && key !== "discardDuplicateId");
}

export function confirmTransactionDuplicatePreview(input: FormData, preview: DuplicatePreview) {
  const fingerprint = input.get("duplicateFingerprint");
  if (!preview.matches.length && !fingerprint) return { confirmed: true as const, skippedIds: new Set<string>() };
  if (typeof fingerprint === "string" && fingerprint === preview.fingerprint) {
    const candidateIds = new Set(preview.matches.map(({ candidate }) => candidate.id));
    return {
      confirmed: true as const,
      skippedIds: new Set(input.getAll("discardDuplicateId").filter((candidateId) => candidateIds.has(candidateId))),
    };
  }
  return { confirmed: false as const, stale: Boolean(fingerprint) };
}
