#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { runCheck } from "./index.js";
import { renderHuman, renderJson } from "./report.js";

function printUsage(): void {
  console.error(`Usage: snippetcheck check <sources...> --package <spec> [options]

Arguments:
  <sources...>           Glob patterns for local markdown/MDX files, or HTTPS URLs to raw
                          markdown (including llms-full.txt URLs)

Options:
  --package <spec>       Target package to check against, e.g. zod, zod@3.22.4,
                          @scope/pkg@next (required; version defaults to latest)
  --json                 Machine-readable output to stdout; human output suppressed
  --out <file>           Write the JSON report to a file
  --max-snippets <n>     Cap on snippets checked, sampled evenly across the document
                          when exceeded (default 500)
  --include-js           Also check js/jsx blocks via checkJs (off by default)
  --include-historical   Also check migration/changelog/upgrade sections (off by default)
  --verbose              Show the skip reason for every skipped snippet

Exit codes:
  0  no findings
  1  findings present
  2  tool error (install failed, no sources matched)
`);
}

interface ParsedArgs {
  command: string | null;
  sources: string[];
  packageSpec: string | null;
  json: boolean;
  out: string | null;
  maxSnippets: number;
  includeJs: boolean;
  includeHistorical: boolean;
  verbose: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: null,
    sources: [],
    packageSpec: null,
    json: false,
    out: null,
    maxSnippets: 500,
    includeJs: false,
    includeHistorical: false,
    verbose: false,
  };

  const args = [...argv];
  if (args.length > 0 && !args[0].startsWith("-")) {
    result.command = args.shift() ?? null;
  }

  while (args.length > 0) {
    const arg = args.shift()!;
    switch (arg) {
      case "--package":
        result.packageSpec = args.shift() ?? null;
        break;
      case "--json":
        result.json = true;
        break;
      case "--out":
        result.out = args.shift() ?? null;
        break;
      case "--max-snippets": {
        const raw = args.shift();
        const n = raw ? Number.parseInt(raw, 10) : NaN;
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error(`--max-snippets expects a positive integer, got ${raw ?? "nothing"}`);
        }
        result.maxSnippets = n;
        break;
      }
      case "--include-js":
        result.includeJs = true;
        break;
      case "--include-historical":
        result.includeHistorical = true;
        break;
      case "--verbose":
        result.verbose = true;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        result.sources.push(arg);
    }
  }

  return result;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0) {
    printUsage();
    process.exit(2);
  }

  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error(`snippetcheck: ${(err as Error).message}`);
    printUsage();
    process.exit(2);
    return;
  }

  if (parsed.command !== "check") {
    console.error(`snippetcheck: unknown command '${parsed.command ?? ""}'`);
    printUsage();
    process.exit(2);
    return;
  }

  if (parsed.sources.length === 0) {
    console.error("snippetcheck: at least one source (glob pattern or URL) is required.");
    process.exit(2);
    return;
  }

  if (!parsed.packageSpec) {
    console.error("snippetcheck: --package <spec> is required.");
    process.exit(2);
    return;
  }

  try {
    const result = await runCheck(parsed.sources, {
      packageSpec: parsed.packageSpec,
      maxSnippets: parsed.maxSnippets,
      includeJs: parsed.includeJs,
      includeHistorical: parsed.includeHistorical,
    });

    if (parsed.json) {
      console.log(renderJson(result));
    } else {
      console.log(renderHuman(result, { verbose: parsed.verbose }));
    }

    if (parsed.out) {
      await writeFile(parsed.out, renderJson(result), "utf8");
    }

    process.exit(result.findings.length > 0 ? 1 : 0);
  } catch (err) {
    console.error(`snippetcheck: ${(err as Error).message}`);
    process.exit(2);
  }
}

main();
