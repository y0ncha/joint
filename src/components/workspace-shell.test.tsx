import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));

const shellModule = await import("./workspace-shell").catch(() => null);

it("keeps account management out of MVP navigation and shows a bottom avatar without an unread badge", () => {
  const markup = shellModule ? renderToStaticMarkup(<shellModule.WorkspaceShell title="Settings">Content</shellModule.WorkspaceShell>) : "";

  expect(markup).toContain("Overview");
  expect(markup).toContain("Transactions");
  expect(markup).toContain("Categories");
  expect(markup).toContain("Settings");
  expect(markup).toContain("data-slot=\"avatar\"");
  expect(markup).not.toContain(">Me<");
  expect(markup).toContain("aria-label=\"Open notifications\"");
  expect(markup).toContain("font-bold");
  expect(markup).not.toContain("data-slot=\"avatar-badge\"");
  expect(markup).not.toContain("aria-label=\"Unread notifications\"");
  expect(markup).not.toContain("-top-1 -right-1");
  expect(markup).not.toContain(">1</span>");
  expect(markup).toContain("mt-auto");
  expect(markup).toContain("lg:pt-8");
  expect(markup).toContain('data-workspace-content="true"');
  expect(markup).toContain('data-workspace-content="true" class="w-full"');
  expect(markup).toContain("p-4 pb-[calc(9rem+env(safe-area-inset-bottom))]");
  expect(markup).toContain("sm:p-6 sm:pb-[calc(9rem+env(safe-area-inset-bottom))]");
  expect(markup).toContain("bottom-[calc(0.75rem+env(safe-area-inset-bottom))]");
  expect(markup).toContain("rounded-[calc(2rem-0.75rem)]");
  expect(markup).not.toContain("pb-24 p-4");
  expect(markup).toContain("duration-150");
  expect(markup).not.toContain("duration-300");
  expect(markup).not.toContain("slide-in-from-bottom");
  expect(markup).not.toContain("Accounts");
  expect(markup).not.toContain("href=\"/accounts\"");
});
