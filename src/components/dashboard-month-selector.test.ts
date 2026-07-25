import { describe, expect, it } from "vitest";

import { buildDashboardMonthPath, formatDashboardMonth, getDashboardMonthOptions } from "./dashboard-month-selector";

describe("dashboard month selector helpers", () => {
  it("lists active months newest first and retains the current and directly selected inactive months", () => {
    expect(getDashboardMonthOptions(["2026-07-14", "2026-05-01", "2026-07-02"], "2026-08", "2026-06")).toEqual([
      "2026-08",
      "2026-07",
      "2026-06",
      "2026-05",
    ]);
  });

  it("builds the dashboard path for a selected month", () => {
    expect(buildDashboardMonthPath("2026-05")).toBe("/?month=2026-05");
  });

  it("formats options as month and year", () => {
    expect(formatDashboardMonth("2026-07")).toBe("Jul 2026");
  });
});
