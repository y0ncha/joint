import { expect, it } from "vitest";

import { confirmTransactionDuplicatePreview, fingerprintDuplicatePreview, previewTransactionDuplicates } from "./transaction-duplicates";

const existing = [{ id: "existing", kind: "expense" as const, amount: 24.9, occurredOn: "2026-08-14", merchant: "Super Pharm" }];

it("matches a trimmed case-insensitive merchant with the same kind, amount, and date", () => {
  expect(
    previewTransactionDuplicates(
      [{ id: "incoming", kind: "expense", amount: 24.9, occurredOn: "2026-08-14", merchant: " super pharm " }],
      existing,
    ),
  ).toEqual([{ candidateId: "incoming", existingId: "existing" }]);
});

it("does not match the opposite transaction kind", () => {
  expect(
    previewTransactionDuplicates(
      [{ id: "incoming", kind: "income", amount: 24.9, occurredOn: "2026-08-14", merchant: "Super Pharm" }],
      existing,
    ),
  ).toEqual([]);
});

it("fingerprints the candidate and match identities deterministically", () => {
  const preview = [{ candidateId: "incoming", existingId: "existing" }];

  expect(fingerprintDuplicatePreview(preview)).toBe(fingerprintDuplicatePreview(preview));
});

it("changes the fingerprint when the submitted candidate snapshot changes", () => {
  const preview = [{ candidateId: "incoming", existingId: "existing" }];

  expect(fingerprintDuplicatePreview(preview, { amount: 24.9 })).not.toBe(fingerprintDuplicatePreview(preview, { amount: 25 }));
});

it("uses the same existing match regardless of database row order", () => {
  const candidate = [{ id: "incoming", kind: "expense" as const, amount: 24.9, occurredOn: "2026-08-14", merchant: "Super Pharm" }];
  const duplicates = [
    { id: "a", kind: "expense" as const, amount: 24.9, occurredOn: "2026-08-14", merchant: "Super Pharm" },
    { id: "z", kind: "expense" as const, amount: 24.9, occurredOn: "2026-08-14", merchant: "Super Pharm" },
  ];

  expect(previewTransactionDuplicates(candidate, duplicates)).toEqual([{ candidateId: "incoming", existingId: "a" }]);
});

it("confirms only the selected incoming duplicates", () => {
  const preview = {
    fingerprint: "preview",
    matches: [
      { candidate: { ...existing[0], id: "first" }, existing: existing[0] },
      { candidate: { ...existing[0], id: "second" }, existing: existing[0] },
    ],
  };
  const input = new FormData();
  input.set("duplicateFingerprint", preview.fingerprint);
  input.append("discardDuplicateId", "second");

  expect(confirmTransactionDuplicatePreview(input, preview).skippedIds).toEqual(new Set(["second"]));
});
