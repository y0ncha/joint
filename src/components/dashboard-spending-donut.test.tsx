import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { DashboardSpendingDonut } from "./dashboard-spending-donut";

it("gives duplicate source IDs distinct React keys", () => {
  const donut = DashboardSpendingDonut({
    ariaLabel: "Spending breakdown",
    total: "₪300",
    segments: [
      { id: "category", label: "Food: ₪100", color: "red", value: 100 },
      { id: "category", label: "Market: ₪200", color: "blue", value: 200 },
    ],
  });
  const svg = donut.props.children.props.children[0];

  expect(new Set(svg.props.children.map((child: { key: string }) => child.key)).size).toBe(2);
});

it("keeps donut sections non-focusable at a responsive card-filling size", () => {
  const markup = renderToStaticMarkup(
    <DashboardSpendingDonut
      ariaLabel="Spending breakdown"
      total="₪300"
      segments={[
        { id: "food", label: "Food: ₪100", color: "red", value: 100 },
        { id: "market", label: "Market: ₪200", color: "blue", value: 200 },
      ]}
    />,
  );

  expect(markup).not.toContain("tabindex");
  expect(markup).toContain("w-full");
  expect(markup).toContain("lg:w-[min(100cqw,100cqh)]");
  expect(markup).not.toContain("max-w-xl");
  expect(markup).not.toContain("w-56");
  expect(markup).toContain("sm:text-5xl");
  expect(markup).toContain("M 100 4");
});

it("renders a single numeric segment as a full donut ring", () => {
  const markup = renderToStaticMarkup(
    <DashboardSpendingDonut
      ariaLabel="Spending breakdown"
      total="₪100"
      segments={[{ id: "food", label: "Food: ₪100", color: "red", value: 100 }]}
    />,
  );

  expect(markup).toContain('aria-label="Food: ₪100"');
  expect(markup).toContain('<circle cx="100" cy="100"');
});
