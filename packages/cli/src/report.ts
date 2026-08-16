import pc from "picocolors";
import { FINDING_KINDS, SKIP_REASONS } from "./types.js";
import type { CheckResult, Finding, FindingKind, RawDiagnostic, SkipReason, SkippedSnippet } from "./types.js";

// Derived from the enums themselves, not a hand-picked constant — so a future
// member longer than today's longest can never silently collapse a column's
// separator to zero spaces the way "unsupported-language" (exactly 20 chars) once
// did. See test/column-widths.test.ts.
const FINDING_KIND_COLUMN_WIDTH = Math.max(...FINDING_KINDS.map((k) => k.length)) + 2;
const SKIP_REASON_COLUMN_WIDTH = Math.max(...SKIP_REASONS.map((r) => r.length)) + 1;

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
    const reasonWidth = Math.max(SKIP_REASON_COLUMN_WIDTH, s.reason.length + 1);
    lines.push(`  ${pc.dim(`L${s.snippet.line}`)}  ${pc.yellow(s.reason.padEnd(reasonWidth))}${s.snippet.source}`);
  }
  return lines;
}

function renderUnfiltered(diagnostics: RawDiagnostic[]): string[] {
  const lines: string[] = [];
  const byCode = new Map<number, RawDiagnostic[]>();
  for (const d of diagnostics) {
    const list = byCode.get(d.code) ?? [];
    list.push(d);
    byCode.set(d.code, list);
  }

  lines.push("");
  lines.push(pc.dim(`Unfiltered: ${diagnostics.length} diagnostic${diagnostics.length === 1 ? "" : "s"} outside the allowlist.`));
  for (const [code, occurrences] of [...byCode.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const example = occurrences[0];
    lines.push(
      `  ${pc.yellow(`TS${code}`)} x${occurrences.length}  ${pc.dim(`${example.source}:L${example.line}`)}  ${example.message}`,
    );
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
        const kind = pc.red(f.kind.padEnd(FINDING_KIND_COLUMN_WIDTH));
        lines.push(`${indent}${loc}${kind}${findingHeadline(f)}`);

        if (f.typescriptSuggestion) {
          const gutter = " ".repeat(locWidth + FINDING_KIND_COLUMN_WIDTH);
          lines.push(`${indent}${gutter}TypeScript suggests: ${formatSymbolLike(f.kind, f.typescriptSuggestion)}`);
        }
      }
      lines.push("");
    }
  }

  if (result.noTypeDeclarations) {
    // Deliberately not "No broken samples found." — with zero type declarations,
    // every sample checked as untyped `any`. Nothing was ever measured.
    const dtNote = result.definitelyTypedAvailable
      ? `@types/${result.packageName} exists but is not installed automatically`
      : "no @types/ package exists for it either";
    lines.push(
      pc.yellow(
        `${result.packageName}@${result.packageVersion} ships no type declarations — nothing could be checked (${dtNote}).`,
      ),
    );
  } else if (result.findings.length === 0) {
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

  if (result.unfilteredDiagnostics && result.unfilteredDiagnostics.length > 0) {
    lines.push(...renderUnfiltered(result.unfilteredDiagnostics));
  }

  return lines.join("\n");
}

export function renderJson(result: CheckResult): string {
  return JSON.stringify(result, null, 2);
}
