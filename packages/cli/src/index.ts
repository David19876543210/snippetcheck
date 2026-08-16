import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import { extractSnippets } from "./extract.js";
import { createWorkspace } from "./workspace.js";
import { checkSnippets } from "./check.js";
import type { CheckResult, Snippet, SkippedSnippet } from "./types.js";

export interface RunCheckOptions {
  packageSpec: string;
  maxSnippets: number;
  includeJs: boolean;
  includeHistorical: boolean;
  /** See CheckOptions.unfiltered / CheckResult.unfilteredDiagnostics. */
  unfiltered?: boolean;
}

interface ResolvedDoc {
  text: string;
  source: string;
}

async function resolveSources(patterns: string[]): Promise<ResolvedDoc[]> {
  const docs: ResolvedDoc[] = [];
  const localPatterns: string[] = [];

  for (const pattern of patterns) {
    if (/^https?:\/\//i.test(pattern)) {
      const res = await fetch(pattern);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${pattern}: HTTP ${res.status}`);
      }
      docs.push({ text: await res.text(), source: pattern });
    } else {
      localPatterns.push(pattern);
    }
  }

  if (localPatterns.length > 0) {
    const files = await fg(localPatterns, { onlyFiles: true, unique: true, dot: false });
    for (const file of files) {
      const text = await readFile(file, "utf8");
      docs.push({ text, source: relative(process.cwd(), file) || file });
    }
  }

  return docs;
}

/**
 * Taking the first N snippets in document order biases everything toward whatever
 * appears early in a concatenated file — for llms-full.txt, usually the introduction.
 * Sample evenly across the whole document instead.
 */
export function sampleEvenly<T>(items: T[], max: number): T[] {
  const total = items.length;
  const result: T[] = [];
  for (let i = 0; i < max; i++) {
    const idx = Math.min(total - 1, Math.round((i * total) / max));
    result.push(items[idx]);
  }
  return result;
}

export async function runCheck(sources: string[], options: RunCheckOptions): Promise<CheckResult> {
  const docs = await resolveSources(sources);
  if (docs.length === 0) {
    throw new Error("No sources matched. Check your glob patterns or URLs.");
  }

  const allSnippets: Snippet[] = [];
  const extractSkipped: SkippedSnippet[] = [];

  for (const doc of docs) {
    const { snippets, skipped } = extractSnippets(doc.text, doc.source, {
      includeHistorical: options.includeHistorical,
    });
    allSnippets.push(...snippets);
    extractSkipped.push(...skipped);
  }

  const snippetsTotal = allSnippets.length;
  let candidates = allSnippets;
  if (snippetsTotal > options.maxSnippets) {
    console.error(
      `snippetcheck: sampled ${options.maxSnippets.toLocaleString()} of ${snippetsTotal.toLocaleString()} snippets, evenly spaced (raise with --max-snippets).`,
    );
    candidates = sampleEvenly(allSnippets, options.maxSnippets);
  }

  const workspace = await createWorkspace(options.packageSpec);
  try {
    const checkResult = checkSnippets(candidates, {
      packageName: workspace.packageName,
      workspaceRoot: workspace.root,
      includeJs: options.includeJs,
      unfiltered: options.unfiltered,
    });

    const result: CheckResult = {
      packageName: workspace.packageName,
      packageVersion: workspace.packageVersion,
      documentsScanned: docs.length,
      snippetsFound: allSnippets.length + extractSkipped.length,
      snippetsTotal,
      snippetsChecked: checkResult.checked,
      skipped: [...extractSkipped, ...checkResult.skipped],
      findings: checkResult.findings,
      noTypeDeclarations: !workspace.hasTypeDeclarations,
      definitelyTypedAvailable: workspace.definitelyTypedAvailable,
      ...(options.unfiltered ? { unfilteredDiagnostics: checkResult.unfiltered } : {}),
    };

    return result;
  } finally {
    await workspace.dispose();
  }
}

export type {
  CheckResult,
  Finding,
  FindingKind,
  SkippedSnippet,
  SkipReason,
  Snippet,
  SnippetLang,
} from "./types.js";
export { extractSnippets, findImports, importMatchesPackage } from "./extract.js";
export { parsePackageSpec, createWorkspace } from "./workspace.js";
export { checkSnippets } from "./check.js";
export { renderHuman, renderJson } from "./report.js";
