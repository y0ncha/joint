import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <section data-sheet>{children}</section>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
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

const { MemberManagementSheet } = await import("./partner-access-control");
const owner = { name: "Ada Lovelace", email: "ada@example.com", color: "#dcece3" };

it("shows the email form only for empty partner access", () => {
  const markup = renderToStaticMarkup(<MemberManagementSheet owner={owner} partner={{ status: "empty" }} />);

  expect(markup).toContain("Member&#x27;s Google email");
  expect(markup).toContain('aria-label="Invite member"');
  expect(markup).toContain("lucide-send");
  expect(markup).toContain('type="email"');
  expect(markup).toContain('name="email"');
  expect(markup).toContain('autoComplete="email"');
  expect(markup).not.toContain("Remove partner");
});

it("keeps partner-save feedback out of the form", () => {
  const markup = renderToStaticMarkup(<MemberManagementSheet owner={owner} partner={{ status: "empty" }} />);

  expect(markup).not.toContain('aria-live="polite"');
});

it.each([
  ["pending", "Invitation pending", "will no longer be authorized to join"],
  ["joined", "Grace Hopper", "will no longer be able to view or update"],
] as const)("shows visible authorized email and removal only for %s access", (status, label, removalEffect) => {
  const markup = renderToStaticMarkup(<MemberManagementSheet owner={owner} partner={{ status, email: "partner@example.com" }} member={status === "joined" ? { name: "Grace Hopper", email: "partner@example.com", color: "#123456" } : undefined} />);

  expect(markup).toContain(label);
  expect(markup).toContain("partner@example.com");
  expect(markup).toContain('aria-label="Remove member"');
  expect(markup).toContain("lucide-trash-2");
  expect(markup).not.toContain('data-slot="card-footer"');
  expect(markup).toContain("Remove member");
  expect(markup).toContain(removalEffect);
  expect(markup).not.toContain('name="email"');
  expect(markup).not.toContain("Save partner access");
});

it("keeps partner-removal feedback out of the dialog", () => {
  const markup = renderToStaticMarkup(<MemberManagementSheet owner={owner} partner={{ status: "joined", email: "partner@example.com" }} />);

  expect(markup).not.toContain('aria-live="polite"');
});

it("uses a side sheet for member management", () => {
  const markup = renderToStaticMarkup(<MemberManagementSheet owner={owner} partner={{ status: "joined", email: "partner@example.com" }} />);

  expect(markup).toContain("data-sheet");
  expect(markup).toContain("Household members");
  expect(markup).toContain("Ada Lovelace");
  expect(markup).toContain('aria-label="Manage members"');
});

it("renders the joined member with a standard avatar", () => {
  const markup = renderToStaticMarkup(<MemberManagementSheet {...{ owner: { ...owner, joinedAt: "2026-07-20T12:00:00Z", cardLastFour: "4548" }, partner: { status: "joined" as const, email: "partner@example.com" }, member: { name: "Grace Hopper", email: "partner@example.com", color: "#123456", joinedAt: "2026-07-21T12:00:00Z", cardLastFour: "1234" } }} />);

  expect(markup).toContain("Grace Hopper");
  expect(markup).toContain("!text-xl !leading-7");
  expect(markup).toContain("GH");
  expect(markup).not.toContain("background-color:#123456");
  expect(markup).not.toContain("color-mix(in srgb, #123456");
  expect(markup).toContain("Email</dt><dd");
  expect(markup).toContain("Joined</dt><dd");
  expect(markup).toContain("20/07/2026");
  expect(markup).toContain("Card ending</dt><dd");
  expect(markup).toContain("4548");
  expect(markup).toContain("21/07/2026");
  expect(markup).toContain("1234");
  expect(markup).toContain('aria-label="Owner cannot be removed"');
});
