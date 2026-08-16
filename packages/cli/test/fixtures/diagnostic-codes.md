# One fixture block per diagnostic code the allowlist trusts

Every symbol/suggestion pair asserted against this fixture was captured from a real
`snippetcheck check ... --package ai@7.0.66 --json` run, not hand-written. See
`diagnostic-codes.test.ts`. This fixture exists because two of these seven codes
(TS2724, TS2561) were silently broken — the extraction regex assumed a message shape
that doesn't match what `tsc` actually emits — and neither failure had any symptom
short of reading the JSON output by hand.

## TS2305 — removed export, no suggestion

```ts
import { AssistantResponse } from "ai";
```

## TS2339 — removed property, no suggestion

```ts
import { generateText } from "ai";

const result = await generateText({ model: "gpt-4o", prompt: "hi" });
console.log(result.reasoningDetails);
```

## TS2551 — renamed property, with suggestion

```ts
import { streamText } from "ai";

const result = streamText({ model: "gpt-4o", prompt: "hi" });
result.pipeDataStreamToResponse(res);
```

## TS2353 — unknown option, no suggestion

```ts
import { embed } from "ai";

const result = await embed({ model: "text-embedding-3-small", value: "hi", unrecognizedFlag: true });
```

## TS2561 — unknown option, with suggestion

```ts
import { embed } from "ai";

const result = await embed({ model: "text-embedding-3-small", value: "hi", abortSignall: undefined });
```

## TS2554 — wrong arity

```ts
import { cosineSimilarity } from "ai";

const sim = cosineSimilarity([1, 2], [3, 4], [5, 6]);
```

## TS2724 — renamed export, with suggestion

```ts
import type { LanguageModelV1Middleware } from "ai";
```
