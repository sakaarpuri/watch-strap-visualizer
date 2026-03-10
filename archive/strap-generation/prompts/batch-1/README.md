# Batch 1 Strap Generation

## Master prompt template

- Use `master-template.json` as the source template for all strap generations.
- Replace `{{color}}`, `{{texture}}`, `{{material}}`, `{{material_rendering}}`, `{{surface_detail}}`, `{{stitching_detail}}`, `{{hardware_visibility}}`, and `{{part}}` from the CSV row.
- Generate each strap twice: once with `part=buckle` and once with `part=tail`.

## Batch 1 list

- Source file: `strap-variants-batch-1.csv`
- Total strap styles: 30
- Total image outputs for batch 1: 60

## Output naming rules

- Folder: `images/straps/batch-1/`
- Prompt folder: `prompts/straps/batch-1/generated/`
- Prompt filename pattern: `b01-{output_slug}-{part}-v01.json`
- Image filename pattern: `b01-{output_slug}-{part}-v01.png`
- Allowed `part` values: `buckle`, `tail`
- Allowed version start: `v01`
- If regenerated after prompt changes, increment only the version suffix: `v02`, `v03`

## Example filenames

- `b01-black-smooth-leather-buckle-v01.json`
- `b01-black-smooth-leather-buckle-v01.png`
- `b01-black-smooth-leather-tail-v01.json`
- `b01-black-smooth-leather-tail-v01.png`

## Execution notes

- Preferred API settings are already defined in the template: `2048x2048`, `1:1`, `png`.
- If the API returns opaque backgrounds instead of true transparency, keep the same naming and run a post-process cleanup step without changing the base slug.
- Use silver hardware by default unless the CSV row explicitly says otherwise.
- One-command Kie pipeline for final transparent assets:
  `python3 scripts/kie_generate_transparent.py prompts/straps/batch-1/generated/b01-black-smooth-leather-buckle-v02.json images/straps/batch-1/b01-black-smooth-leather-buckle-v02-clean.png 1:1`
