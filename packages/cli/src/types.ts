export type SnippetLang = "ts" | "tsx" | "js" | "jsx";

export interface Snippet {
  id: string;
  source: string;
  line: number;
  lang: SnippetLang;
  code: string;
  imports: string[];
  sectionPath: string[];
}

// The array is the source of truth; the type is derived from it, so the two can
// never drift apart. report.ts derives its column widths from this same array —
// see SKIP_REASON_COLUMN_WIDTH — so a new member can never silently break
// alignment the way "unsupported-language" (exactly 20 chars) once did.
export const SKIP_REASONS = [
  "no-target-import",
  "unparseable",
  "explicitly-skipped",
  "unresolved-import",
  "unsupported-language",
  "historical-section",
  "before-example",
] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];

export interface SkippedSnippet {
  snippet: Snippet;
  reason: SkipReason;
}

export const FINDING_KINDS = [
  "removed-export",
  "renamed-export",
  "removed-property",
  "renamed-property",
  "unknown-option",
  "wrong-arity",
] as const;

export type FindingKind = (typeof FINDING_KINDS)[number];

export interface Finding {
  kind: FindingKind;
  symbol: string | null;
  code: number;
  message: string;
  /**
   * TypeScript's own "Did you mean 'x'?" guess, based on string similarity — not a
   * verified migration target. Never render this as if it were snippetcheck's advice.
   */
  typescriptSuggestion: string | null;
  source: string;
  line: number;
  column: number;
  excerpt: string;
  snippetId: string;
  section: string | null;
  sectionPath: string[];
}

export interface CheckResult {
  packageName: string;
  packageVersion: string;
  documentsScanned: number;
  snippetsFound: number;
  /** The true denominator: how many snippets were eligible for checking before
   *  --max-snippets sampling truncated the pool. Equal to snippetsChecked plus
   *  every check-time skip reason when no sampling occurred. */
  snippetsTotal: number;
  snippetsChecked: number;
  skipped: SkippedSnippet[];
  findings: Finding[];
}
