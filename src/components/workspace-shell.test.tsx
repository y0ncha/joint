import { readFile } from "node:fs/promises";

import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));

const shellModule = await import("./workspace-shell").catch(() => null);

it("keeps a non-interactive, user-keyed profile-initial avatar in the desktop rail", async () => {
  const markup = shellModule ? renderToStaticMarkup(<shellModule.WorkspaceShell title="Settings">Content</shellModule.WorkspaceShell>) : "";
  const source = await readFile(new URL("./workspace-shell.tsx", import.meta.url), "utf8");

  expect(markup).toContain("Overview");
  expect(markup).toContain("Transactions");
  expect(markup).toContain("Categories");
  expect(markup).toContain("Settings");
  expect(markup).not.toContain("aria-label=\"Open notifications\"");
  expect(markup).not.toContain("Notifications");
  expect(markup).not.toContain("No unread household updates.");
  expect(markup).toContain('data-slot="avatar"');
  expect(source).toContain("function ProfileInitialAvatar");
  expect(source).toContain('from("@/components/ui/avatar")');
  expect(source).toContain("AvatarFallback");
  expect(source).toContain("auth.getClaims()");
  expect(source).toContain("joint-profile-name:${userId}");
  expect(source).toContain("localStorage.getItem(cacheKey)");
  expect(source).toContain("if (cachedName !== null)");
  expect(source).toMatch(/if \(cachedName !== null\)[\s\S]*?return;[\s\S]*?from\("profiles"\)/);
  expect(source).toContain('from("profiles")');
  expect(source).toContain('select("full_name")');
  expect(source).toContain('eq("id", userId)');
  expect(source).toContain("localStorage.setItem(cacheKey, fullName)");
  expect(source).toContain("fullName?.trim() ?? \"\"");
  expect(source).toContain("split(/\\s+/)");
  expect(source).toContain("words.at(-1)");
  expect(source).toContain("toUpperCase()");
  expect(source).not.toContain("<button");
  expect(source).not.toContain("Popover");
  expect(source).not.toContain("AvatarBadge");
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
