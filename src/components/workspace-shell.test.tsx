import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

import { getProfileInitials, loadVerifiedProfileName, ProfileInitialAvatar, WorkspaceShell } from "./workspace-shell";

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

it("returns a cached profile name without querying profiles", async () => {
  cache.set("joint-profile-name:user-a", "Ada Lovelace");

  await expect(loadVerifiedProfileName(browserClient)).resolves.toBe("Ada Lovelace");

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

  expect(markup).toContain('data-slot="avatar"');
  expect(markup).toContain("AL");
  expect(markup).not.toContain('data-slot="avatar-badge"');
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
  expect(desktopRail).toContain('data-slot="avatar"');
  expect(desktopRail).not.toContain('aria-label="Open notifications"');
  expect(desktopRail).not.toContain('data-slot="avatar-badge"');
});
