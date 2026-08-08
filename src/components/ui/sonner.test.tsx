import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));

vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => {
    mocks.props = props;
    return <div />;
  },
}));

const { Toaster } = await import("./sonner");

it("keeps a stable container while allowing each toast to fit its message", () => {
  renderToStaticMarkup(<Toaster />);

  expect(mocks.props?.style).toMatchObject({ "--width": "min(22rem, calc(100vw - 2rem))" });
  expect((mocks.props?.toastOptions as { classNames: { toast: string } }).classNames.toast).toContain("!w-max");
});
