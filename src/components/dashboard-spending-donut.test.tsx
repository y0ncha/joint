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
  expect(markup).toContain("w-56");
  expect(markup).toContain("md:h-full");
  expect(markup).toContain("md:w-auto");
  expect(markup).toContain("md:max-w-full");
  expect(markup).not.toContain("container-type:size");
  expect(markup).toContain("sm:text-5xl");
  expect(markup).toContain("M 100 4");
});

it("animates new donut sections unless reduced motion is requested", () => {
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

  expect(markup).toContain("motion-safe:animate-in");
  expect(markup).toContain("motion-safe:fade-in-0");
  expect(markup).toContain("motion-reduce:animate-none");
});

it("uses the light chart-tooltip surface", () => {
  const donut = DashboardSpendingDonut({
    ariaLabel: "Spending breakdown",
    total: "₪100",
    segments: [{ id: "food", label: "Food: ₪100", color: "red", value: 100 }],
  });
  const tooltipContent = donut.props.children.props.children[0].props.children.props.children[1];

  expect(tooltipContent.props.className).toContain("bg-popover");
  expect(tooltipContent.props.className).toContain("text-popover-foreground");
  expect(tooltipContent.props.arrowClassName).toContain("fill-popover");
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
