# TS1192 regression: a named-exports-only package

Captured from a real `date-fns@4.4.0` install. TypeScript reports a default import
against a module that has no default export at all — the mirror image of TS2614's
"named import against a default-exporting module":

```
Module '"/private/.../node_modules/date-fns/index"' has no default export.
```

Unlike TS2305/2724/2614, this quotes the *resolved* file path, not the source
specifier — there's no "the source text said 'date-fns'" once resolution already
happened. See check.ts's `parseNoDefaultExport` and `sanitizeMessage`; the raw path
above must never reach a rendered Finding.

```ts
import format from "date-fns";

format(new Date(), "yyyy-MM-dd");
```
