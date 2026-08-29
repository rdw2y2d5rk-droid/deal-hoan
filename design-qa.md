# Design QA — Flash sale

Source visual truth: `/var/folders/sj/jwhymxt53b11fm81tn5k24rw0000gn/T/codex-clipboard-82646322-bcc6-449f-aafa-548aeb7c383b.png`  
Implementation reference supplied: `/var/folders/sj/jwhymxt53b11fm81tn5k24rw0000gn/T/codex-clipboard-2eace8eb-d8d0-4835-bc61-7ff358fbeabf.png`  
Source pixels: 2728 × 746. Implementation-reference pixels: 2688 × 754.  
State: desktop flash-sale section, default countdown state.

## Comparison history

1. **P1 — Flash-sale frame was nested incorrectly.** The implementation-reference image showed a white gutter between the card border and orange header, unlike the source where the orange header meets the card edge. Fixed by restoring the source structure: an outer padded section (`.flash-section`) and inner bordered card (`.flash`).
2. **P2 — Weight hierarchy was too weak.** The original uses an 800-weight Archivo headline and 600-weight product labels. Added the matching font weights, 13px label size, 1.35 line-height and 35px minimum label height.
3. **P2 — Flash-sale content differed from the reference export.** Replaced generic entries with the five exact products, prices, old prices, percentages, cashback values and image labels from the HTML.

## Required fidelity surfaces

- **Fonts and typography:** Code now explicitly maps the source's headline and product-label weights. Runtime font loading still requires browser capture to verify the actual rendered font rather than a fallback.
- **Spacing and layout rhythm:** The card frame, header padding, five-column grid, 18px card padding and label height match the supplied HTML rules.
- **Colors and tokens:** Source orange gradient, white/peach timer states, green cashback and grey placeholder tokens are retained.
- **Image quality and assets:** Both source HTML and implementation deliberately use the same textual striped placeholders; no product imagery is implied by the source.
- **Copy and content:** The flash-sale labels and values now match the source export.

## Open questions

The in-app Browser cannot reach the local development server (`http://localhost:3001`, `ERR_CONNECTION_REFUSED`) from its isolated runtime. Therefore it could not produce a browser-rendered post-fix screenshot at the matching viewport, inspect console errors, or perform a final combined visual comparison.

## Implementation checklist

- [x] Restore the source card frame and spacing structure.
- [x] Match flash-sale typography and content data.
- [x] Run lint and production build.
- [ ] Capture the running page from a browser that can access the local server and compare it against the source image.

final result: blocked
