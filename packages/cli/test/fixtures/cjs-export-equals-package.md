# Intersection-type origin regression: a CJS `export =` package

Captured from a real `chalk@4.1.2` install. `export = chalk;` where `chalk` is
`Chalk & ChalkFunction & { ... }` gives the default-imported value an intersection
type. Intersection types have no `type.getSymbol()`/`type.aliasSymbol` of their
own — TypeScript doesn't give a structural intersection one canonical symbol — so
before this fixture existed, `resolvePropertyAccessOrigin` silently failed to trace
*any* TS2339 on a default-imported `export =` value back to the target package, no
matter how real the missing property was. See check.ts's `declarationOriginFiles`.

```ts
import chalk from "chalk";

console.log(chalk.totallyFakeColor("hi"));
```
