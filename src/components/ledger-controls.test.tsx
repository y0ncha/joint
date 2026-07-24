import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/transactions",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { LedgerControls } = await import("./ledger-controls");

it("renders visible Filter and Sort by controls", () => {
  const markup = renderToStaticMarkup(
    <LedgerControls filterKind="expense" importRequested={false} month="2026-07" sort="amount-asc" />,
  );

  expect(markup).toContain("Filter");
  expect(markup).toContain('aria-label="Filter"');
  expect(markup).toContain("Sort by");
  expect(markup).toContain('aria-label="Sort by"');
});
