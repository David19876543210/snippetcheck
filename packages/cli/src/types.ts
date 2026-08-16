export type SnippetLang = "ts" | "tsx" | "js" | "jsx";

export interface Snippet {
  id: string;
  source: string;
  line: number;
  lang: SnippetLang;
  code: string;
  imports: string[];
}

export type SkipReason =
  | "no-target-import"
  | "unparseable"
  | "explicitly-skipped"
  | "unresolved-import"
  | "unsupported-language";

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
  suggestion: string | null;
  source: string;
  line: number;
  column: number;
  excerpt: string;
  snippetId: string;
}

export interface CheckResult {
  packageName: string;
  packageVersion: string;
  documentsScanned: number;
  snippetsFound: number;
  snippetsChecked: number;
  skipped: SkippedSnippet[];
  findings: Finding[];
}
