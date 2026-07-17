import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

const routeModule = await import("./route").catch(() => null);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createServerSupabaseClient.mockResolvedValue({ auth: { signOut: mocks.signOut } });
  mocks.signOut.mockResolvedValue({ error: null });
});

it("clears the local session before returning an access-denied login", async () => {
  expect(routeModule).not.toBeNull();
  if (!routeModule) return;

  const response = await routeModule.GET(new Request("https://joint.test/auth/access-denied"));

  expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(response.headers.get("location")).toBe("https://joint.test/login?error=access_denied");
});
