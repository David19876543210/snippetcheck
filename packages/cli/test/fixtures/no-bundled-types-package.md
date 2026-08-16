# no-type-declarations regression: a package with no bundled types

`lodash` ships no `types`/`typings` field, no exports-map `types` condition, and no
bundled `index.d.ts` — only `@types/lodash` (DefinitelyTyped) provides types, and
snippetcheck never auto-installs that. Every snippet below type-checks as untyped
`any` under `noImplicitAny: false`, so it must never report "0 findings" as if the
docs were measured and clean.

```ts
import _ from "lodash";

_.debounce(() => {}, 100);
```
