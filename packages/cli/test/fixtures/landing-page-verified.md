# Hand-verification record: landing page hero and "What it checks" cards

This is the record for the landing-page-specific content that isn't already covered
by `ai-sdk-verified.md` (which documents the live `ai-sdk.dev` scrape used in the
README's example run). The hero mockup and five of the six "what it checks" cards
were run through the real CLI against `ai@latest`; the sixth ("Unknown Options") is
explicitly labeled on the page as a constructed input, per its own disclosure line.

## Method

For each snippet below: wrote it to a real `.md` fixture, ran
`snippetcheck check <fixture> --package ai --json`, and used the literal `message`,
`code`, `symbol`, and `typescriptSuggestion` fields verbatim. None of the diagnostic
text on the page is hand-written.

## Hero (components/Mockup.tsx)

```ts
import { StreamData, streamText } from "ai";

export async function POST(req: Request) {
  const data = new StreamData();

  const result = await streamText({
    model: "gpt-4o",
    prompt: "Plan a trip to Lisbon.",
  });

  return result.toDataStreamResponse({ data });
}
```

- `StreamData` import → `TS2305: Module "ai" has no exported member 'StreamData'.`
- `.toDataStreamResponse` → `TS2551: Property 'toDataStreamResponse' does not exist
  on type 'StreamTextResult<ToolSet, Context, Output<string, string, never>>'. Did
  you mean 'toTextStreamResponse'?`

This snippet is self-contained (`model: "gpt-4o"` is a plain string, not an
undeclared identifier) — it produces exactly these two findings and nothing else;
the string-vs-`LanguageModel` type mismatch on `model` is a TS2322/2345-class
diagnostic, which is outside the seven-code allowlist and never surfaces.

Both findings are also present in the real `ai-sdk.dev` scrape (see
`ai-sdk-verified.md`, findings 1–2), so this hero snippet mirrors genuinely live,
hand-verified content — it isn't just internally consistent, it's the same break a
real docs site currently ships.

## "What it checks" cards (app/page.tsx)

### Removed Exports — real

```ts
import { AssistantResponse } from "ai";
```

`TS2305: Module "ai" has no exported member 'AssistantResponse'.` Same finding
verified live on `ai-sdk.dev` (`ai-sdk-verified.md`, second-pass finding 3).

### Renamed Exports — real

```ts
import type { LanguageModelV1Middleware } from "ai";
```

`TS2724: '"ai"' has no exported member named 'LanguageModelV1Middleware'. Did you
mean 'LanguageModelMiddleware'?` Same finding verified live on `ai-sdk.dev`
(`ai-sdk-verified.md`, third-pass "Guardrails" finding). Replaces the earlier
`ToolExecutionOption` card, which was a deliberate misspelling rather than a real
cross-version rename.

### Removed Properties — real

```ts
console.log(result.reasoningDetails);
```

`TS2339: Property 'reasoningDetails' does not exist on type
'GenerateTextResult<ToolSet, Context, Output<string, string, any>>'.` Same property
used in the CLI's own end-to-end test fixture (`ai-docs.md`).

### Renamed Properties — real

```ts
result.pipeDataStreamToResponse(res);
```

`TS2551: Property 'pipeDataStreamToResponse' does not exist on type
'StreamTextResult<ToolSet, Context, Output<string, string, never>>'. Did you mean
'pipeTextStreamToResponse'?` Same rename pattern (`...DataStream...` →
`...TextStream...`) verified live on `ai-sdk.dev` twice (`ai-sdk-verified.md`,
`pipeDataStreamToResponse` finding, "Sending Custom Data" section).

### Unknown Options — constructed input, labeled on the page

```ts
import { embed } from "ai";

const result = await embed({ model: "text-embedding-3-small", value: "hello", unrecognizedFlag: true });
```

`TS2353: Object literal may only specify known properties, and 'unrecognizedFlag'
does not exist in type '{ model: EmbeddingModel; value: string; maxRetries?: number;
abortSignal?: AbortSignal; headers?: Record<string, string>;
providerOptions?: SharedV4ProviderOptions; ... 6 more ...; _internal?: { ...; }; }'.`

This is real compiler output — `unrecognizedFlag` genuinely isn't a valid `embed()`
option, and the diagnostic is genuinely traced to `ai`'s own declaration for
`embed`'s options type. What's constructed is the *input*: no snippet on
`ai-sdk.dev` was found (across two hand-verified scrapes) that happens to pass an
unrecognized option to a function whose options type resolves to a concrete,
non-anonymous symbol — most of `ai`'s option objects are anonymous intersection
types with no resolvable declaration symbol (see `ai-sdk-verified.md`'s note on the
`maxSteps` case), so real excess-property findings are rare in practice even when
the underlying mistake is common. This is why the page discloses it rather than
presenting it as a live finding.

### Wrong Arity — real

```ts
createUIMessageStream<MyUIMessage>(/* ... */);
```

`TS2554: Expected 1 arguments, but got 0.` Identical to the real
`ai-sdk.dev` finding at "Using Inferred Types" (`ai-sdk-verified.md`, wrong-arity
finding) — same function, same code, same comment-elision caveat noted there: the
argument position holds a `/* ... */` placeholder comment, a documentation
convention, not `<PLACEHOLDER>`-style unparseable syntax. Included here as a clean,
compact illustration of the wrong-arity category using the exact same real finding
already disclosed and verified on the live site.

## Conclusion

5 of 6 cards plus the hero use real, unedited compiler output traced to genuine
`ai-sdk.dev` findings or the CLI's own verified test fixtures. The one exception
(Unknown Options) is real compiler output on a constructed input, and the page says
so under the section heading.
