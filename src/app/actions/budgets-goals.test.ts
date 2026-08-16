import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentHousehold: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const actions = await import("./budgets-goals");

const householdId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const categoryId = "11111111-1111-4111-8111-111111111111";
const subcategoryId = "22222222-2222-4222-8222-222222222222";
const parentCategoryId = "33333333-3333-4333-8333-333333333333";
const goalId = "44444444-4444-4444-8444-444444444444";

type QueryResult = { data?: unknown; error?: unknown };

function formData(values: Record<string, string>) {
  const input = new FormData();
  Object.entries(values).forEach(([key, value]) => input.set(key, value));
  return input;
}

function query(result: QueryResult) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "insert", "update", "delete", "eq", "maybeSingle", "single"]) {
    chain[method] = vi.fn();
    chain[method].mockReturnValue(chain);
  }
  chain.maybeSingle.mockResolvedValue(result);
  chain.single.mockResolvedValue(result);
  chain.then = vi.fn((resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve));
  return chain;
}

function configureSupabase(results: Record<string, QueryResult[]>) {
  const queries: Array<{ table: string; chain: Record<string, ReturnType<typeof vi.fn>> }> = [];
  mocks.from.mockImplementation((table: string) => {
    const chain = query(results[table]?.shift() ?? { data: [], error: null });
    queries.push({ table, chain });
    return chain;
  });
  return queries;
}

function targetRow(overrides: Record<string, unknown> = {}) {
  return { id: categoryId, household_id: householdId, kind: "expense", archived_at: null, ...overrides };
}

function goalForm(overrides: Record<string, string> = {}) {
  return formData({ name: "Emergency fund", targetAmount: "5000", savedAmount: "125", targetDate: "2026-12-31", ...overrides });
}

describe("budget actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireCurrentHousehold.mockResolvedValue({
      status: "member",
      householdId,
      userId: "member-id",
      role: "member",
      supabase: { from: mocks.from },
    });
  });

  it("returns keyed validation errors without requiring membership", async () => {
    await expect(
      actions.saveMonthlyBudget(null, formData({ targetKind: "category", targetId: "not-a-uuid", monthlyBudget: "0" })),
    ).resolves.toMatchObject({
      status: "error",
      formError: "Check the form details.",
      fieldErrors: expect.objectContaining({ targetId: expect.any(String), monthlyBudget: expect.any(String) }),
    });
    expect(mocks.requireCurrentHousehold).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("updates an active expense category budget and revalidates all dependent routes", async () => {
    const queries = configureSupabase({
      categories: [
        { data: targetRow(), error: null },
        { data: { id: categoryId }, error: null },
      ],
    });

    await expect(
      actions.saveMonthlyBudget(null, formData({ targetKind: "category", targetId: categoryId, monthlyBudget: "1200.50" })),
    ).resolves.toEqual({ status: "success" });

    expect(queries[1].chain.update).toHaveBeenCalledWith({ monthly_budget: 1200.5 });
    expect(queries[1].chain.eq).toHaveBeenCalledWith("id", categoryId);
    expect(queries[1].chain.eq).toHaveBeenCalledWith("household_id", householdId);
    expect(mocks.revalidatePath.mock.calls).toEqual([["/budgets-goals"], ["/"], ["/bills-groceries"]]);
  });

  it("validates the active expense parent before updating a subcategory budget", async () => {
    const queries = configureSupabase({
      subcategories: [
        { data: { id: subcategoryId, household_id: householdId, category_id: parentCategoryId, archived_at: null }, error: null },
        { data: { id: subcategoryId }, error: null },
      ],
      categories: [
        { data: targetRow({ id: parentCategoryId }), error: null },
        { data: { id: subcategoryId }, error: null },
      ],
    });

    await expect(
      actions.saveMonthlyBudget(null, formData({ targetKind: "subcategory", targetId: subcategoryId, monthlyBudget: "99" })),
    ).resolves.toEqual({ status: "success" });
    expect(queries[2].chain.update).toHaveBeenCalledWith({ monthly_budget: 99 });
  });

  it.each([
    ["inactive category", "category", { data: targetRow({ archived_at: "2026-01-01" }), error: null }],
    ["income category", "category", { data: targetRow({ kind: "income" }), error: null }],
    ["cross-household category", "category", { data: targetRow({ household_id: "other-household" }), error: null }],
  ])("rejects an %s before writing", async (_label, targetKind, result) => {
    configureSupabase({ categories: [result] });
    await expect(
      actions.saveMonthlyBudget(null, formData({ targetKind, targetId: categoryId, monthlyBudget: "100" })),
    ).resolves.toMatchObject({ status: "error", fieldErrors: expect.objectContaining({ targetId: expect.any(String) }) });
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects an inactive or income parent before writing a subcategory budget", async () => {
    for (const parent of [
      targetRow({ id: parentCategoryId, archived_at: "2026-01-01" }),
      targetRow({ id: parentCategoryId, kind: "income" }),
    ]) {
      vi.resetAllMocks();
      mocks.requireCurrentHousehold.mockResolvedValue({ householdId, supabase: { from: mocks.from } });
      configureSupabase({
        subcategories: [
          { data: { id: subcategoryId, household_id: householdId, category_id: parentCategoryId, archived_at: null }, error: null },
        ],
        categories: [{ data: parent, error: null }],
      });
      await expect(
        actions.saveMonthlyBudget(null, formData({ targetKind: "subcategory", targetId: subcategoryId, monthlyBudget: "100" })),
      ).resolves.toMatchObject({ status: "error" });
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    }
  });

  it("returns a stable error for target lookup and zero-row update failures", async () => {
    configureSupabase({ categories: [{ data: null, error: { message: "database unavailable" } }] });
    await expect(
      actions.saveMonthlyBudget(null, formData({ targetKind: "category", targetId: categoryId, monthlyBudget: "100" })),
    ).resolves.toMatchObject({ status: "error", formError: expect.stringContaining("budget") });

    vi.resetAllMocks();
    mocks.requireCurrentHousehold.mockResolvedValue({ householdId, supabase: { from: mocks.from } });
    configureSupabase({
      categories: [
        { data: targetRow(), error: null },
        { data: null, error: null },
      ],
    });
    await expect(
      actions.saveMonthlyBudget(null, formData({ targetKind: "category", targetId: categoryId, monthlyBudget: "100" })),
    ).resolves.toMatchObject({ status: "error", formError: expect.stringContaining("budget") });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("removes a category budget with a membership-scoped null update", async () => {
    const queries = configureSupabase({
      categories: [
        { data: targetRow(), error: null },
        { data: { id: categoryId }, error: null },
      ],
    });
    await expect(actions.removeMonthlyBudget(null, formData({ targetKind: "category", targetId: categoryId }))).resolves.toEqual({
      status: "success",
    });
    expect(queries[1].chain.update).toHaveBeenCalledWith({ monthly_budget: null });
    expect(mocks.revalidatePath.mock.calls).toEqual([["/budgets-goals"], ["/"], ["/bills-groceries"]]);
  });
});

describe("savings goal actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireCurrentHousehold.mockResolvedValue({
      status: "member",
      householdId,
      userId: "member-id",
      role: "member",
      supabase: { from: mocks.from },
    });
  });

  it("rejects a past target date before requiring membership", async () => {
    await expect(actions.createSavingsGoal(null, goalForm({ targetDate: "2020-01-01" }))).resolves.toMatchObject({
      status: "error",
      fieldErrors: { targetDate: "Choose today or a future date." },
    });
    expect(mocks.requireCurrentHousehold).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("creates an overfunded goal with trimmed input and exact route revalidation", async () => {
    const queries = configureSupabase({ savings_goals: [{ data: { id: goalId }, error: null }] });
    await expect(
      actions.createSavingsGoal(null, goalForm({ name: "  Emergency fund  ", targetAmount: "100", savedAmount: "125" })),
    ).resolves.toEqual({ status: "success" });
    expect(queries[0].chain.insert).toHaveBeenCalledWith({
      household_id: householdId,
      name: "Emergency fund",
      target_amount: 100,
      saved_amount: 125,
      target_date: "2026-12-31",
    });
    expect(mocks.revalidatePath.mock.calls).toEqual([["/budgets-goals"], ["/"]]);
  });

  it("returns validation errors for invalid goal fields without writing", async () => {
    await expect(actions.createSavingsGoal(null, goalForm({ name: " ", targetAmount: "0", savedAmount: "-1" }))).resolves.toMatchObject({
      status: "error",
      formError: "Check the form details.",
      fieldErrors: expect.objectContaining({ name: expect.any(String), targetAmount: expect.any(String), savedAmount: expect.any(String) }),
    });
    expect(mocks.requireCurrentHousehold).not.toHaveBeenCalled();
  });

  it("returns create errors and never revalidates after a Supabase failure", async () => {
    configureSupabase({ savings_goals: [{ data: null, error: { message: "database unavailable" } }] });
    await expect(actions.createSavingsGoal(null, goalForm())).resolves.toMatchObject({
      status: "error",
      formError: expect.stringContaining("goal"),
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("updates a goal only inside the authenticated household and permits overfunding", async () => {
    const queries = configureSupabase({ savings_goals: [{ data: { id: goalId }, error: null }] });
    await expect(actions.updateSavingsGoal(goalId, null, goalForm({ targetAmount: "100", savedAmount: "150" }))).resolves.toEqual({
      status: "success",
    });
    expect(queries[0].chain.update).toHaveBeenCalledWith({
      name: "Emergency fund",
      target_amount: 100,
      saved_amount: 150,
      target_date: "2026-12-31",
    });
    expect(queries[0].chain.eq).toHaveBeenCalledWith("id", goalId);
    expect(queries[0].chain.eq).toHaveBeenCalledWith("household_id", householdId);
    expect(mocks.revalidatePath.mock.calls).toEqual([["/budgets-goals"], ["/"]]);
  });

  it("allows updating an overdue goal when its past deadline is unchanged", async () => {
    const queries = configureSupabase({
      savings_goals: [
        { data: { id: goalId, target_date: "2020-01-01" }, error: null },
        { data: { id: goalId }, error: null },
      ],
    });

    await expect(
      actions.updateSavingsGoal(goalId, null, goalForm({ name: "Updated emergency fund", savedAmount: "200", targetDate: "2020-01-01" })),
    ).resolves.toEqual({ status: "success" });
    expect(queries[1].chain.update).toHaveBeenCalledWith({
      name: "Updated emergency fund",
      target_amount: 5000,
      saved_amount: 200,
      target_date: "2020-01-01",
    });
  });

  it("rejects an update date before today and treats missing or cross-household goals as errors", async () => {
    configureSupabase({ savings_goals: [{ data: { id: goalId, target_date: "2020-01-01" }, error: null }] });
    await expect(actions.updateSavingsGoal(goalId, null, goalForm({ targetDate: "2020-02-01" }))).resolves.toMatchObject({
      status: "error",
      fieldErrors: { targetDate: "Choose today or a future date." },
    });
    expect(mocks.requireCurrentHousehold).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledOnce();

    vi.resetAllMocks();
    mocks.requireCurrentHousehold.mockResolvedValue({ householdId, supabase: { from: mocks.from } });
    configureSupabase({ savings_goals: [{ data: null, error: null }] });
    await expect(actions.updateSavingsGoal(goalId, null, goalForm())).resolves.toMatchObject({ status: "error" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("deletes a goal by id and household and revalidates only the two goal routes", async () => {
    const queries = configureSupabase({ savings_goals: [{ data: { id: goalId }, error: null }] });
    await expect(actions.deleteSavingsGoal(goalId, null, new FormData())).resolves.toEqual({ status: "success" });
    expect(queries[0].chain.delete).toHaveBeenCalled();
    expect(queries[0].chain.eq).toHaveBeenCalledWith("id", goalId);
    expect(queries[0].chain.eq).toHaveBeenCalledWith("household_id", householdId);
    expect(mocks.revalidatePath.mock.calls).toEqual([["/budgets-goals"], ["/"]]);
  });

  it("treats delete errors and zero-row results as failures", async () => {
    configureSupabase({ savings_goals: [{ data: null, error: { message: "database unavailable" } }] });
    await expect(actions.deleteSavingsGoal(goalId, null, new FormData())).resolves.toMatchObject({ status: "error" });

    vi.resetAllMocks();
    mocks.requireCurrentHousehold.mockResolvedValue({ householdId, supabase: { from: mocks.from } });
    configureSupabase({ savings_goals: [{ data: null, error: null }] });
    await expect(actions.deleteSavingsGoal(goalId, null, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
