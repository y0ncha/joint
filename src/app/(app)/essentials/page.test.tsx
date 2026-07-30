import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import EssentialsPage from "./page";

vi.mock("@/components/essentials-dashboard", () => ({
  EssentialsDashboard: (props: { onExpandedChange?: unknown }) => <output>{String("onExpandedChange" in props)}</output>,
}));

vi.mock("@/components/workspace-shell", () => ({
  WorkspaceShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

it("lets chart expansion make the workspace immersive", () => {
  expect(renderToStaticMarkup(<EssentialsPage />)).toContain("true");
});
