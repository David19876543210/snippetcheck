# snippetcheck

Finds broken TypeScript code samples in documentation.

Every API company publishes docs full of TypeScript examples. Nobody tests them. When
the SDK renames a parameter or drops a method, the sample silently rots, and the next
developer who copies it fails on their first five minutes with the product.

snippetcheck extracts every TypeScript code block from a docs site, installs the
package the docs are about, type-checks each block against the real published type
declarations, and reports only the samples that provably no longer work.

**Precision over recall is the whole design.** The output of this tool is often read
by someone deciding whether to trust it. One false positive costs more than ten missed
real breaks. When in doubt, snippetcheck stays silent and counts the snippet as
skipped — it never guesses, and it never reports a diagnostic it can't trace back to
the target package's own type declarations.

**Status: early.** `0.1.0`, first publish. The allowlist covers nine TypeScript
diagnostic codes found by hand against real packages, not a general-purpose
checker — see [What this does not do](#what-this-does-not-do).
[Issues welcome](https://github.com/David19876543210/snippetcheck/issues).

## Install

```sh
npm install -g snippetcheck
```

Or run it without installing:

```sh
npx snippetcheck check <sources...> --package <spec>
```

## Usage

```sh
snippetcheck check https://ai-sdk.dev/llms-full.txt --package ai
```

Real output, from a real run against the live Vercel AI SDK docs on 2026-08-16,
checked against the `ai` package's own `latest` tag:

```
snippetcheck: sampled 500 of 4,460 snippets, evenly spaced (raise with --max-snippets).
https://ai-sdk.dev/llms-full.txt

  Sending Custom Data
    L5152 renamed-export    pipeDataStreamToResponse
                            TypeScript suggests: pipeTextStreamToResponse
    L5168 removed-property  .mergeIntoDataStream
    L5511 renamed-export    pipeDataStreamToResponse
                            TypeScript suggests: pipeTextStreamToResponse
    L5527 removed-property  .mergeIntoDataStream

  Image Generation
    L8413 renamed-export    experimental_generateImage
                            TypeScript suggests: Experimental_GeneratedImage

  Custom Headers
    L8564 renamed-export    experimental_generateImage
                            TypeScript suggests: Experimental_GeneratedImage

  Guardrails
    L9282 renamed-export    LanguageModelV1Middleware
                            TypeScript suggests: LanguageModelMiddleware

  Usage Information
    L10636 renamed-property  .toDataStreamResponse
                             TypeScript suggests: .toTextStreamResponse

  Client-side page
    L11726 renamed-export    ToolInvocation
                             TypeScript suggests: UIToolInvocation

  Example
    L12896 removed-export    AssistantResponse

  Generating Multiple Images
    L33550 renamed-export    experimental_generateImage
                             TypeScript suggests: Experimental_GeneratedImage

  Using Inferred Types
    L36855 wrong-arity       Expected 1 arguments, but got 0.

  Image Models
    L42583 renamed-export    experimental_generateImage
                             TypeScript suggests: Experimental_GeneratedImage

  Prompt Caching
    L43949 removed-property  .cachedInputTokens

  Basic Usage
    L48345 renamed-export    experimental_generateImage
                             TypeScript suggests: Experimental_GeneratedImage
    L55705 renamed-export    experimental_generateImage
                             TypeScript suggests: Experimental_GeneratedImage

  Model-specific options
    L49206 renamed-export    experimental_generateImage
                             TypeScript suggests: Experimental_GeneratedImage

  Modify Image
    L49592 renamed-export    experimental_generateImage
                             TypeScript suggests: Experimental_GeneratedImage

  Reasoning Output
    L83176 removed-property  .textDelta

19 broken samples in 1 document.
Checked 272 TypeScript samples against ai@7.0.66.
Skipped 367 snippets (224 do not import ai, 2 unparseable, 24 historical/migration content, 115 before/old examples, 2 JS/JSX (use --include-js)).
```

Every one of those lines is a real diagnostic, traced back to `ai`'s own `.d.ts`
files at the version snippetcheck actually installed, grouped under the section it
came from — not a guess about what probably changed, and not attributed to a
migration guide or a before/after comparison that was never meant to compile.

Look closely at the `experimental_generateImage` lines: TypeScript suggests
`Experimental_GeneratedImage` — a *type*, not a function. The actually-correct
replacement is `generateImage` (the docs' own prose says so), but that's not the
closest-spelled name, so `tsc`'s similarity algorithm didn't find it. This is exactly
why the report says "TypeScript suggests," never "did you mean" as if it were
snippetcheck's own advice — see [What this does not do](#what-this-does-not-do) below.

You can also point it at local files:

```sh
snippetcheck check "docs/**/*.mdx" --package zod@3.22.4
```

### Sources

`<sources...>` accepts glob patterns for local markdown/MDX files, or HTTPS URLs to
raw markdown — including `llms-full.txt` URLs, which many docs sites now publish and
which are the fastest way to scan an entire docs site in one request.

## Flags

| Flag | Description |
|---|---|
| `--package <spec>` | **Required.** The package to check against: `zod`, `zod@3.22.4`, `@scope/pkg@next`. The version defaults to `latest` if omitted. |
| `--json` | Machine-readable output to stdout; human output suppressed. |
| `--out <file>` | Write the JSON report to a file. |
| `--max-snippets <n>` | Cap on snippets checked, for large sites. When exceeded, snippets are sampled evenly across the document rather than taking the first N — otherwise everything skews toward whatever's early in the file. Default `500`. |
| `--include-js` | Also check `js`/`jsx` blocks via `checkJs`. Off by default — JS blocks produce more noise. |
| `--include-historical` | Also check snippets under migration/upgrade/changelog/deprecated headings. Off by default — see [Historical and before/after content](#historical-and-beforeafter-content). |
| `--verbose` | Show the skip reason for every skipped snippet. |
| `--unfiltered` | Debug: also print every semantic diagnostic TypeScript raised on a target-importing snippet whose code isn't in the allowlist — useful for finding the allowlist's next candidate code on a new package. Never affects findings or exit code. |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | No findings. |
| `1` | Findings present. Use this to gate CI. |
| `2` | Tool error — install failed, or no sources matched. |

## Skipping a snippet on purpose

Docs sometimes contain illustrative pseudo-code that was never meant to compile.
Mark those blocks and snippetcheck will leave them alone, counting them as
explicitly skipped rather than silently ignoring them:

````md
```ts snippetcheck-skip
// pseudo-code, not meant to run
const client = connectToYourBackend();
```
````

Any of `snippetcheck-skip`, `no-test`, `notest`, `skip-test`, or `nocompile` in the
fence's info string works. So does an HTML comment on one of the three lines above
the fence:

````md
<!-- snippetcheck: skip -->
```ts
const client = connectToYourBackend();
```
````

## Historical and before/after content

`llms-full.txt` and full-site dumps concatenate an entire docs site — including
migration guides, changelogs, and before/after comparisons. Those pages contain
snippets that *deliberately* show the removed API; a migration guide demonstrating
the old way of doing something is not a broken doc, it's a doc doing its job.

By default, snippetcheck skips two kinds of content rather than risk reporting them:

- **Historical sections** — any snippet nested under a heading matching migration,
  upgrade, changelog, release notes, breaking change, deprecated, legacy, "what's
  new", or a version-to-version pattern like "v4 to v5" or "v4.x". Pass
  `--include-historical` to check these anyway (useful if you're auditing your own
  migration guide for accuracy).
- **Before/after demonstration snippets** — a fenced block whose info string or
  three preceding lines say before/old/previously/deprecated/don't/instead
  of/no longer, or lead with a ❌ or 🚫. These are almost always the "here's what
  not to do" half of a before/after pair.

Both are tracked as their own skip reasons (`historical-section`, `before-example`)
in `--verbose` output and the JSON report, so you can see exactly how much content
was excluded and why.

## Packages with no type declarations

Some packages ship no `types`/`typings` field, no `types` condition in their
exports map, and no bundled `index.d.ts` — every import from them resolves to
`any`, so nothing is actually checkable. snippetcheck never installs
`@types/<pkg>` on your behalf to fill the gap.

This is reported as its own status — `noTypeDeclarations: true` in the JSON
report, and a distinct yellow line in the human output — never as
"No broken samples found." Zero findings only means the docs are clean when
something was actually measured; here, nothing was. If a DefinitelyTyped package
exists for it anyway, that's noted too (`definitelyTypedAvailable`), purely as
context for why.

## What this does not do

- **It does not execute code.** It type-checks. Nothing runs, nothing needs an API
  key, nothing needs a network call other than the package install and the docs
  fetch itself.
- **It does not guess.** A snippet with an undeclared placeholder variable, a
  `<YOUR_API_KEY>`-style stand-in, or a syntax error it can't parse is skipped, not
  flagged.
- **It only reports diagnostics it can trace back to the target package's own
  declaration files.** If a diagnostic can't be resolved to a symbol declared inside
  `node_modules/<package>`, it is dropped, even if it looks real. Dropping a real
  finding costs nothing; reporting a fake one costs the reader's trust in every other
  line of the report.
- **It has an opinion about which diagnostics matter.** Only seven TypeScript
  diagnostic codes are ever reported — removed exports, renamed exports, removed
  properties, renamed properties, unknown object options, and wrong argument counts.
  Type mismatches, undeclared names, and everything else TypeScript can flag are
  discarded as too noisy for docs that were never written to be strict-mode clean.
- **It never presents TypeScript's guess as its own advice.** When a diagnostic
  carries a "Did you mean 'x'?", the report shows it as `TypeScript suggests: x` —
  `tsc`'s own string-similarity guess, not a verified migration target. The real
  replacement for a renamed symbol is sometimes not the closest-spelled name. In
  `--json`, this is the `typescriptSuggestion` field, not `suggestion`.
- **It skips migration guides and before/after demonstrations by default.** See
  [Historical and before/after content](#historical-and-beforeafter-content).

## Prior art

Two tools already occupy adjacent ground, and it's worth being specific about how
snippetcheck differs from each.

**[`test-snippets`](https://www.npmjs.com/package/test-snippets)** extracts examples
from markdown and *executes* them against the package installed locally. It's a solid
tool for what it's built for, but every snippet has to be hand-tagged with an HTML
comment before it will run, which means it only works on docs you already control and
have already annotated. It also needs API keys, network access, and a working runtime
environment to execute against.

**Sphinx's [`doctest`](https://www.sphinx-doc.org/en/master/usage/extensions/doctest.html)**
extension does the equivalent job for Python, inside the Sphinx toolchain — comparing
a doctest block's expected output against what actually runs.

Both are opt-in tools for maintainers preparing their own docs before publishing.
**`test-snippets` tests the docs you've prepared; snippetcheck tests the docs you've
already shipped.** Zero-config, pointed at a URL, it can be run against a stranger's
published documentation with no cooperation from them — because it type-checks
against published declarations instead of executing against a live setup, it needs
no tagging, no credentials, and no environment beyond `npm install`.

## License

MIT
