import { createHash } from "node:crypto";

export type DuplicateCandidate = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  occurredOn: string;
  merchant: string;
};

export type ExistingTransaction = DuplicateCandidate;
export type DuplicateMatch = { candidateId: string; existingId: string };
export type DuplicatePreview = {
  fingerprint: string;
  matches: Array<{ candidate: DuplicateCandidate; existing: ExistingTransaction }>;
};

function merchantKey(merchant: string) {
  return merchant.trim().toLocaleLowerCase();
}

function transactionKey(transaction: Omit<DuplicateCandidate, "id">) {
  return [transaction.kind, transaction.amount, transaction.occurredOn, merchantKey(transaction.merchant)].join("\u0000");
}

export function previewTransactionDuplicates(
  candidates: readonly DuplicateCandidate[],
  existing: readonly ExistingTransaction[],
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
  existing: readonly ExistingTransaction[],
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
