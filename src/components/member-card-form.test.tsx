import { readFileSync } from "node:fs";
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
  expect(markup).toContain('pattern="[0-9]{4}"');
  expect(markup).toContain("Only used to match statement imports.");
  expect(markup).toContain("Save card");
  expect(markup).toContain('href="/"');
});

it("supports accessible feedback and a caller-selected post-save destination", () => {
  const source = readFileSync("src/components/member-card-form.tsx", "utf8");

  expect(source).toContain("saveCurrentMemberCard");
  expect(source).toContain('aria-live="polite"');
  expect(source).toContain("redirectTo");
  expect(source).toContain("min-h-11");
  expect(source).toContain("text-center font-mono");
});
