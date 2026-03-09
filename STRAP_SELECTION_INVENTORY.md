# Strap Selection Inventory

Canonical website assets live in `/Users/sakaarpuri/Pictures/Watchsrap app/public/strap-selection-kie`.

## Website-ready pairs

| Label | Category | Buckle source | Tail source | Notes |
| --- | --- | --- | --- | --- |
| Black Grain Leather | Leather | `48669` | `18367` | Primary black pebbled leather set |
| Dark Brown Smooth Leather | Leather | `09327` | `15607` | Primary dark brown smooth leather set |
| Cognac Grain Leather | Leather | `90611` | `63755` | Warm brown pebbled leather |
| Sand Suede Leather | Leather | `53792` | `71481` | Neutral suede |
| Tan Suede Leather | Leather | `05453` | `71481` | Alternate warmer suede; reuses the sand suede tail |
| Beige Suede Leather | Leather | `generated-fresh` | `generated-fresh` | New full design generated from scratch via Kie |
| Burgundy Pebbled Leather | Leather | `generated-fresh` | `generated-fresh` | New full design generated from scratch via Kie |
| Grey Canvas | Fabric | `15785` | `50859` | Canvas two-piece |
| Navy Canvas | Fabric | `20630` | `69065` | Blue fabric two-piece |
| Olive NATO | Fabric | `61001` | `94121` | Olive woven/NATO style |
| Black Rubber | Rubber | `56022` | `47482` | Base rubber option |
| Black Performance Rubber | Rubber | `53765` | `47482` | More tapered performance-style buckle half; reuses the black rubber tail |
| Olive Performance Rubber | Rubber | `generated-fresh` | `generated-fresh` | New full design generated from scratch via Kie |
| Steel Link Bracelet | Metal | `84595` | `90437` | Silver metal bracelet |
| Black PVD Bracelet | Metal | `generated-fresh` | `generated-fresh` | New full design generated from scratch via Kie |

## Holdbacks and partials

| Raw file suffix | Suggested label | Status | Notes |
| --- | --- | --- | --- |
| `06699` | Black PVD Bracelet Tail | Partial | Tail only. Needs matching buckle half before website use. |
| `49159` | Steel Bracelet Tail Alt | Partial | Tail only. Could pair with a future silver metal buckle. |
| `72319` | Olive Rubber Tail | Partial | Tail only. Needs matching buckle half. |
| `23355` | Black Pebbled Leather Buckle Alt | Duplicate/hold | Usable buckle, but too close to the existing black grain leather family to add cleanly right now. |
| `23589` | Black Slim Tail | Partial | Tail only. Shape does not cleanly match current black leather buckle assets. |
| `42014` | Black Classic Tail | Partial | Tail only. Shape/material mismatch against existing black leather buckle options. |
| `00509` | Dark Brown + Black Composite | Composite | Mixed buckle+tail render in one file. Not suitable as a canonical library source. |
| `56730` | Dark Brown Smooth Tail Alt | Duplicate/hold | Tail only. Existing dark brown smooth pair is already stronger and consistent. |

## Naming rule

- Website IDs should stay material-first and customer-readable.
- Source labels should keep the raw suffix for traceability during QA.
- Do not add partials to `/lib/strapLibrary.ts` until both halves are available and visually matched.

## Current counts

- Real full straps currently wired into the website library: `15`
- Placeholder/demo straps still present for MVP continuity: `4`
- Total options visible in the selector including placeholders: `19`
