# Sandbox Triage Inventory (2026-03-19)

This inventory captures the current state of the preserved sandbox workspace at `/Users/sakaarpuri/Pictures/Watchsrap app` on branch `codex/concept-strap-collage-stage`.

## Tracked edits to review carefully
- `STRAP_IMAGE_PROMPTS.md`
- `app/page.tsx`
- `scripts/split_master_strap.py`
- `public/strap-selection-kie/black-smooth-leather-buckle.png`
- `public/strap-selection-kie/black-smooth-leather-tail.png`

## Tracked deletions to review carefully
These may represent intentional asset replacement work and should not be discarded without inspection.
- `public/sample-strap-a.png`
- `public/sample-strap-b.png`
- multiple strap assets under `public/strap-selection-kie/` including rubber, fabric, suede, and metal variants

## Untracked source-like files and folders
These are likely candidates for later review, archiving, or selective merge.
- `.env.local` (local-only, do not commit)
- raw/source images:
  - `IMG_6079 copy.PNG`
  - `indian leather straps pt 1.jpeg`
  - `watrch repair shop.png`
- asset/source folders:
  - `Strap Selection/`
  - `strap images/`
  - `images/straps/batch-15-non-leather-final/`
  - `images/straps/batch-boutique-10/`
  - `images/straps/master-generated-test/`
  - `images/straps/master-split-test/`
  - `images/straps/single-test/`
- prompt folders:
  - `prompts/straps/batch-15-non-leather/`
  - `prompts/straps/fix-2026-03-10/`
  - `prompts/straps/master-test/`
  - `prompts/straps/single-test/suede-sand/`
- scripts:
  - `scripts/generate_designer_suede_nato_review.py`
  - `scripts/regenerate_active_straps_kie.py`
  - `scripts/regenerate_removed_straps_review.py`
- candidate source asset:
  - `public/upload-watch-head-silhouette.svg`

## Untracked review/output folders likely to archive rather than merge
- `audit/`
- `output/compare-pink-bg/`
- `output/imagegen/`
- `output/kie-pink-test/`
- `output/layout-previews/`
- `output/rebuild-active-straps/`
- `output/review-regens/`
- `output/single-regens/`
- `output/targeted-fixes-2026-03-12/`
- `output/targeted-fixes-2026-03-12-b/`
- `output/theme-mockups/`
- `tmp/`

## Working default
Until a dedicated triage pass happens, keep this sandbox untouched and continue feature work only from clean `main` worktrees.
