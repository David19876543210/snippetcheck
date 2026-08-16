# Renamed export fixture

`ToolExecutionOption` (singular) doesn't exist; `ToolExecutionOptions` (plural) does.
TypeScript's own message for this diagnostic (TS2724) has a different shape than the
plain "no exported member" message (TS2305) — it omits the leading "Module " prefix
entirely. A regex written only against the TS2305 shape silently drops every TS2724
finding, for every package, always. This fixture exists to catch that regression.

```ts
import { ToolExecutionOption } from "ai";
```
