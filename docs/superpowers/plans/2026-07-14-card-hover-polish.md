# Card Hover Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every shared Card rest naturally on Joint's translucent canvas and respond to hover with a smooth, subtle lift and deeper soft shadow.

**Architecture:** Keep the treatment in the owned shadcn `Card` root component, which already supplies every dashboard card. Remove the accent ring from the hover state and replace the generic `shadow-lg` with a restrained shadow that matches the existing green-gray translucent palette. Preserve the current reduced-motion behavior.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS v4, shadcn/ui, Bun, ESLint.

## Global Constraints

- Modify `src/components/ui/card.tsx` and remove dashboard-local card shadows from `src/app/page.tsx`.
- Use a 1px hover lift (`hover:-translate-y-px`).
- Keep a 700ms `ease-in-out` transition for transform and shadow.
- Remove the hover accent ring entirely.
- Keep `motion-reduce:transform-none` and `motion-reduce:transition-none`.
- Use Bun through `/Users/yonatan/.bun/bin/bun` because the automation shell does not inherit the user's Bun path.

---

### Task 1: Refine the shared Card elevation treatment

**Files:**
- Modify: `src/components/ui/card.tsx:16`
- Modify: `src/app/page.tsx:94,110,118,126,141,151`

**Interfaces:**
- Consumes: Tailwind utility classes and the existing `Card` `className` merge through `cn`.
- Produces: A consistent rest and hover elevation treatment for every rendered `Card`.

- [ ] **Step 1: Replace the generic shadow interaction**

In the `Card` root class string, replace:

```tsx
"ring-1 ring-foreground/10 transition-[transform,box-shadow,ring-color] duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-lg hover:ring-primary/20 motion-reduce:transform-none motion-reduce:transition-none"
```

with:

```tsx
"ring-1 ring-foreground/10 shadow-[0_8px_22px_-10px] shadow-foreground/10 transition-[transform,box-shadow] duration-700 ease-in-out hover:-translate-y-px hover:shadow-[0_12px_28px_-12px] hover:shadow-foreground/[0.12] motion-reduce:transform-none motion-reduce:transition-none"
```

This intentionally removes `hover:ring-primary/20` and uses the semantic foreground token for a single low-contrast elevation scale. Remove each `shadow-[0_14px_30px_rgba(36,62,54,0.08)]` class from the dashboard `Card` calls so this shared treatment is not overridden.

- [ ] **Step 2: Run the linter**

Run:

```bash
/Users/yonatan/.bun/bin/bun run lint
```

Expected: the command exits with status 0 and prints `$ eslint` without lint errors.

- [ ] **Step 3: Verify the live dashboard**

Open `http://127.0.0.1:3000/`, move the pointer over each dashboard card, then move it away.

Expected: every card starts with a quiet soft shadow, rises by 2px with a slightly deeper diffuse shadow during hover, returns smoothly on pointer exit, and shows no accent-colored outline.

- [ ] **Step 4: Commit when the repository has an initial project commit**

Do not create a partial root commit: the current branch has no commits and the full project is untracked. Once the project files are committed, stage only `src/components/ui/card.tsx` and the two design documents, then commit with:

```bash
git add src/components/ui/card.tsx docs/superpowers/specs/2026-07-14-card-hover-polish-design.md docs/superpowers/plans/2026-07-14-card-hover-polish.md
git commit -m "style: polish card elevation"
```
