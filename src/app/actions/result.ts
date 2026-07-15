export type ActionResult =
  | { status: "success"; data?: Record<string, string> }
  | { status: "error"; formError: string; fieldErrors: Record<string, string> };

export function validationError(issues: Array<{ path: PropertyKey[]; message: string }>): ActionResult {
  return { status: "error", formError: "Check the form details.", fieldErrors: Object.fromEntries(issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])) };
}
