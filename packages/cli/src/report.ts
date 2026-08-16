import pc from "picocolors";
import type { CheckResult, Finding, SkipReason, SkippedSnippet } from "./types.js";

function describeFinding(f: Finding): string {
  switch (f.kind) {
    case "removed-export":
      return `${f.symbol ?? "?"} is no longer exported`;
    case "renamed-export":
      return f.suggestion
        ? `${f.symbol ?? "?"}  →  did you mean '${f.suggestion}'?`
        : `${f.symbol ?? "?"} is no longer exported`;
    case "removed-property":
      return `.${f.symbol ?? "?"} does not exist`;
    case "renamed-property":
      return f.suggestion
        ? `.${f.symbol ?? "?"}  →  did you mean .${f.suggestion}?`
        : `.${f.symbol ?? "?"} does not exist`;
    case "unknown-option":
      return f.suggestion
        ? `'${f.symbol ?? "?"}'  →  did you mean '${f.suggestion}'?`
        : `unknown option '${f.symbol ?? "?"}'`;
    case "wrong-arity":
      return f.message;
    default:
      return f.message;
  }
}

const REASON_PHRASES: Record<SkipReason, (n: number, packageName: string) => string> = {
  "no-target-import": (n, pkg) => `${n} do not import ${pkg}`,
  unparseable: (n) => `${n} unparseable`,
  "explicitly-skipped": (n) => `${n} marked skip`,
  "unresolved-import": (n) => `${n} unresolved import`,
  "unsupported-language": (n) => `${n} JS/JSX (use --include-js)`,
};

const REASON_ORDER: SkipReason[] = [
  "no-target-import",
  "unparseable",
  "explicitly-skipped",
  "unresolved-import",
  "unsupported-language",
];

function renderSkippedSummary(skipped: SkippedSnippet[], packageName: string): string {
  if (skipped.length === 0) return "Skipped 0.";
  const counts = new Map<SkipReason, number>();
  for (const s of skipped) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
  const parts = REASON_ORDER.filter((r) => counts.has(r)).map((r) => REASON_PHRASES[r](counts.get(r)!, packageName));
  const plural = skipped.length === 1 ? "" : "s";
  return `Skipped ${skipped.length} snippet${plural} (${parts.join(", ")}).`;
}

function renderVerboseSkipped(skipped: SkippedSnippet[]): string[] {
  const lines: string[] = [];
  for (const s of skipped) {
    lines.push(`  ${pc.dim(`L${s.snippet.line}`)}  ${pc.yellow(s.reason.padEnd(20))}${s.snippet.source}`);
  }
  return lines;
}

export interface RenderOptions {
  verbose?: boolean;
}

export function renderHuman(result: CheckResult, options: RenderOptions = {}): string {
  const lines: string[] = [];

  const bySource = new Map<string, Finding[]>();
  for (const f of result.findings) {
    const list = bySource.get(f.source) ?? [];
    list.push(f);
    bySource.set(f.source, list);
  }

  for (const [source, findings] of bySource) {
    lines.push(pc.bold(source));
    for (const f of [...findings].sort((a, b) => a.line - b.line)) {
      const locRaw = `L${f.line}`;
      const loc = pc.dim(locRaw.padEnd(Math.max(6, locRaw.length + 1)));
      const kind = pc.red(f.kind.padEnd(18));
      lines.push(`  ${loc}${kind}${describeFinding(f)}`);
    }
    lines.push("");
  }

  if (result.findings.length === 0) {
    lines.push(pc.green("No broken samples found."));
  } else {
    const docCount = bySource.size;
    lines.push(
      pc.red(
        `${result.findings.length} broken sample${result.findings.length === 1 ? "" : "s"} in ${docCount} document${
          docCount === 1 ? "" : "s"
        }.`,
      ),
    );
  }

  lines.push(
    `Checked ${result.snippetsChecked} TypeScript sample${result.snippetsChecked === 1 ? "" : "s"} against ${result.packageName}@${result.packageVersion}.`,
  );
  lines.push(renderSkippedSummary(result.skipped, result.packageName));

  if (options.verbose && result.skipped.length > 0) {
    lines.push("");
    lines.push(pc.dim("Skipped snippets:"));
    lines.push(...renderVerboseSkipped(result.skipped));
  }

  return lines.join("\n");
}

export function renderJson(result: CheckResult): string {
  return JSON.stringify(result, null, 2);
}
