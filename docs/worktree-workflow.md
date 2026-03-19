# Worktree Workflow

## Source of truth
- `main` is the source of truth for the app.
- Normal implementation work should happen only in clean worktrees created from `main`.

## Preserved sandbox
- The original workspace at `/Users/sakaarpuri/Pictures/Watchsrap app` is intentionally preserved as a sandbox.
- Current sandbox branch: `codex/concept-strap-collage-stage`.
- That workspace contains in-progress asset generation, prompts, scripts, and review output that must not be reset or opportunistically cleaned.

## Default working rule
- Do not use the preserved sandbox for normal app changes.
- Create a fresh worktree from `main` for each focused feature or cleanup pass.
- If anything is needed from the sandbox, selectively copy or cherry-pick it after review instead of merging the whole branch.

## Later triage pass
Before cleaning the sandbox, classify its contents into:
- repo-worthy source changes
- useful local research/assets to archive outside the main app flow
- disposable review/build output

## Do not do
- Do not run a blanket reset on the sandbox.
- Do not merge the entire sandbox branch into `main`.
- Do not treat untracked review output as application source without a deliberate review step.
