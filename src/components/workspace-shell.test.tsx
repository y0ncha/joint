import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import { getProfileInitials } from "@/lib/profile";

import { loadVerifiedProfileName, ProfileInitialAvatar, WorkspaceChrome, WorkspacePage, type WorkspacePageProps } from "./workspace-shell";

const currentPathname = vi.hoisted(() => ({ value: "/settings" }));

vi.mock("next/navigation", () => ({ usePathname: () => currentPathname.value }));
vi.mock("next/link", () => ({
  default: ({ prefetch, href, className, ...props }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a {...props} className={className} href={href} {...(prefetch ? { "data-prefetch": "full" } : {})} />
  ),
}));

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

function WorkspaceFixture(props: WorkspacePageProps) {
  return (
    <WorkspaceChrome profileSlot={<ProfileInitialAvatar name="" />}>
      <WorkspacePage {...props} />
    </WorkspaceChrome>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  cache.clear();
  currentPathname.value = "/settings";
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

it("renders one chrome landmark and lets its skip link target page content", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceChrome profileSlot={<ProfileInitialAvatar name="" />}>
      <WorkspacePage title="Transactions">ledger</WorkspacePage>
    </WorkspaceChrome>,
  );

  expect(markup.match(/<main/g)).toHaveLength(1);
  expect(markup).toContain('href="#workspace-content"');
  expect(markup).toContain('id="workspace-content"');
  expect(markup).toContain("Transactions");
});

it("renders the desktop rail with navigation and a plain profile avatar", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceFixture title="Settings">
      <p>Content</p>
    </WorkspaceFixture>,
  );
  const desktopRail = markup.match(/<aside\b[\s\S]*?<\/aside>/)?.[0] ?? "";

  expect(desktopRail).toContain('alt="Joint logo"');
  expect(desktopRail).toContain('aria-label="Primary navigation"');
  expect(desktopRail).toContain('href="/"');
  expect(desktopRail).toContain('href="/transactions"');
  expect(desktopRail).toContain('href="/categories"');
  expect(desktopRail).toContain('href="/automations"');
  expect(desktopRail).toContain('href="/settings"');
});

it("renders Categories and Automations in the desktop navigation only", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceFixture title="Bills & Groceries">
      <p>Content</p>
    </WorkspaceFixture>,
  );
  const navigations = [...markup.matchAll(/<nav\b[\s\S]*?<\/nav>/g)].map(([navigation]) => navigation);

  expect(navigations).toHaveLength(2);
  expect(navigations[0]).toMatch(
    /href="\/transactions"[\s\S]*href="\/bills-groceries"[\s\S]*href="\/categories"[\s\S]*href="\/automations"[\s\S]*href="\/settings"/,
  );
  expect(navigations[1]).toMatch(/href="\/transactions"[\s\S]*href="\/bills-groceries"[\s\S]*href="\/settings"/);
  expect(navigations[1]).not.toContain('href="/categories"');
  expect(navigations[1]).not.toContain('href="/automations"');
  expect(navigations[0]).toContain('aria-label="Bills &amp; Groceries"');
  expect(navigations[0]).toMatch(/<a[^>]*class="[^"]*size-11[^>]*href="\/bills-groceries"/);

  expect(navigations[1]).not.toContain("Bills &amp; Groceries</span>");
});

it("keeps Bills & Groceries prefetching partial so its loading boundary can render", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceFixture title="Settings">
      <p>Content</p>
    </WorkspaceFixture>,
  );
  const billsLinks = [...markup.matchAll(/<a\b[^>]*href="\/bills-groceries"[^>]*>/g)].map(([link]) => link);

  expect(billsLinks).toHaveLength(2);
  expect(billsLinks.every((link) => !link.includes('data-prefetch="full"'))).toBe(true);
});

it("marks Bills & Groceries active for its route and nested paths", () => {
  currentPathname.value = "/bills-groceries/groceries";

  const markup = renderToStaticMarkup(
    <WorkspaceFixture title="Bills & Groceries">
      <p>Content</p>
    </WorkspaceFixture>,
  );

  expect(markup.match(/aria-current="page"[\s\S]*?href="\/bills-groceries"/g)).toHaveLength(2);
});

it("marks Categories active for its route", () => {
  currentPathname.value = "/categories";

  const markup = renderToStaticMarkup(
    <WorkspaceFixture title="Categories">
      <p>Content</p>
    </WorkspaceFixture>,
  );

  expect(markup.match(/aria-current="page"[\s\S]*?href="\/categories"/g)).toHaveLength(1);
});

it("makes the workspace frame full-bleed on mobile", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceFixture title="Settings">
      <p>Content</p>
    </WorkspaceFixture>,
  );

  expect(markup).toContain('class="min-h-screen p-0 text-foreground sm:px-5 sm:py-5 lg:px-8 lg:py-8"');
  expect(markup).toContain('class="mx-auto flex min-h-screen max-w-[1500px] overflow-hidden bg-white/24');
  expect(markup).toContain("sm:min-h-[calc(100vh-2.5rem)]");
  expect(markup).toContain("lg:min-h-[calc(100vh-4rem)]");
});

it("uses iPhone safe areas for the top content and bottom navigation", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceFixture title="Settings">
      <p>Content</p>
    </WorkspaceFixture>,
  );

  expect(markup).toContain("pt-[calc(1rem+env(safe-area-inset-top))]");
  expect(markup).toContain("bottom-[calc(0.75rem+env(safe-area-inset-bottom))]");
});

it("anchors the complete mobile header text stack with the accent rule", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceFixture title="Settings" description="Adjust household preferences.">
      <p>Content</p>
    </WorkspaceFixture>,
  );

  expect(markup).toContain('class="flex min-w-0 flex-1 items-stretch gap-3 pl-1 md:block md:pl-0"');
  expect(markup).toContain('class="block w-1 shrink-0 self-stretch rounded-full bg-primary md:hidden"');
  expect(markup).toContain('bg-primary md:hidden"></span><div><p class="text-sm font-medium text-primary">Joint</p><h1');
  expect(markup).toContain('>Settings</h1><p class="mt-1 text-sm text-muted-foreground">Adjust household preferences.</p>');
});

it("keeps workspace chrome visible around BillsGroceries detail content", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceFixture title="Groceries by day" description="Daily spending">
      <p>Chart detail</p>
    </WorkspaceFixture>,
  );

  expect(markup).toContain("<aside");
  expect(markup).not.toContain('<aside hidden=""');
  expect(markup).toContain("<header");
  expect(markup).not.toContain('<header hidden=""');
  expect(markup).toContain('<nav aria-label="Primary navigation"');
  expect(markup).toContain(">Groceries by day</h1>");
  expect(markup).toContain('aria-label="Primary navigation"');
  expect(markup).toContain("Chart detail");
  expect(markup).not.toContain("animate-in fade-in-0");
  expect(markup).toContain("p-4 pt-[calc(1rem+env(safe-area-inset-top))]");
  expect(markup).toContain("min-h-screen");
  expect(markup).toContain("sm:min-h-[calc(100vh-2.5rem)]");
});

it("can increase the content-surface opacity for a full-page detail view", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceFixture opaqueContent>
      <p>Chart detail</p>
    </WorkspaceFixture>,
  );

  expect(markup).toContain("bg-white/50");
});
