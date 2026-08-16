# ai SDK docs (fixture)

This fixture pins snippets against `ai@4.3.19` and checks them against `ai@5.0.237`,
using two real breaking changes from that major bump.

## Basic generation

```ts
import { generateText, LangChainAdapter } from "ai";

async function run() {
  const result = await generateText({
    model: {} as any,
    prompt: "Say hello",
  });
  console.log(result.reasoningDetails);
}
```

## Step control (a real break we deliberately stay silent on)

`maxSteps` was also removed from `generateText` in v5, but its options type is an
anonymous intersection with no declaration symbol, so snippetcheck cannot trace the
diagnostic back to `ai`'s own declarations. It skips it rather than guess.

```ts
import { generateText } from "ai";

async function run() {
  const result = await generateText({
    model: {} as any,
    prompt: "Say hello",
    maxSteps: 3,
  });
}
```

## Placeholder value (must stay silent: unparseable)

```ts
import { generateText } from "ai";

const result = await generateText({
  model: <YOUR_MODEL>,
  prompt: "hi",
});
```

## Undeclared variable (must stay silent: TS2304 is not in the allowlist)

```ts
import { generateText } from "ai";

async function run() {
  const result = await generateText({ model: model, prompt: "hi" });
  console.log(result.text);
}
```

## Lookalike package (must stay silent: does not import ai)

```ts
import { foo } from "ai-sdk-utils";

foo.bar();
```

## Explicitly skipped

```ts snippetcheck-skip
import { generateText } from "ai";
declare const model: any;
await generateText({ model, prompt: "hi", maxSteps: 5 });
```
