# Brand mark

## Scope

Replace the temporary text `J` marks with the supplied `public/brand/joint-logo.png` asset in the dashboard rail and sign-in card.

## Component

Create a server-compatible `BrandMark` component. It renders the 512px source image through Next.js `Image`, constrained to the existing 44px dashboard and 48px sign-in footprints, with descriptive alternative text.

The component owns the Flaticon attribution link. The link is hidden by default and becomes visible when the mark or link is hovered or receives keyboard focus. It remains accessible to keyboard and assistive-technology users and opens in the current tab.

## Integration

Use `BrandMark` in the existing dashboard rail and sign-in card. Do not alter the dashboard header text, login copy, canvas, or existing layout spacing beyond replacing the former letter-mark elements.

## Validation

Update the dashboard and sign-in render tests to confirm the logo asset and attribution link are present. Run lint and the focused test suite.
