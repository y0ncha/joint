# Brand Mark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the temporary letter marks with one reusable logo component and accessible hover/focus attribution.

**Architecture:** A presentational server component statically imports the supplied PNG into Next.js `Image` and wraps it with the required attribution link. Dashboard and login pages consume it at their existing visual footprints; their render tests assert the logo and credit are retained.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS v4, Vitest, Bun.

## Global Constraints

- Use `public/brand/joint-logo.png` exactly; preserve its black background and white `J`.
- Keep attribution hidden until hover or keyboard focus, while retaining keyboard and screen-reader access.
- Do not change dashboard/login copy, routing, data, or layout outside the former letter-mark elements.
- Use semantic tokens and no new dependency.

---

### Task 1: Add and verify the shared BrandMark component

**Files:**
- Create: `src/components/brand-mark.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/login/page.test.tsx`

**Interfaces:**
- Produces: `BrandMark({ size }: { size: 44 | 48 }): JSX.Element`.
- Consumes: the public `/brand/joint-logo.png` path, which Next.js serves directly.

- [x] **Step 1: Write the failing render assertions**

```tsx
expect(markup).toContain('alt="Joint logo"');
expect(markup).toContain('Abc letters icons created by Md Tanvirul Haque - Flaticon');
```

- [x] **Step 2: Run focused tests to verify they fail**

Run: `bun run test -- src/app/page.test.tsx src/app/login/page.test.tsx`

Expected: FAIL because neither page renders the image or attribution.

- [x] **Step 3: Create the minimal component**

```tsx
import Image from 'next/image';
const logo = '/brand/joint-logo.png';

export function BrandMark({ size }: { size: 44 | 48 }) {
  return (
    <div className="group relative shrink-0">
      <Image alt="Joint logo" className="rounded-2xl" height={size} priority src={logo} width={size} />
      <a className="sr-only min-h-11 focus:not-sr-only group-hover:not-sr-only" href="https://www.flaticon.com/free-icons/abc-letters" title="abc letters icons">
        Abc letters icons created by Md Tanvirul Haque - Flaticon
      </a>
    </div>
  );
}
```

- [x] **Step 4: Run focused tests to verify they pass**

Run: `bun run test -- src/app/page.test.tsx src/app/login/page.test.tsx`

Expected: PASS, two test files with no failures.

### Task 2: Consume the component in both brand locations

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `BrandMark` from `@/components/brand-mark`.

- [x] **Step 1: Replace the dashboard’s text mark**

```tsx
import { BrandMark } from '@/components/brand-mark';

<BrandMark size={44} />
```

- [x] **Step 2: Replace the sign-in page’s text mark**

```tsx
import { BrandMark } from '@/components/brand-mark';

<BrandMark size={48} />
```

- [x] **Step 3: Run complete validation**

Run: `bun run lint && bun run test`

Expected: lint exits 0 and all Vitest tests pass.

- [x] **Step 4: Inspect the final diff**

Run: `rtk diff -- src/components/brand-mark.tsx src/app/page.tsx src/app/login/page.tsx src/app/page.test.tsx src/app/login/page.test.tsx`

Expected: only the shared mark, its two consumers, and targeted render assertions changed.
