# Shopping Discovery

This project now has a hybrid shopping-retrieval backend behind the existing
`/api/products/similar` route.

## How it works

1. The active library strap provides a normalized seed from
   `/tmp/watchstrap-serp-hybrid/lib/strapLibrary.ts`.
2. `/tmp/watchstrap-serp-hybrid/lib/shopping.ts` builds deterministic product
   search queries from that seed.
3. If `GEMINI_API_KEY` is present, Gemini enriches those queries with better
   exact / compatible / similar search phrasing.
4. If `RAPIDAPI_PRODUCT_SEARCH_KEY` is present, RapidAPI's Real-Time Product
   Search is used to retrieve live product results.
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
RAPIDAPI_PRODUCT_SEARCH_KEY=your_key_here
RAPIDAPI_COUNTRY=uk
RAPIDAPI_LANGUAGE=en
RAPIDAPI_SORT_BY=BEST_MATCH
GEMINI_MODEL=gemini-3-flash-preview
```

Notes:

- RapidAPI auth uses `X-RapidAPI-Key` plus
  `X-RapidAPI-Host: real-time-product-search.p.rapidapi.com`.
- The current code tries `search-v2`, then `search`, then `search-light-v2`
  because the RapidAPI docs and embedded schema expose slightly different path
  names. Override with `RAPIDAPI_PRODUCT_SEARCH_PATHS` if needed.
- Without `RAPIDAPI_PRODUCT_SEARCH_KEY`, the route safely falls back to curated results.
- Without `GEMINI_API_KEY`, the route still works using deterministic queries.
- The UI shopping section is still intentionally gated in
  `/tmp/watchstrap-serp-hybrid/components/HomePageClient.tsx` via
  `NEXT_PUBLIC_ENABLE_SHOPPING_PREVIEW=true`.

## Current scope

- Library straps only
- Conservative parsing and ranking
- Width / lug compatibility is intentionally not claimed yet

This keeps the first version useful without overstating fit certainty.
