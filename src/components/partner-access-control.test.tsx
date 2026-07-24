import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  PopoverHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  PopoverTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  PopoverDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

const { PartnerAccessControl } = await import("./partner-access-control");

it("shows the email form only for empty partner access", () => {
  const markup = renderToStaticMarkup(<PartnerAccessControl state={{ status: "empty" }} />);

  expect(markup).toContain("Partner&#x27;s Google email");
  expect(markup).toContain('type="email"');
  expect(markup).toContain('name="email"');
  expect(markup).toContain('autoComplete="email"');
  expect(markup).not.toContain("Remove partner");
});

it("renders a polite status region while saving partner access", () => {
  const markup = renderToStaticMarkup(<PartnerAccessControl state={{ status: "empty" }} />);

  expect(markup).toContain('aria-live="polite"');
});

it.each([
  ["pending", "Pending sign-in", "will no longer be authorized to join"],
  ["joined", "Joined partner", "will no longer be able to view or update"],
] as const)("shows visible authorized email and removal only for %s access", (status, label, removalEffect) => {
  const markup = renderToStaticMarkup(<PartnerAccessControl state={{ status, email: "partner@example.com" }} />);

  expect(markup).toContain(label);
  expect(markup).toContain("partner@example.com");
  expect(markup).toContain("Remove partner");
  expect(markup).toContain(removalEffect);
  expect(markup).not.toContain('name="email"');
  expect(markup).not.toContain("Save partner access");
});

it("renders a polite status region while removing partner access", () => {
  const markup = renderToStaticMarkup(<PartnerAccessControl state={{ status: "joined", email: "partner@example.com" }} />);

  expect(markup).toContain('aria-live="polite"');
});
