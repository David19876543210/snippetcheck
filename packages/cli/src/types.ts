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

export type SkipReason =
  | "no-target-import"
  | "unparseable"
  | "explicitly-skipped"
  | "unresolved-import"
  | "unsupported-language"
  | "historical-section"
  | "before-example";

export interface SkippedSnippet {
  snippet: Snippet;
  reason: SkipReason;
}

export type FindingKind =
  | "removed-export"
  | "renamed-export"
  | "removed-property"
  | "renamed-property"
  | "unknown-option"
  | "wrong-arity";

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
