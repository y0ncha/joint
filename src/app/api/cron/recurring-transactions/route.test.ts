import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

const { GET } = await import("./route");
const environment = { ...process.env };

afterEach(() => {
  vi.resetAllMocks();
  process.env = { ...environment };
});

it("rejects Bearer undefined when CRON_SECRET is not configured", async () => {
  delete process.env.CRON_SECRET;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  mocks.createClient.mockReturnValue({ rpc: vi.fn() });

  const response = await GET(
    new Request("http://localhost/api/cron/recurring-transactions", { headers: { authorization: "Bearer undefined" } }),
  );

  expect(response.status).toBe(401);
  expect(mocks.createClient).not.toHaveBeenCalled();
});
