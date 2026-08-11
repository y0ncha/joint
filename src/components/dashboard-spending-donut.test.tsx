import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { DashboardSpendingDonut } from "./dashboard-spending-donut";

it("gives duplicate source IDs distinct React keys", () => {
  const donut = DashboardSpendingDonut({
    ariaLabel: "Spending breakdown",
    total: "₪300",
    segments: [
      { id: "category", label: "Food: ₪100", color: "red", path: "M 0 0" },
      { id: "category", label: "Market: ₪200", color: "blue", path: "M 0 0" },
    ],
  });
  const svg = donut.props.children.props.children[0];

  expect(new Set(svg.props.children.map((child: { key: string }) => child.key)).size).toBe(2);
});

it("keeps donut sections non-focusable", () => {
  const markup = renderToStaticMarkup(
    <DashboardSpendingDonut
      ariaLabel="Spending breakdown"
      total="₪300"
      segments={[
        { id: "food", label: "Food: ₪100", color: "red", path: "M 0 0" },
        { id: "market", label: "Market: ₪200", color: "blue", path: "M 0 0" },
      ]}
    />,
  );

  expect(markup).not.toContain("tabindex");
});
