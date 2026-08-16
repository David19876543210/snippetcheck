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
snippetcheck: capped at 500 snippets, 4099 not scanned (raise with --max-snippets).
https://ai-sdk.dev/llms-full.txt
  L7403   removed-export    StreamData is no longer exported
  L7432   renamed-property  .toDataStreamResponse  →  did you mean .toTextStreamResponse?
  L7837   removed-export    experimental_createMCPClient is no longer exported
  L9165   removed-export    LanguageModelV1StreamPart is no longer exported
  L11258  removed-export    appendClientMessage is no longer exported
  L13947  removed-export    NoOutputSpecifiedError is no longer exported
  L14170  removed-export    ToolExecutionError is no longer exported

7 broken samples in 1 document.
Checked 80 TypeScript samples against ai@7.0.66.
Skipped 420 snippets (228 do not import ai, 190 unresolved import, 2 JS/JSX (use --include-js)).
```

Every one of those seven lines is a real diagnostic, traced back to `ai`'s own
`.d.ts` files at the version snippetcheck actually installed — not a guess about
what probably changed.

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
| `--max-snippets <n>` | Cap on snippets checked, for large sites. Default `500`. |
| `--include-js` | Also check `js`/`jsx` blocks via `checkJs`. Off by default — JS blocks produce more noise. |
| `--verbose` | Show the skip reason for every skipped snippet. |

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

```md
<!-- snippetcheck: skip -->
```ts
const client = connectToYourBackend();
```
```

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
  diagnostic codes are ever reported — removed exports, renamed exports (with a
  "did you mean"), removed properties, renamed properties, unknown object options,
  and wrong argument counts. Type mismatches, undeclared names, and everything else
  TypeScript can flag are discarded as too noisy for docs that were never written to
  be strict-mode clean.

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
