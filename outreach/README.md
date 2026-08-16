# Outreach targets (Part C)

`targets.json` is the discovery/outreach target list for running `snippetcheck`
against real npm packages' real docs.

## Current state

Six entries, one per structural shape the checker is known to handle differently —
each was found by actually breaking on it first, not designed in ahead of time:

| Shape | Target | Found via |
|---|---|---|
| `default-export` | zod | TS2614 (a bad named import against a default-exporting package) |
| `named-exports-only` | date-fns | TS1192 (a default import against a package with no default export — TS2614's mirror image) |
| `export-equals-call-signature` | chalk@4 | TS2339 silently failing to trace through an intersection type |
| `subpath-exports` | firebase | real usage imports from `firebase/app` etc., not the package root |
| `definitely-typed-only` | lodash | ships no types itself; only `@types/lodash` has them |
| `no-declarations` | vanta | no bundled types and no `@types/vanta` either — genuinely nothing to check |

This is **not** the full outreach batch — it's six shape-anchors, chosen so the
batch can't accidentally end up structurally homogeneous the way the original
manual testing did (two of these shapes were found by accident, not by design).
Growing this toward the real target count is Part C's actual research work: pick
real companies whose docs are worth writing to, not just any package matching an
empty shape slot.

## Adding a target

Every entry needs:

- `docsUrl` **curl-verified**, not guessed — `curl -so /dev/null -w '%{http_code}' <url>`
  should return `200`. Prefer `llms.txt`/`llms-full.txt` over a bare README when the
  project publishes one — richer content, and it's the format snippetcheck is built
  around.
- `shape` matching one of the values in the top-level `shapes` array. If a new
  target genuinely doesn't fit any existing shape, that's a signal the checker might
  have another blind spot worth running `--unfiltered` against before adding it to
  the batch — see `packages/cli/README.md`.
- `shapeNote` explaining *why* — what breaks a naive checker if this shape isn't
  handled, in one sentence.

Every value in `shapes` must be used by at least one target — that's what "cover
all shapes" means here, not just listing them.

## Running the batch

Not yet built. When it is: read each target, run `snippetcheck check <docsUrl>
--package <packageSpec> --json`, and write `summary.md` grouping results by
`shape` — with `noTypeDeclarations` targets reported as their own category, never
folded into "0 findings" (see `packages/cli/README.md`'s "Packages with no type
declarations" section).

**Before any of this becomes outreach**: every finding gets hand-verified against
the live docs page it came from, the same discipline used for every finding
already published in this repo (see `packages/cli/test/fixtures/*-verified.md`).
No bulk email. Ever.
