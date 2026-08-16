import pc from "picocolors";
import type { CheckResult, Finding, FindingKind, SkipReason, SkippedSnippet } from "./types.js";

function formatSymbolLike(kind: FindingKind, value: string): string {
  switch (kind) {
    case "renamed-property":
    case "removed-property":
      return `.${value}`;
    case "unknown-option":
      return `'${value}'`;
    default:
      return value;
  }
}

function findingHeadline(f: Finding): string {
  if (f.symbol) return formatSymbolLike(f.kind, f.symbol);
  return f.message;
}

const REASON_PHRASES: Record<SkipReason, (n: number, packageName: string) => string> = {
  "no-target-import": (n, pkg) => `${n} do not import ${pkg}`,
  unparseable: (n) => `${n} unparseable`,
  "explicitly-skipped": (n) => `${n} marked skip`,
  "historical-section": (n) => `${n} historical/migration content`,
  "before-example": (n) => `${n} before/old examples`,
  "unresolved-import": (n) => `${n} unresolved import`,
  "unsupported-language": (n) => `${n} JS/JSX (use --include-js)`,
};

const REASON_ORDER: SkipReason[] = [
  "no-target-import",
  "unparseable",
  "explicitly-skipped",
  "historical-section",
  "before-example",
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
    lines.push("");

    const bySection = new Map<string, Finding[]>();
    for (const f of findings) {
      const key = f.section ?? "";
      const list = bySection.get(key) ?? [];
      list.push(f);
      bySection.set(key, list);
    }

    for (const [section, sectionFindings] of bySection) {
      const indent = section ? "    " : "  ";
      if (section) lines.push(`  ${pc.bold(section)}`);

      for (const f of [...sectionFindings].sort((a, b) => a.line - b.line)) {
        const locRaw = `L${f.line}`;
        const locWidth = Math.max(6, locRaw.length + 1);
        const loc = pc.dim(locRaw.padEnd(locWidth));
        const kind = pc.red(f.kind.padEnd(18));
        lines.push(`${indent}${loc}${kind}${findingHeadline(f)}`);

        if (f.suggestion) {
          const gutter = " ".repeat(locWidth + 18);
          lines.push(`${indent}${gutter}TypeScript suggests: ${formatSymbolLike(f.kind, f.suggestion)}`);
        }
      }
      lines.push("");
    }
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
