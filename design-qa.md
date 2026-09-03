# Responsive design QA

## Comparison target

- Source visual truth: `/Users/wei/Downloads/Nâng cấp giao diện V4 hoàn tiền/Deal Hoan - Homepage v4.dc.html` (desktop visual language, typography, surfaces, and hierarchy).
- Implementation evidence: browser-rendered `http://localhost:3000/` in the in-app browser. Captures were inspected at desktop (1440 × 1000), laptop (1024 × 900), tablet (768 × 1024), and mobile (390 × 844), at device scale factor 2.
- Key state: homepage default state; mobile calculator submitted with a Lazada URL; mobile purchase-confirmation modal opened.

## Full-view comparison evidence

The desktop composition keeps the V4 hierarchy: utility strip, sticky header, hero calculator, supported-platform row, flash sale, deals, coupons, explanation, referral, and footer. Mobile and tablet use the same information order and visual tokens rather than a separate design.

## Focused responsive evidence

- At 390px, horizontal page overflow is false. The utility bar has one centered referral action; the calculator, platform chips, live ticker, stats, and result receipt fit within the 358px content column.
- At 768px, the platform cards use a balanced two-column grid, with Lazada spanning the final row; horizontal page overflow is false.
- At 1024px, primary navigation collapses before it crowds the header; search and sign-in retain comfortable tap targets; horizontal page overflow is false.
- At 1440px, full navigation and the five-card flash layout remain visible; horizontal page overflow is false.
- The submitted mobile receipt is constrained to its parent, with the product title clamped to two lines and the price summary reflowing within the card. The mobile modal stays inside its safe viewport height and scrolls internally.

## Required fidelity surfaces

- Fonts and typography: Archivo remains the display face; Be Vietnam Pro remains the UI/body face. Mobile title scales from 34px to 38px without changing hierarchy. Small labels and price text remain legible.
- Spacing and layout rhythm: horizontal gutters reduce from 24px to 16px on phone; card grids reflow at tablet and mobile widths without collision.
- Colors and visual tokens: orange CTA, green cashback states, light-gray borders, peach hero background, and dark utility/referral surfaces are unchanged across breakpoints.
- Image quality and assets: product images preserve `object-fit: cover`; the responsive work does not replace or alter image sources. Lazada’s existing SVG mark stays rendered in both supported-platform locations.
- Copy and content: all V4 sections remain present; flash items are available through horizontal scrolling instead of being removed on small screens.

## Findings and fixes

- [P1 fixed] Mobile receipt exceeded the calculator column after submit.
  - Fix: constrained the result grid/card, corrected flex min-width behavior, clamped the product title, and stacked the green actual-cost summary at small widths.
- [P2 fixed] Laptop navigation became cramped around 1024px.
  - Fix: introduced a dedicated 1100px navigation breakpoint so search and sign-in stay usable.
- [P2 fixed] Tablet platform cards consumed too much vertical space and mobile utility links wrapped awkwardly.
  - Fix: tablet uses a two-column platform grid; mobile shows the single referral action. Platform chips and live ticker now scale to the available width.
- [P2 fixed] Flash deals were hidden at narrow widths.
  - Fix: all cards remain available in a snap-scrolling horizontal rail.

## Follow-up polish

- [P3] The long mobile purchase-confirmation modal uses internal scrolling so its confirmation controls remain reachable without increasing viewport overflow.

final result: passed
