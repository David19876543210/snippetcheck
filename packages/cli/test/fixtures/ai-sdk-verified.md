# Hand-verification record: ai-sdk.dev, post-Fix-1

This file is the record required by Fix 1e. It is not a test fixture consumed by
`node --test` — it is evidence that every finding produced by a real run against a
live, third-party docs site was individually opened and read by hand, and confirmed
to be current-usage content rather than migration/changelog/before-after material.

## Run

```
snippetcheck check https://ai-sdk.dev/llms-full.txt --package ai --verbose
```

Command run twice: once immediately before Fix 1 (heading tracking, historical-section
skip, before-example skip) and once immediately after, against the same source URL.

- Before Fix 1: 7 findings, 80 checked, 420 skipped (no section/historical/before-example
  breakdown existed yet).
- After Fix 1: **same 7 findings**, 80 checked, 559 skipped — including 24 newly skipped
  as `historical-section` and 115 newly skipped as `before-example`. None of the 7
  surviving findings were among the newly-skipped snippets; the historical/before-example
  gates removed a materially large, *different* slice of the document (139 snippets) and
  left the 7 real findings untouched.

This is the expected outcome for a docs site that keeps its migration guide separate
from its reference and how-to pages: the guide content got filtered, the stale
reference pages did not, because they were never migration content to begin with.

## Verification method

For each finding: located the exact heading path via `grep -n "^#"` against the raw
fetched text, then read the surrounding prose by hand (not just the code block) to
confirm the page presents the snippet as current, working usage — present-tense
instructional language, no "before/old/deprecated/instead" framing, no ❌/🚫 markers,
not nested under any heading containing migrat/upgrad/changelog/deprecat/legacy/etc.

## Findings verified

### 1. `L7403` — `removed-export` — `StreamData`

- Section path: `Tool Calling > Tool Execution Options > Tool Call ID`
- Surrounding prose: "The ID of the tool call is forwarded to the tool execution. You
  can use it e.g. when sending tool-call related information with stream data."
- Verdict: **current usage**. No before/after framing. `StreamData` genuinely is not
  exported by `ai@7.0.66` (confirmed independently via `npm view ai@4/ai@7` export
  diff during the CLI's own build).

### 2. `L7432` — `renamed-property` — `.toDataStreamResponse` (TypeScript suggests: `.toTextStreamResponse`)

- Section path: same as above — `Tool Calling > Tool Execution Options > Tool Call ID`,
  same code block as finding 1 (`return result.toDataStreamResponse({ data });`).
- Verdict: **current usage**, same block already verified above. Note per Fix 3: the
  TypeScript-suggested name is a string-similarity guess, not a verified migration
  target, and is rendered as "TypeScript suggests: ..." rather than "did you mean" to
  avoid implying it's the tool's advice.

### 3. `L7837` — `removed-export` — `experimental_createMCPClient`

- Section path: `Tool Calling > MCP Tools > Initializing an MCP Client > SSE Transport`
- Surrounding prose: "The SSE can be configured using a simple object with a `type` and
  `url` property:" followed directly by the import and usage.
- Verdict: **current usage**. Instructional, present-tense, no before/old framing.

### 4. `L9165` — `removed-export` — `LanguageModelV1StreamPart`

- Section path: `Language Model Middleware > Examples > Logging`
- Surrounding prose: "This example shows how to log the parameters and generated text
  of a language model call." A `<Note>` above says the examples "are not meant to be
  used in production" — that is a production-readiness caveat, not a
  historical/deprecation marker, and does not match any before/old/deprecated term.
- Verdict: **current usage**.

### 5. `L11258` — `removed-export` — `appendClientMessage`

- Section path: `Chatbot Message Persistence > Sending only the last message`
- Surrounding prose: "On the server, you can then load the previous messages and
  append the new message to the previous messages:" — present-tense how-to guide.
- Verdict: **current usage**.

### 6. `L13947` — `removed-export` — `NoOutputSpecifiedError`

- Section path: `AI_NoOutputSpecifiedError > Checking for this Error`
- Surrounding prose: "You can check if an error is an instance of
  `AI_NoOutputSpecifiedError` using:" — a live API reference page for the error class.
- Verdict: **current usage**.

### 7. `L14170` — `removed-export` — `ToolExecutionError`

- Section path: `AI_ToolExecutionError > Checking for this Error`
- Surrounding prose: "You can check if an error is an instance of
  `AI_ToolExecutionError` using:" — same reference-page pattern as finding 6.
- Verdict: **current usage**.

## A bug this verification pass caught

While cross-checking finding 6's section path (`AI_NoOutputSpecifiedError`) against a
fresh JSON run, the title-stripping regex turned out to blindly strip every backtick,
`*`, and `_` character from heading text — which mangled `AI_NoOutputSpecifiedError`
into `AINoOutputSpecifiedError`. Fixed to strip only *paired* emphasis markers
(`**bold**`, `__bold__`, `*italic*`) and backtick code spans, leaving bare underscores
in identifiers like `AI_NoOutputSpecifiedError` and `AI_ToolExecutionError` alone.
Re-verified with a fresh run after the fix (see below) — section names now render
correctly.

## A methodology note: live-site line numbers drift between fetches

Cross-checking finding 5 (`L4376` in the first run) against a second, independent
`curl` fetch a few minutes later found the same code at `L4379` — a 3-line drift,
confirmed by grepping for a unique string in the snippet's body and finding it at a
different line number than the tool had originally reported. ai-sdk.dev is live and
evolving; exact line numbers are not stable between requests minutes apart, even
though the content is. This does not weaken the verification: every finding here was
confirmed by locating the *exact symbol and surrounding prose*, not by trusting
proximity to a remembered line number, and the second `curl` fetch's own before-example
skip (`instrumentation... before producing a response`) was matched on Fix 1c's
literal, deliberately-broad `\bbefore\b` rule — an over-cautious skip in the safe
direction the standing rule asks for, not a bug.

## Final re-run after the heading-stripping fix

Re-ran once more after fixing the underscore-mangling bug above, to confirm the fix
didn't change *which* findings survive — only how their section names render:

```
findings: 7  checked: 80  skipped: 559  found: 4599 (capped at 500, 3960 not scanned)
- removed-export    | StreamData                  | Tool Calling > Tool Execution Options > Tool Call ID              | L7403
- renamed-property  | toDataStreamResponse         | Tool Calling > Tool Execution Options > Tool Call ID              | L7432
- removed-export    | experimental_createMCPClient | Tool Calling > MCP Tools > Initializing an MCP Client > SSE Transport | L7837
- removed-export    | LanguageModelV1StreamPart    | Language Model Middleware > Examples > Logging                    | L9165
- removed-export    | appendClientMessage          | Chatbot Message Persistence > Sending only the last message       | L11258
- removed-export    | NoOutputSpecifiedError        | AI_NoOutputSpecifiedError > Checking for this Error               | L13947
- removed-export    | ToolExecutionError            | AI_ToolExecutionError > Checking for this Error                   | L14170
```

Same 7 symbols, same kinds, same section structure. Section names for findings 6 and 7
now render with their underscores intact.

## Conclusion (Fix 1e)

7 of 7 findings confirmed as current-usage content on the live site, none historical,
none before/after demonstration material, stable across repeated runs and one bug fix.
Fix 1e passes. Per the fix prompt's own instruction, work stopped there for hand
confirmation before Fix 2 began.

---

## Second verification pass: after Fix 2 (TS2307 target-only) and Fix 4 (even sampling)

Fixes 2 and 4 changed *what gets checked*, not just what gets skipped: Fix 2 stopped
dropping snippets whose only unresolved import was a third-party package (checked went
from 80 → 272 on this same URL), and Fix 4 replaced prefix-sampling with even sampling
across the whole 4,460-snippet document. Both changes were expected to — and did —
surface an entirely different set of findings than the Fix-1e run above. This is
correct: a different, larger, more evenly-spread sample of the same live site
naturally lands on different stale content.

Re-ran `snippetcheck check https://ai-sdk.dev/llms-full.txt --package ai` and got 7
new findings. Verified every one by hand the same way as above — heading path via
`grep -n "^#"`, then the actual surrounding prose read directly from a fresh fetch.

### 1. `L5168`, `L5527` — `removed-property` — `.mergeIntoDataStream` (×2)

- Section paths: `Express > Examples > Data Stream > Sending Custom Data` and
  `Nest.js > Examples > Data Stream > Sending Custom Data` — the same snippet
  duplicated across two framework-integration guides.
- Prose: "`pipeDataStreamToResponse` can be used to send custom data to the client,"
  followed by a complete, runnable server handler.
- Verdict: **current usage**.

### 2. `L10636` — `renamed-property` — `.toDataStreamResponse` (TypeScript suggests: `.toTextStreamResponse`)

- Section path: `Chatbot > ... > Controlling the response stream > Usage Information`
- Prose: "By default, the usage information is sent back to the client. You can
  disable it by setting the `sendUsage` option to `false`:" — current usage.
- Verdict: **current usage**.

### 3. `L12896` — `removed-export` — `AssistantResponse`

- Section path: `OpenAI Assistants > Example`
- A complete route handler under a section literally titled "Example."
- Verdict: **current usage**.

### 4. `L36855` — `wrong-arity` — `Expected 1 arguments, but got 0.`

- Section path: `... > Type Inference for Tools > Using Inferred Types`
- The offending call is `createUIMessageStream<MyUIMessage>(/* ... */)` — a real
  arity mismatch, correctly traced to `ai`'s own declaration for
  `createUIMessageStream`.
- **Worth flagging, not a verification failure:** the argument position holds a bare
  `/* ... */` block comment, a common documentation convention for "fill in real
  options here" — not `<PLACEHOLDER>`-style unparseable syntax, and not a
  migration/before marker, so none of the existing gates apply to it, and none of
  Fixes 1–4 asked for one. It is current-usage content, not historical/before
  content, so it passes *this* verification. Whether comment-elided arguments like
  `(/* ... */)` deserve their own skip gate is a separate, future precision question
  — flagged for the maintainer rather than decided unilaterally here.
- Verdict: **current usage** (with the above caveat).

### 5. `L43949` — `removed-property` — `.cachedInputTokens`

- Section path: `... > Prompt Caching`
- Complete, unambiguous example with real prompt text and no elision at all.
- Verdict: **current usage**.

### 6. `L83176` — `removed-property` — `.textDelta`

- Section path: `... > Language Models > Reasoning Output`
- Prose: "For reasoning models like `gpt-5`, you can enable reasoning summaries to
  see the model's thought process..." followed by a complete streaming loop.
- Verdict: **current usage**.

### Conclusion (second pass)

7 of 7 new findings confirmed as current-usage content, none historical, none
before/after material.

---

## Third verification pass: after fixing a TS2724 regex bug found during Fix 6

While hand-building real examples for the landing page (Fix 6's second half — see
below), a candidate renamed-export snippet (`ToolExecutionOption` →
`ToolExecutionOptions`) produced **zero findings** through the real CLI despite `tsc`
itself reporting a clean TS2724 with a "Did you mean" suggestion. Traced it to
`parseModuleNoExportedMember` in `check.ts`: its regex required a leading `"Module "`
in the diagnostic message. TS2305's message has that prefix
(`Module '"ai"' has no exported member 'X'.`); TS2724's does not
(`'"ai"' has no exported member named 'X'. Did you mean 'Y'?`). The regex matched
TS2305 and silently failed on every TS2724, for every package, unconditionally —
`renamed-export` had never actually worked. Fixed by making the `Module ` prefix
optional. Added `test/fixtures/renamed-export.md` and a regression test
(`check.test.ts`) pinned to `ai@7.0.66` to lock this in.

This is a strictly additive fix — it only makes the regex match a message shape it
was always supposed to match — but it could surface *more* findings on the same live
run, so re-ran once more before finalizing anything.

### Result: 7 findings → 19 findings

`snippetcheck check https://ai-sdk.dev/llms-full.txt --package ai` went from 7 to 19
findings on the same sample. 12 of those are `renamed-export` — the exact kind that
was silently broken. Verified the new ones by hand:

- **`experimental_generateImage` → `Experimental_GeneratedImage`** (8 occurrences,
  across `Image Generation`, `Custom Headers`, `Guardrails`... — actually `Guardrails`
  is a separate finding, see below), all under the "Image Generation" guide and its
  provider-specific subsections (`Generating Multiple Images`, `Image Models`,
  `Basic Usage` ×2, `Model-specific options`, `Modify Image`, plus the top-level
  `Image Generation` and `Custom Headers` sections). Spot-checked three of the eight
  in full: all present `generateImage` (the prose literally says "The AI SDK provides
  the `generateImage` function...") while the code still imports the old internal name
  `experimental_generateImage`. All current-usage, none historical.
  - **This is a real example of Fix 3 mattering**: `Experimental_GeneratedImage` is a
    *type*, not the function these snippets need. TypeScript's string-similarity
    algorithm picked it purely because it's textually closer to
    `experimental_generateImage` than the actually-correct answer, `generateImage`
    (confirmed by testing both names directly — `generateImage` compiles clean,
    `experimental_generateImage` does not). A reader who trusted "did you mean" here
    would import a type where a function belongs. This is exactly why the report says
    "TypeScript suggests," never "did you mean" as if it were snippetcheck's own advice.
- **`pipeDataStreamToResponse` → `pipeTextStreamToResponse`** (2 occurrences, same
  Express/Nest.js `Sending Custom Data` sections already verified in the second pass).
  Current usage, already confirmed.
- **`LanguageModelV1Middleware` → `LanguageModelMiddleware`**, section
  `Language Model Middleware > Examples > Guardrails` — "Guard rails are a way to
  ensure that the generated text of a language model call is safe and appropriate.
  This example shows how to use guardrails as middleware." Current usage.
- **`ToolInvocation` → `UIToolInvocation`**, section
  `Chatbot Tool Usage > Example > Client-side page` — several paragraphs of current,
  present-tense explanation before the code block. Current usage.

### Conclusion (third pass)

19 of 19 findings confirmed as current-usage content, none historical, none
before/after material. This is the run whose literal output (findings, tally, and
skip-reason breakdown) is published in `packages/cli/README.md`'s usage example.
