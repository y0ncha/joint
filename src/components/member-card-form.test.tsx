import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/app/actions/member-card", () => ({ saveCurrentMemberCard: vi.fn() }));

const { MemberCardForm } = await import("./member-card-form");

it("offers an accessible four-digit card mapping form", () => {
  const markup = renderToStaticMarkup(<MemberCardForm />);

  expect(markup).toContain("Last four digits");
  expect(markup).toContain('name="lastFour"');
  expect(markup).toContain('inputMode="numeric"');
  expect(markup).toContain('pattern="^\\d+$"');
  expect(markup).toContain("Optionally match imported statement rows to you.");
  expect(markup).toContain("Only used to match statement imports.");
  expect(markup).toContain("Save card");
  expect(markup).toContain('href="/"');
});

it("renders a polite status region for card-save feedback", () => {
  const markup = renderToStaticMarkup(<MemberCardForm />);

  expect(markup).toContain('aria-live="polite"');
});
