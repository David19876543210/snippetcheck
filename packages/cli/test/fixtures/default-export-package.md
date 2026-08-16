# TS2614 regression: a default-exporting package

Captured from a real `zod@4.4.3` install. TypeScript reports a bad named import
against a module that also has a default export (`export default z;` in zod's own
`index.d.ts`) as TS2614, not TS2305 — a different message shape:

```
Module '"zod"' has no exported member 'totallyFakeExport'. Did you mean to use
'import totallyFakeExport from "zod"' instead?
```

The "Did you mean to use ... instead?" clause always echoes back the same failed
name in default-import syntax; it's never an alternate symbol name, unlike TS2724's
"Did you mean 'Y'?". See check.ts's KIND_BY_CODE comment.

```ts
import { totallyFakeExport } from "zod";

console.log(totallyFakeExport);
```
