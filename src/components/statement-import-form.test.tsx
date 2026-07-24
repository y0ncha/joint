import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  action: undefined as undefined | ((previousState: unknown, formData: FormData) => unknown),
  fileChange: undefined as undefined | ((event: { target: { files?: File[] } }) => void),
  importStatement: vi.fn(),
  pending: false,
  result: null as unknown,
  state: [] as unknown[],
  stateIndex: 0,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    useActionState: (action: (previousState: unknown, formData: FormData) => unknown, initialState: unknown) => {
      mocks.action = action;
      return [mocks.result ?? initialState, () => {}, mocks.pending];
    },
    useState: (initialState: unknown | (() => unknown)) => {
      const index = mocks.stateIndex++;
      if (!(index in mocks.state)) mocks.state[index] = typeof initialState === "function" ? initialState() : initialState;
      return [mocks.state[index], (nextState: unknown | ((current: unknown) => unknown)) => {
        mocks.state[index] = typeof nextState === "function" ? nextState(mocks.state[index]) : nextState;
      }];
    },
  };
});

vi.mock("@/app/actions/statement-import", () => ({ importStatement: mocks.importStatement }));
vi.mock("@/components/ui/input", () => ({
  Input: ({ onChange, ...props }: { onChange?: (event: { target: { files?: File[] } }) => void; name?: string }) => {
    if (props.name === "statement") mocks.fileChange = onChange;
    return <input {...props} />;
  },
}));

import { StatementImportForm } from "./statement-import-form";

function renderForm() {
  mocks.stateIndex = 0;
  return renderToStaticMarkup(<StatementImportForm />);
}

beforeEach(() => {
  mocks.action = undefined;
  mocks.fileChange = undefined;
  mocks.importStatement.mockReset();
  mocks.pending = false;
  mocks.result = null;
  mocks.state = [];
  mocks.stateIndex = 0;
});

it("renders a statement file input that preserves XLSX support", () => {
  const markup = renderForm();

  expect(markup).toContain("Drop your file here");
  expect(markup).toContain("Tap to browse · CSV or XLSX");
  expect(markup).toContain('type="file"');
  expect(markup).toContain('name="statement"');
  expect(markup).toContain('accept=".csv,.xlsx"');
  expect(markup).toContain("Process file");
});

it("shows selected-file, pending, live-region, and action-result feedback", async () => {
  renderForm();
  mocks.fileChange?.({ target: { files: [{ name: "july.csv" } as File] } });

  const selectedMarkup = renderForm();
  expect(selectedMarkup).toContain("Selected: july.csv");
  expect(selectedMarkup).toContain("Tap to change file");

  mocks.pending = true;
  const pendingMarkup = renderForm();
  expect(pendingMarkup).toContain('aria-busy="true"');
  expect(pendingMarkup).toContain("Processing file…");
  expect(pendingMarkup).toContain("Processing…");

  const result = { status: "success", data: { importedRowCount: 2 } };
  mocks.importStatement.mockResolvedValue(result);
  await expect(mocks.action?.(null, new FormData())).resolves.toEqual(result);
  expect(mocks.importStatement).toHaveBeenCalledWith(null, expect.any(FormData));

  mocks.pending = false;
  mocks.result = result;
  const successMarkup = renderForm();

  expect(successMarkup).toContain('aria-live="polite"');
  expect(successMarkup).toContain("2 transactions added.");
});
