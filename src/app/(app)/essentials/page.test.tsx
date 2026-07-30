import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import EssentialsPage from "./page";

vi.mock("@/components/essentials-dashboard", () => ({
  EssentialsDashboard: () => <output>dashboard</output>,
}));

vi.mock("@/components/workspace-shell", () => ({
  WorkspaceShell: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));

it("renders the chart dashboard in the normal Essentials workspace", () => {
  const markup = renderToStaticMarkup(<EssentialsPage />);

  expect(markup).toContain("<h1>Essentials</h1>");
  expect(markup).toContain("dashboard");
  expect(markup).not.toContain("true");
});
