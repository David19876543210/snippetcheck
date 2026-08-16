# Mixed import fixture

Imports both the target package (`ai`) and a package that is definitely not
installed. The unresolved third-party import must not suppress the real,
independently-verifiable break in the target-package import below it.

```ts
import { LangChainAdapter } from "ai";
import { helper } from "this-package-definitely-does-not-exist-xyz123";

helper();
```
