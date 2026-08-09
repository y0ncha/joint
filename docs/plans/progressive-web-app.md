---
goal: Make Joint installable as a minimal progressive web app without caching authenticated financial data
version: 1.0
date_created: 2026-08-09
last_updated: 2026-08-09
owner: Joint
status: Planned
tags: [feature, pwa, nextjs, vercel]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan adds the native Next.js manifest and install icons required to install Joint from an HTTPS deployment while preserving its existing online-only authenticated runtime.

## 1. Requirements & Constraints

- **REQ-001**: Joint MUST expose a valid App Router web app manifest that makes the deployed application installable with the product name, existing description, standalone display mode, root start URL, and current warm canvas color.
- **REQ-002**: `src/app/manifest.ts` MUST return `name: "Joint"`, `short_name: "Joint"`, `description: "A shared household money workspace."`, `start_url: "/"`, `display: "standalone"`, `background_color: "#f6d4b8"`, `theme_color: "#f6d4b8"`, and 192px and 512px PNG icon entries.
- **REQ-003**: The committed 192px, 512px, and 180px Apple install icons MUST be derived from `public/brand/favicon.png`, preserve the approved Joint mark, and have intrinsic square dimensions matching their declared sizes.
- **REQ-004**: The existing `appleWebApp.capable`, `appleWebApp.statusBarStyle`, `themeColor`, and `viewportFit` values in `src/app/layout.tsx` MUST remain unchanged.
- **REQ-005**: Installation MUST use browser-native controls; no in-app install button, banner, prompt, settings row, or permission request is permitted.
- **SEC-001**: Do not add a service worker, offline cache, background sync, or client-side persistence of authenticated pages, Supabase responses, or household financial data.
- **SEC-002**: Do not add push notifications, notification subscriptions, VAPID keys, notification permissions, or notification UI.
- **CON-001**: Use Next.js `MetadataRoute.Manifest` and metadata file conventions already available in `next@16.2.10`; do not add a package, Vercel Marketplace integration, build plugin, or custom manifest route.
- **CON-002**: Treat Vercel-provided HTTPS as the hosted installation transport; do not change deployment workflows, Vercel project settings, environment variables, or hosted state.
- **CON-003**: Keep `start_url` at `/` so the existing protected route and Supabase session flow continue to decide whether an installed launch renders the workspace or redirects to login.
- **CON-004**: Do not change database schema, RLS, authentication, financial behavior, product navigation, or visible page layout.
- **GUD-001**: Update the design and application-runtime contracts before adding the manifest or image assets.
- **PAT-001**: Add a focused failing manifest test before implementation, then make it pass with the minimum native Next.js files.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Define the online-only installation contract and executable manifest acceptance test.

| Task     | Description                                                                                                                                                                                                                                                                                           | Status  | Date |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-001 | Update `docs/design.md` with an installable-app section that requires browser-native installation, standalone presentation, the existing Joint mark and warm canvas, and no custom install or notification UI; verify the text preserves the current responsive and accessibility contracts.          | Complete | 2026-08-09 |
| TASK-002 | Update `docs/architecture/application-runtime.md` to identify `src/app/manifest.ts` and committed icons as static installation metadata and to prohibit service-worker caching of authenticated or financial responses; verify the browser, Next.js, Supabase, and RLS boundaries remain unchanged.   | Complete | 2026-08-09 |
| TASK-003 | Add `src/app/manifest.test.ts` that imports `manifest`, asserts the exact REQ-002 object and icon declarations, and checks that every declared icon path resolves to a committed file; run the focused test and require failure because `src/app/manifest.ts` and the install icons do not yet exist. | Complete | 2026-08-09 |

### Implementation Phase 2

- **GOAL-002**: Add the minimum native Next.js installation metadata and approved icon assets after GOAL-001 completes.

| Task     | Description                                                                                                                                                                                                                                                                                                           | Status  | Date |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-004 | Add `src/app/manifest.ts` exporting `manifest(): MetadataRoute.Manifest` with the exact REQ-002 values and `/brand/pwa-192.png` and `/brand/pwa-512.png` icon entries; verify `src/app/manifest.test.ts` advances past the manifest assertion and fails only because the TASK-005 icon files do not yet exist, without changing `next.config.ts`. | Complete | 2026-08-09 |
| TASK-005 | Generate `public/brand/pwa-192.png`, `public/brand/pwa-512.png`, and `src/app/apple-icon.png` at 192x192, 512x512, and 180x180 respectively from `public/brand/favicon.png`; verify intrinsic dimensions with `sips -g pixelWidth -g pixelHeight` and visually confirm the Joint mark remains centered and unclipped; then require `src/app/manifest.test.ts` to pass. | Complete | 2026-08-09 |

### Implementation Phase 3

- **GOAL-003**: Prove install metadata, browser behavior, and regression boundaries after GOAL-002 completes.

| Task     | Description                                                                                                                                                                                                                                                                 | Status  | Date |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-006 | Run `bun run test src/app/manifest.test.ts src/app/layout.test.tsx` and require the manifest contract, icon existence, Apple web-app metadata, theme color, and viewport-fit assertions to pass.                                                                            | Complete | 2026-08-09 |
| TASK-007 | Run Joint locally with `bun run dev`, inspect `/manifest.webmanifest` in a Chromium browser, and verify the name, standalone display, colors, 192px and 512px icons, native install eligibility, installed launch through `/`, and absence of a controlling service worker. | Blocked | 2026-08-09 |
| TASK-008 | Run `bun run lint`, `bun run test`, `bun run format:check`, and `git diff --check`; require all checks to pass and confirm `package.json`, `bun.lock`, `next.config.ts`, Supabase files, deployment files, and application UI remain unchanged.                             | Planned |      |
| TASK-009 | Review the final diff against REQ-001 through REQ-005, SEC-001 through SEC-002, and CON-001 through CON-004; report local evidence and the remaining need for installation proof on an authorized HTTPS deployment without pushing, deploying, or changing hosted state.    | Planned |      |

## 3. Alternatives

### Verification note (2026-08-09)

TASK-007 remains blocked: the available in-app browser rejected the local manifest URL with `ERR_BLOCKED_BY_CLIENT` before it loaded. The focused tests prove the manifest contract and committed icons, but browser-native install eligibility, installed launch, and controlling-service-worker state still need verification in an accessible Chromium session or on an authorized HTTPS deployment.

- **ALT-001**: Add Serwist, `next-pwa`, or another service-worker package. Rejected because installation does not require offline support and authenticated financial caching adds dependency, invalidation, privacy, and stale-data risk.
- **ALT-002**: Install the third-party Vercel PWA Marketplace integration. Rejected because native App Router manifest support covers the approved scope without a paid integration or external configuration.
- **ALT-003**: Add a custom `beforeinstallprompt` button or banner. Rejected because the API is not cross-browser and the official Next.js guidance recommends browser-native installation controls.
- **ALT-004**: Add push notifications while creating the PWA. Rejected because notifications are outside the approved product contract and require persistence, permissions, secrets, service-worker behavior, and security review.

## 4. Dependencies

- **DEP-001**: `next@16.2.10` and its built-in `MetadataRoute.Manifest` and metadata file conventions.
- **DEP-002**: Existing approved source artwork in `public/brand/favicon.png`.
- **DEP-003**: Existing `src/app/layout.tsx` Apple web-app metadata and warm `#f6d4b8` viewport theme color.
- **DEP-004**: HTTPS supplied by the existing Vercel deployment path for hosted browser installation.

## 5. Files

- **FILE-001**: `docs/plans/progressive-web-app.md` — source implementation plan and delivery status.
- **FILE-002**: `docs/design.md` — browser-native installation and standalone visual contract.
- **FILE-003**: `docs/architecture/application-runtime.md` — online-only runtime and no-service-worker security boundary.
- **FILE-004**: `src/app/manifest.ts` — native typed web app manifest.
- **FILE-005**: `src/app/manifest.test.ts` — exact manifest and committed-icon regression coverage.
- **FILE-006**: `public/brand/pwa-192.png` — 192px manifest icon.
- **FILE-007**: `public/brand/pwa-512.png` — 512px manifest icon.
- **FILE-008**: `src/app/apple-icon.png` — 180px Apple home-screen icon discovered through Next.js metadata conventions.

## 6. Testing

- **TEST-001**: The focused manifest test fails before `src/app/manifest.ts` and the install icons exist and passes after their addition.
- **TEST-002**: The existing root-layout test proves Apple web-app metadata, theme color, and viewport fit remain unchanged.
- **TEST-003**: `sips` reports exact 192x192, 512x512, and 180x180 intrinsic PNG dimensions and visual inspection shows no clipping.
- **TEST-004**: Chromium loads `/manifest.webmanifest`, reports native install eligibility, uses the declared icons and standalone display, launches through `/`, and has no controlling service worker.
- **TEST-005**: Project lint, full Vitest, Prettier check, and Git whitespace validation pass with no package, deployment, Supabase, or UI change.

## 7. Risks & Assumptions

- **RISK-001**: Browser installation UI and platform-specific icon treatment vary; local Chromium proof does not replace a final check on an authorized HTTPS deployment.
- **RISK-002**: A service worker added later could cache authenticated or financial responses incorrectly; any offline proposal requires a separate approved threat model and explicit cache policy.
- **ASSUMPTION-001**: “Implement PWA” means make Joint installable with a standalone app identity, not add offline operation, push notifications, background sync, or a custom installation experience.
- **ASSUMPTION-002**: The existing Vercel deployment path continues to provide HTTPS and does not require PWA-specific platform configuration.

## 8. Related Specifications / Further Reading

- [Joint design contract](../design.md)
- [Joint application runtime](../architecture/application-runtime.md)
- [Next.js progressive web app guide](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Next.js manifest file convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
