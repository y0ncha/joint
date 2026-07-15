import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  redirect: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { logOut } from "./auth";

describe("auth actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createServerSupabaseClient.mockResolvedValue({ auth: { signOut: mocks.signOut } });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("signs out only the current session and returns to login", async () => {
    await logOut();

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});
