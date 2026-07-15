import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("development origins", () => {
  it("allows the local 127.0.0.1 preview origin", () => {
    expect(nextConfig.allowedDevOrigins).toContain("127.0.0.1");
  });
});
