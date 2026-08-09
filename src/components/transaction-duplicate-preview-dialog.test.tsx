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

it("shows the incoming and existing transactions with a Keep existing confirmation", () => {
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

  expect(markup).toContain("Possible duplicates");
  expect(markup).toContain("Incoming");
  expect(markup).toContain("Existing");
  expect(markup).toContain("Keep existing");
});
