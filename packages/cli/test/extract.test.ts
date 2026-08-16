import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { extractSnippets, findImports, importMatchesPackage } from "../src/extract.js";

describe("extractSnippets: fences", () => {
  test("tilde fences", () => {
    const md = ["~~~ts", 'import { z } from "zod";', "~~~"].join("\n");
    const { snippets } = extractSnippets(md, "doc.md");
    assert.equal(snippets.length, 1);
    assert.equal(snippets[0].lang, "ts");
    assert.equal(snippets[0].line, 2);
    assert.equal(snippets[0].code, 'import { z } from "zod";');
  });

  test("four-backtick fences containing a triple-backtick", () => {
    const md = ["````ts", "// contains ``` inside", "const a = 1;", "````"].join("\n");
    const { snippets } = extractSnippets(md, "doc.md");
    assert.equal(snippets.length, 1);
    assert.equal(snippets[0].line, 2);
    assert.equal(snippets[0].code, "// contains ``` inside\nconst a = 1;");
  });

  test("a three-backtick close does not terminate a four-backtick fence", () => {
    const md = ["````ts", "```", "const a = 1;", "````"].join("\n");
    const { snippets } = extractSnippets(md, "doc.md");
    assert.equal(snippets.length, 1);
    assert.equal(snippets[0].code, "```\nconst a = 1;");
  });

  test("fence indented inside a list item strips the indentation", () => {
    const md = ["- Item", "  ```ts", "  const a = 1;", "  const b = 2;", "  ```"].join("\n");
    const { snippets } = extractSnippets(md, "doc.md");
    assert.equal(snippets.length, 1);
    assert.equal(snippets[0].line, 3);
    assert.equal(snippets[0].code, "const a = 1;\nconst b = 2;");
  });

  test("info string metadata: language is the first whitespace/brace-delimited token", () => {
    const md = ['```ts title="index.ts" {3-5} showLineNumbers', "const a = 1;", "```"].join("\n");
    const { snippets } = extractSnippets(md, "doc.md");
    assert.equal(snippets.length, 1);
    assert.equal(snippets[0].lang, "ts");
  });

  test("info string metadata with no space before the brace", () => {
    const md = ["```ts{3-5}", "const a = 1;", "```"].join("\n");
    const { snippets } = extractSnippets(md, "doc.md");
    assert.equal(snippets.length, 1);
    assert.equal(snippets[0].lang, "ts");
  });

  test("unrecognized languages are ignored entirely, not skipped-with-reason", () => {
    const md = ["```python", "print('hi')", "```", "", "```", "no language at all", "```"].join("\n");
    const { snippets, skipped } = extractSnippets(md, "doc.md");
    assert.equal(snippets.length, 0);
    assert.equal(skipped.length, 0);
  });

  test("language aliases map to the four canonical languages", () => {
    const md = [
      "```typescript",
      "const a = 1;",
      "```",
      "```mts",
      "const b = 1;",
      "```",
      "```javascript",
      "const c = 1;",
      "```",
      "```mjs",
      "const d = 1;",
      "```",
    ].join("\n");
    const { snippets } = extractSnippets(md, "doc.md");
    assert.deepEqual(
      snippets.map((s) => s.lang),
      ["ts", "ts", "js", "js"],
    );
  });
});

describe("extractSnippets: skip directives", () => {
  for (const token of ["snippetcheck-skip", "no-test", "notest", "skip-test", "nocompile"]) {
    test(`info string token "${token}" marks the block explicitly-skipped`, () => {
      const md = [`\`\`\`ts ${token}`, "const a = 1;", "```"].join("\n");
      const { snippets, skipped } = extractSnippets(md, "doc.md");
      assert.equal(snippets.length, 0);
      assert.equal(skipped.length, 1);
      assert.equal(skipped[0].reason, "explicitly-skipped");
    });
  }

  test("an HTML comment directive on the line directly above the fence skips it", () => {
    const md = ["<!-- snippetcheck: skip -->", "```ts", "const a = 1;", "```"].join("\n");
    const { snippets, skipped } = extractSnippets(md, "doc.md");
    assert.equal(snippets.length, 0);
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0].reason, "explicitly-skipped");
  });

  test("an HTML comment directive up to three lines above the fence still skips it", () => {
    const md = ["<!-- snippetcheck: skip -->", "", "", "```ts", "const a = 1;", "```"].join("\n");
    const { snippets, skipped } = extractSnippets(md, "doc.md");
    assert.equal(snippets.length, 0);
    assert.equal(skipped.length, 1);
  });

  test("an HTML comment directive more than three lines above the fence does not skip it", () => {
    const md = ["<!-- snippetcheck: skip -->", "", "", "", "```ts", "const a = 1;", "```"].join("\n");
    const { snippets, skipped } = extractSnippets(md, "doc.md");
    assert.equal(snippets.length, 1);
    assert.equal(skipped.length, 0);
  });
});

describe("extractSnippets: line numbers", () => {
  test("reports correct 1-based line numbers for the 2nd and 3rd block in a file", () => {
    const lines = [
      "# Doc", // 1
      "", // 2
      "```ts", // 3 (block 1 fence)
      "const a = 1;", // 4
      "```", // 5
      "", // 6
      "Some text.", // 7
      "", // 8
      "```ts", // 9 (block 2 fence)
      "const b = 2;", // 10
      "const c = 3;", // 11
      "```", // 12
      "", // 13
      "```ts", // 14 (block 3 fence)
      "const d = 4;", // 15
      "```", // 16
    ];
    const { snippets } = extractSnippets(lines.join("\n"), "doc.md");
    assert.equal(snippets.length, 3);
    assert.deepEqual(
      snippets.map((s) => s.line),
      [4, 10, 15],
    );
  });
});

describe("findImports", () => {
  test("default import", () => {
    assert.deepEqual(findImports('import z from "zod";'), ["zod"]);
  });

  test("side-effect import", () => {
    assert.deepEqual(findImports('import "zod";'), ["zod"]);
  });

  test("type-only named import", () => {
    assert.deepEqual(findImports('import type { ZodError } from "zod";'), ["zod"]);
  });

  test("multi-line named import", () => {
    const code = ['import {', "  A,", "  B,", '} from "zod";'].join("\n");
    assert.deepEqual(findImports(code), ["zod"]);
  });

  test("default plus named import", () => {
    assert.deepEqual(findImports('import z, { ZodError } from "zod";'), ["zod"]);
  });

  test("namespace import", () => {
    assert.deepEqual(findImports('import * as z from "zod";'), ["zod"]);
  });

  test("export ... from", () => {
    assert.deepEqual(findImports('export { z } from "zod";'), ["zod"]);
  });

  test("require call", () => {
    assert.deepEqual(findImports('const z = require("zod");'), ["zod"]);
  });

  test("dynamic import", () => {
    assert.deepEqual(findImports('const z = await import("zod");'), ["zod"]);
  });

  test("does not mistake a method call for an import", () => {
    assert.deepEqual(findImports("const arr = Array.from(iterable);"), []);
  });

  test("does not bridge across two separate statements", () => {
    const code = ['import "zod";', 'import { z } from "zod/v4";'].join("\n");
    assert.deepEqual(findImports(code).sort(), ["zod", "zod/v4"]);
  });

  test("dedupes repeated specifiers", () => {
    const code = ['import { a } from "zod";', 'import { b } from "zod";'].join("\n");
    assert.deepEqual(findImports(code), ["zod"]);
  });
});

describe("importMatchesPackage", () => {
  test("exact match", () => {
    assert.equal(importMatchesPackage("zod", "zod"), true);
  });

  test("subpath match", () => {
    assert.equal(importMatchesPackage("zod/v4", "zod"), true);
  });

  test("does not match a lookalike package with a hyphen suffix", () => {
    assert.equal(importMatchesPackage("zod-validation-error", "zod"), false);
  });

  test("does not match a lookalike package with a prefix", () => {
    assert.equal(importMatchesPackage("my-zod", "zod"), false);
  });

  test("scoped package exact match", () => {
    assert.equal(importMatchesPackage("@scope/pkg", "@scope/pkg"), true);
  });

  test("scoped package subpath match", () => {
    assert.equal(importMatchesPackage("@scope/pkg/sub", "@scope/pkg"), true);
  });

  test("scoped package does not match a sibling package", () => {
    assert.equal(importMatchesPackage("@scope/pkg2", "@scope/pkg"), false);
  });
});
