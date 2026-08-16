import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

const { GET } = await import("./route");
const environment = { ...process.env };

function request(authorization?: string) {
  return new Request("http://localhost/api/cron/recurring-transactions", {
    headers: authorization ? { authorization } : undefined,
  });
}

function configureEnvironment() {
  process.env.CRON_SECRET = "cron-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
}

afterEach(() => {
  vi.resetAllMocks();
  process.env = { ...environment };
});

it.each([undefined, "Bearer wrong-secret"])("rejects missing or incorrect authorization (%s)", async (authorization) => {
  configureEnvironment();
  mocks.createClient.mockReturnValue({ rpc: vi.fn() });

  const response = await GET(request(authorization));

  expect(response.status).toBe(401);
  expect(mocks.createClient).not.toHaveBeenCalled();
});

it("rejects Bearer undefined when CRON_SECRET is not configured", async () => {
  delete process.env.CRON_SECRET;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  mocks.createClient.mockReturnValue({ rpc: vi.fn() });

  const response = await GET(request("Bearer undefined"));

  expect(response.status).toBe(401);
  expect(mocks.createClient).not.toHaveBeenCalled();
});

it.each(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])(
  "returns 500 without creating a client when %s is missing",
  async (missingVariable) => {
    configureEnvironment();
    delete process.env[missingVariable];
    mocks.createClient.mockReturnValue({ rpc: vi.fn() });

    const response = await GET(request("Bearer cron-secret"));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Server configuration is missing.");
    expect(mocks.createClient).not.toHaveBeenCalled();
  },
);

it("returns exact camelCase counts for a successful processor call", async () => {
  configureEnvironment();
  const rpc = vi.fn().mockResolvedValue({ data: { created_count: 2, blocked_count: 1 }, error: null });
  mocks.createClient.mockReturnValue({ rpc });

  const response = await GET(request("Bearer cron-secret"));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, createdCount: 2, blockedCount: 1 });
  expect(rpc).toHaveBeenCalledOnce();
  expect(rpc).toHaveBeenCalledWith("process_due_recurring_transaction_schedules", {});
});

it("returns a generic 500 when the processor fails without leaking details", async () => {
  configureEnvironment();
  const secret = "supabase-secret-value";
  const financialPayload = "household-financial-payload";
  const rpc = vi.fn().mockResolvedValue({
    data: null,
    error: { message: secret, details: financialPayload },
  });
  mocks.createClient.mockReturnValue({ rpc });

  const response = await GET(request("Bearer cron-secret"));
  const body = await response.text();

  expect(response.status).toBe(500);
  expect(body).toBe("Unable to process recurring transactions.");
  expect(body).not.toContain(secret);
  expect(body).not.toContain(financialPayload);
});

it.each([
  null,
  [],
  {},
  { created_count: 1 },
  { created_count: "1", blocked_count: 0 },
  { created_count: 0, blocked_count: "0" },
  { created_count: -1, blocked_count: 0 },
  { created_count: 0, blocked_count: -1 },
  { created_count: 1.5, blocked_count: 0 },
  { created_count: 0, blocked_count: 1.5 },
  { created_count: Number.NaN, blocked_count: 0 },
  { created_count: 0, blocked_count: Number.POSITIVE_INFINITY },
])("rejects malformed processor result %#", async (data) => {
  configureEnvironment();
  const rpc = vi.fn().mockResolvedValue({ data, error: null });
  mocks.createClient.mockReturnValue({ rpc });

  const response = await GET(request("Bearer cron-secret"));

  expect(response.status).toBe(500);
  expect(await response.text()).toBe("Invalid recurring transaction processor result.");
});
