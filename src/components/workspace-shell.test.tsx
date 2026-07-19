import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

import { getProfileInitials, loadVerifiedProfileName, WorkspaceShell } from "./workspace-shell";

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
const profileQuery = {
  eq: mocks.eq,
  maybeSingle: mocks.maybeSingle,
  single: mocks.single,
  then: (resolve: (value: { data: { full_name: string | null } | null; error: null }) => unknown) =>
    resolve({ data: { full_name: "  Ada Lovelace  " }, error: null }),
};
const browserClient = {
  auth: { getClaims: mocks.getClaims },
  from: mocks.from,
};

beforeEach(() => {
  vi.resetAllMocks();
  cache.clear();
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
  ["", "?"],
  ["   ", "?"],
  ["ada", "A"],
  ["  Ada   Lovelace ", "AL"],
  ["Ada Byron Lovelace", "AL"],
])("derives %s as %s profile initials", (name, initials) => {
  expect(getProfileInitials(name)).toBe(initials);
});

it("keeps a non-interactive avatar with no notification UI in the desktop rail", () => {
  const markup = renderToStaticMarkup(<WorkspaceShell title="Settings">Content</WorkspaceShell>);

  expect(markup).toContain('data-slot="avatar"');
  expect(markup).not.toContain('aria-label="Open notifications"');
  expect(markup).not.toContain("Notifications");
  expect(markup).not.toContain("No unread household updates.");
  expect(markup).not.toContain("AvatarBadge");
  expect(markup).not.toContain('role="button"');
  expect(markup).not.toContain("<button");
  expect(markup).toContain("Overview");
  expect(markup).toContain("Transactions");
  expect(markup).toContain("Categories");
  expect(markup).toContain("Settings");
  expect(markup).not.toContain("Accounts");
});
