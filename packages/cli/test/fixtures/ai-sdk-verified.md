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

## Conclusion

7 of 7 findings confirmed as current-usage content on the live site, none historical,
none before/after demonstration material, stable across repeated runs and one bug fix.
Fix 1e passes. Per the fix prompt's own instruction, work stops here for hand
confirmation before Fix 2 begins.
