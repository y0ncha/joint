import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

import { getProfileInitials } from "@/lib/profile";

import { loadVerifiedProfileName, ProfileInitialAvatar, WorkspaceShell } from "./workspace-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
}));

const cache = new Map<string, string>();
let profileName: string | null;
const profileQuery = {
  eq: mocks.eq,
  maybeSingle: mocks.maybeSingle,
  single: mocks.single,
  then: (resolve: (value: { data: { full_name: string | null } | null; error: null }) => unknown) =>
    resolve({ data: { full_name: profileName }, error: null }),
};
const browserClient = {
  auth: { getClaims: mocks.getClaims },
  from: mocks.from,
};

beforeEach(() => {
  vi.resetAllMocks();
  cache.clear();
  profileName = "  Ada Lovelace  ";
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => cache.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => cache.set(key, value)),
  });
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-a" } } });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue(profileQuery);
  mocks.eq.mockReturnValue(profileQuery);
  mocks.maybeSingle.mockReturnValue(profileQuery);
  mocks.single.mockReturnValue(profileQuery);
});

it("uses the verified claim subject as the profile-name cache suffix", async () => {
  cache.set("joint-profile-name:user-a", "Ada Lovelace");

  await expect(loadVerifiedProfileName(browserClient)).resolves.toBe("Ada Lovelace");

  expect(localStorage.getItem).toHaveBeenCalledWith("joint-profile-name:user-a");
  expect(mocks.from).not.toHaveBeenCalled();
});

it("queries only the verified user on a cache miss and writes the trimmed name", async () => {
  await expect(loadVerifiedProfileName(browserClient)).resolves.toBe("Ada Lovelace");

  expect(mocks.from).toHaveBeenCalledWith("profiles");
  expect(mocks.select).toHaveBeenCalledWith("full_name");
  expect(mocks.eq).toHaveBeenCalledWith("id", "user-a");
  expect(localStorage.setItem).toHaveBeenCalledWith("joint-profile-name:user-a", "Ada Lovelace");
});

it("caches an empty profile name on a cache miss", async () => {
  profileName = null;

  await expect(loadVerifiedProfileName(browserClient)).resolves.toBe("");

  expect(localStorage.setItem).toHaveBeenCalledWith("joint-profile-name:user-a", "");
});

it("returns a cached empty profile name without querying profiles", async () => {
  cache.set("joint-profile-name:user-a", "");

  await expect(loadVerifiedProfileName(browserClient)).resolves.toBe("");

  expect(mocks.from).not.toHaveBeenCalled();
});

it("does not reuse cached profile names between verified users", async () => {
  cache.set("joint-profile-name:user-a", "Ada Lovelace");
  cache.set("joint-profile-name:user-b", "Grace Hopper");

  await expect(loadVerifiedProfileName(browserClient)).resolves.toBe("Ada Lovelace");
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-b" } } });
  await expect(loadVerifiedProfileName(browserClient)).resolves.toBe("Grace Hopper");

  expect(localStorage.getItem).toHaveBeenNthCalledWith(1, "joint-profile-name:user-a");
  expect(localStorage.getItem).toHaveBeenNthCalledWith(2, "joint-profile-name:user-b");
  expect(mocks.from).not.toHaveBeenCalled();
});

it.each([
  [null, "?"],
  ["", "?"],
  ["   ", "?"],
  ["ada", "A"],
  ["  Ada   Lovelace ", "AL"],
  ["Ada Byron Lovelace", "AL"],
])("derives %s as %s profile initials", (name, initials) => {
  expect(getProfileInitials(name)).toBe(initials);
});

it("renders a plain profile-initial avatar", () => {
  const markup = renderToStaticMarkup(<ProfileInitialAvatar name="Ada Lovelace" />);

  expect(markup).toContain("AL");
  expect(markup).not.toContain("tabindex");
  expect(markup).not.toContain('role="button"');
  expect(markup).not.toContain('role="link"');
  expect(markup).not.toContain("<button");
  expect(markup).not.toContain("<a ");
});

it("renders the desktop rail with navigation and a plain profile avatar", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceShell title="Settings">
      <p>Content</p>
    </WorkspaceShell>,
  );
  const desktopRail = markup.match(/<aside\b[\s\S]*?<\/aside>/)?.[0] ?? "";

  expect(desktopRail).toContain('alt="Joint logo"');
  expect(desktopRail).toContain('aria-label="Primary navigation"');
  expect(desktopRail).toContain('href="/"');
  expect(desktopRail).toContain('href="/transactions"');
  expect(desktopRail).toContain('href="/categories"');
  expect(desktopRail).toContain('href="/settings"');
});

it("makes the workspace frame full-bleed on mobile", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceShell title="Settings">
      <p>Content</p>
    </WorkspaceShell>,
  );

  expect(markup).toContain('class="min-h-screen p-0 text-foreground sm:px-5 sm:py-5 lg:px-8 lg:py-8"');
  expect(markup).toContain('class="mx-auto flex min-h-screen max-w-[1500px] overflow-hidden bg-white/24');
  expect(markup).toContain("sm:min-h-[calc(100vh-2.5rem)]");
  expect(markup).toContain("lg:min-h-[calc(100vh-4rem)]");
});

it("keeps workspace chrome visible around Essentials detail content", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceShell title="Groceries by day" description="Daily spending">
      <p>Chart detail</p>
    </WorkspaceShell>,
  );

  expect(markup).toContain("<aside");
  expect(markup).not.toContain('<aside hidden=""');
  expect(markup).toContain("<header");
  expect(markup).not.toContain('<header hidden=""');
  expect(markup).toContain('<nav aria-label="Primary navigation"');
  expect(markup).toContain(">Groceries by day</h1>");
  expect(markup).toContain('aria-label="Primary navigation"');
  expect(markup).toContain("Chart detail");
  expect(markup).toContain("duration-150 ease-out sm:p-6");
  expect(markup).toContain("min-h-screen");
  expect(markup).toContain("sm:min-h-[calc(100vh-2.5rem)]");
});

it("can increase the content-surface opacity for a full-page detail view", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceShell opaqueContent>
      <p>Chart detail</p>
    </WorkspaceShell>,
  );

  expect(markup).toContain("bg-white/50");
});
