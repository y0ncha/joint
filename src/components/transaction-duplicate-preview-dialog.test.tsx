import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

import { vi } from "vitest";

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogAction: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { TransactionDuplicatePreviewDialog } from "./transaction-duplicate-preview-dialog";

it("offers edit and discard actions for a duplicate", () => {
  const markup = renderToStaticMarkup(
    <TransactionDuplicatePreviewDialog
      onConfirm={() => {}}
      onOpenChange={() => {}}
      open
      preview={{
        fingerprint: "fingerprint",
        matches: [
          {
            candidate: { id: "incoming", kind: "expense", amount: 24.9, occurredOn: "2026-08-14", merchant: "Super Pharm" },
            existing: { id: "existing", kind: "expense", amount: 24.9, occurredOn: "2026-08-14", merchant: "Super Pharm" },
          },
        ],
      }}
    />,
  );

  expect(markup).toContain("Dedupe");
  expect(markup).toContain("Super Pharm");
  expect(markup).toContain("bg-white/60");
  expect(markup).not.toContain("Incoming");
  expect(markup).not.toContain("Existing");
  expect(markup).toContain("Back to Edit");
  expect(markup).toContain("Discard");
  expect(markup).not.toContain("Keep existing");
});
