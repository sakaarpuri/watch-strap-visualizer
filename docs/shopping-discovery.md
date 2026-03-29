# Shopping Discovery

This project now has a hybrid shopping-retrieval backend behind the existing
`/api/products/similar` route.

## How it works

1. The active library strap provides a normalized seed from
   `/tmp/watchstrap-serp-hybrid/lib/strapLibrary.ts`.
2. `/tmp/watchstrap-serp-hybrid/lib/shopping.ts` builds deterministic Google
   Shopping queries from that seed.
3. If `GEMINI_API_KEY` is present, Gemini enriches those queries with better
   exact / compatible / similar search phrasing.
4. If `SERPAPI_API_KEY` is present, SerpApi is used to retrieve live Google
   Shopping results.
5. Watchstrapper parses those results and ranks them into:
   - `exact`
   - `compatible`
   - `similar`
6. If live retrieval is unavailable or yields nothing, the route falls back to
   the curated product matching list.

## Environment variables

Optional:

```bash
GEMINI_API_KEY=your_key_here
SERPAPI_API_KEY=your_key_here
SERPAPI_COUNTRY=uk
SERPAPI_LANGUAGE=en
GEMINI_MODEL=gemini-2.0-flash
```

Notes:

- Without `SERPAPI_API_KEY`, the route safely falls back to curated results.
- Without `GEMINI_API_KEY`, the route still works using deterministic queries.
- The UI shopping section is still intentionally gated in
  `/tmp/watchstrap-serp-hybrid/components/HomePageClient.tsx` via
  `SHOW_SHOPPING_PREVIEW = false`.

## Current scope

- Library straps only
- Conservative parsing and ranking
- Width / lug compatibility is intentionally not claimed yet

This keeps the first version useful without overstating fit certainty.
